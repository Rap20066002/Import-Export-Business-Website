/**
 * One-shot end-to-end workflow for 10 buyers under a 100 req / 15 min / IP cap.
 *
 * Uses 1 k6 VU and http.batch so the 10 buyers still hit create/confirm/upload
 * at the same time, while RFQ ids stay in memory (no admin poll, no teardown
 * re-fetch). UNDER_REVIEW is skipped: POST /quote accepts SUBMITTED RFQs.
 *
 * Happy-path total at VUS=10: 85 API requests (see README).
 * Never logs passwords or JWTs. Does not delete records.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const API_URL = String(__ENV.API_URL || "").replace(/\/$/, "");
const buyerCount = Number(__ENV.VUS || 10);

const http429 = new Counter("http_429");
const otherFailures = new Counter("http_other_failures");
const failedRequests = new Rate("failed_requests");
const accessDeniedOk = new Counter("access_denied_ok");
const apiDuration = new Trend("api_req_duration", true);
const rfqsCreated = new Counter("rfqs_created");
const quotesSent = new Counter("quotes_sent");
const ordersCreated = new Counter("orders_created");
const documentsUploaded = new Counter("documents_uploaded");
const workflowsCompleted = new Counter("workflows_completed");
const isolationFailures = new Counter("isolation_failures");

export const options = {
  scenarios: {
    full_workflow: {
      executor: "per-vu-iterations",
      vus: 1,
      iterations: 1,
      maxDuration: "8m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<15000"],
    http_429: ["count<3"],
    http_other_failures: ["count<3"],
    failed_requests: ["rate<0.1"],
    rfqs_created: [`count>=${buyerCount}`],
    quotes_sent: [`count>=${buyerCount}`],
    orders_created: [`count>=${buyerCount}`],
    documents_uploaded: [`count>=${buyerCount}`],
    workflows_completed: [`count>=${buyerCount}`],
    isolation_failures: ["count==0"],
  },
};

function record(res, name, opts) {
  const expectDenied = opts && opts.expectDenied;
  const is429 = res.status === 429;
  const success = expectDenied
    ? res.status === 403 || res.status === 404
    : res.status >= 200 && res.status < 400;

  if (is429) {
    http429.add(1);
    console.error(`HTTP 429  ${name}`);
  } else if (!success) {
    otherFailures.add(1);
    console.error(`FAIL ${res.status}  ${name}`);
  }

  failedRequests.add(!success);
  apiDuration.add(res.timings.duration);

  if (expectDenied) {
    check(res, {
      [`${name} denied with 403 or 404`]: (r) => r.status === 403 || r.status === 404,
    });
    if (res.status === 403 || res.status === 404) accessDeniedOk.add(1);
  } else {
    check(res, {
      [`${name} is 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400,
      [`${name} is not 429`]: (r) => r.status !== 429,
    });
  }
}

function parseJson(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

function jsonHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function testPdf(label) {
  return `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>/Contents 4 0 R>>endobj
4 0 obj<</Length 55>>stream
BT /F1 12 Tf 20 60 Td (${label}) Tj ET
endstream
endobj
trailer<</Root 1 0 R>>
%%EOF
`;
}

function login(email, password, slotLabel) {
  const res = http.post(
    `${API_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { name: "/api/auth/login", kind: "api" },
    }
  );
  record(res, `POST /api/auth/login ${slotLabel}`);
  if (res.status === 429) {
    throw new Error(`Login hit HTTP 429 (${slotLabel}). Wait 15 minutes.`);
  }
  if (res.status !== 200) {
    throw new Error(`Login failed for ${slotLabel} (HTTP ${res.status}).`);
  }
  const body = parseJson(res);
  if (!body || !body.token || !body.user || !body.user.id || !body.user.role) {
    throw new Error(`Login failed for ${slotLabel} (invalid body).`);
  }
  return {
    token: String(body.token),
    userId: String(body.user.id),
    role: String(body.user.role),
  };
}

function batch(reqs) {
  return http.batch(reqs);
}

export function setup() {
  if (!API_URL) {
    throw new Error("Set API_URL (backend origin without /api).");
  }

  const emails = String(__ENV.BUYER_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const sharedPassword = String(__ENV.BUYER_PASSWORD || "");
  const passwords = String(__ENV.BUYER_PASSWORDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const adminEmail = String(__ENV.ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = String(__ENV.ADMIN_PASSWORD || "");

  if (emails.length < buyerCount) {
    throw new Error(
      `Need at least ${buyerCount} emails in BUYER_EMAILS. Got ${emails.length}.`
    );
  }
  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD. Quote requires SUPER_ADMIN or SALES_MANAGER."
    );
  }

  const productsRes = http.get(`${API_URL}/api/products`, {
    tags: { name: "/api/products", kind: "api" },
  });
  record(productsRes, "GET /api/products");
  const products = parseJson(productsRes);
  const product =
    (Array.isArray(products) && products.find((p) => p && p.slug === "rabbi-dates" && p.id)) ||
    (Array.isArray(products) && products.find((p) => p && p.id));
  if (!product) {
    throw new Error("No product from GET /api/products.");
  }

  let destinationPortId = 0;
  const loading = product.loadingPorts && product.loadingPorts[0];
  if (loading && Number.isFinite(Number(loading.id))) {
    destinationPortId = Number(loading.id);
  } else {
    const portsRes = http.get(`${API_URL}/api/lookups/ports`, {
      tags: { name: "/api/lookups/ports", kind: "api" },
    });
    record(portsRes, "GET /api/lookups/ports");
    const ports = parseJson(portsRes);
    const port = Array.isArray(ports) && ports.find((p) => p && Number.isFinite(Number(p.id)));
    if (!port) throw new Error("No destination port from GET /api/lookups/ports.");
    destinationPortId = Number(port.id);
  }

  const sessions = [];
  for (let i = 0; i < buyerCount; i += 1) {
    const password = passwords[i] || sharedPassword;
    if (!password) {
      throw new Error("Set BUYER_PASSWORD (or BUYER_PASSWORDS aligned with BUYER_EMAILS).");
    }
    const session = login(emails[i], password, `buyer slot ${i + 1}`);
    if (session.role !== "BUYER") {
      throw new Error(`Buyer slot ${i + 1} is not role BUYER.`);
    }
    sessions.push({ token: session.token, userId: session.userId, slot: i + 1 });
  }

  const admin = login(adminEmail, adminPassword, "admin");
  if (admin.role !== "SUPER_ADMIN" && admin.role !== "SALES_MANAGER") {
    throw new Error("Admin login must be SUPER_ADMIN or SALES_MANAGER.");
  }

  const runTag = `K6-FULL-TEST ${Date.now()}`;
  const validityDate = new Date(Date.now() + 14 * 86400000).toISOString();
  console.log(
    `Full workflow runTag=${runTag} productId=${product.id} portId=${destinationPortId} buyers=${sessions.length}`
  );

  return {
    sessions,
    adminToken: admin.token,
    productId: Number(product.id),
    destinationPortId,
    runTag,
    validityDate,
  };
}

export default function (data) {
  const sessions = data.sessions;
  const n = sessions.length;

  const createReqs = sessions.map((session) => ({
    method: "POST",
    url: `${API_URL}/api/rfqs`,
    body: JSON.stringify({
      productIds: [data.productId],
      grade: "K6-FULL-TEST",
      quantityContainers: 1,
      containerType: "DRY_20",
      packagingKg: 5,
      numberOfBoxes: 100,
      destinationPortId: data.destinationPortId,
      incoterm: "FOB",
      targetPricePerTon: 100,
      targetPriceCurrency: "USD",
      notes: `${data.runTag} | slot=${session.slot}`,
    }),
    params: {
      headers: jsonHeaders(session.token),
      tags: { name: "POST /api/rfqs", kind: "api" },
    },
  }));
  const createRes = batch(createReqs);
  const rfqIds = [];
  for (let i = 0; i < n; i += 1) {
    record(createRes[i], `POST /api/rfqs slot ${sessions[i].slot}`);
    const body = parseJson(createRes[i]);
    const id = body && body.id;
    const ok =
      createRes[i].status === 201 && Number.isFinite(Number(id)) && body.status === "SUBMITTED";
    check(createRes[i], { [`RFQ created slot ${sessions[i].slot}`]: () => ok });
    if (!ok) throw new Error(`RFQ create failed for slot ${sessions[i].slot} (HTTP ${createRes[i].status}).`);
    rfqIds.push(Number(id));
    rfqsCreated.add(1);
    console.log(`Created RFQ id=${id} slot=${sessions[i].slot}`);
  }

  sleep(1);

  const quoteReqs = rfqIds.map((rfqId) => ({
    method: "POST",
    url: `${API_URL}/api/rfqs/${rfqId}/quote`,
    body: JSON.stringify({
      pricePerTon: 500,
      currency: "USD",
      validityDate: data.validityDate,
      notes: "K6-FULL-TEST quotation",
    }),
    params: {
      headers: jsonHeaders(data.adminToken),
      tags: { name: "POST /api/rfqs/:id/quote", kind: "api" },
    },
  }));
  const quoteRes = batch(quoteReqs);
  for (let i = 0; i < n; i += 1) {
    record(quoteRes[i], `POST /api/rfqs/${rfqIds[i]}/quote`);
    if (quoteRes[i].status === 201) quotesSent.add(1);
    else throw new Error(`Quote failed for RFQ ${rfqIds[i]} (HTTP ${quoteRes[i].status}).`);
  }

  sleep(1);

  const confirmReqs = sessions.map((session, i) => ({
    method: "POST",
    url: `${API_URL}/api/rfqs/${rfqIds[i]}/confirm`,
    body: JSON.stringify({ notes: "K6-FULL-TEST confirm" }),
    params: {
      headers: jsonHeaders(session.token),
      tags: { name: "POST /api/rfqs/:id/confirm", kind: "api" },
    },
  }));
  const confirmRes = batch(confirmReqs);
  const orderIds = [];
  for (let i = 0; i < n; i += 1) {
    record(confirmRes[i], `POST /api/rfqs/${rfqIds[i]}/confirm`);
    const body = parseJson(confirmRes[i]);
    const orderId = body && body.order && body.order.id;
    const ok = confirmRes[i].status === 201 && Number.isFinite(Number(orderId));
    check(confirmRes[i], { [`order created slot ${sessions[i].slot}`]: () => ok });
    if (!ok) throw new Error(`Confirm failed for slot ${sessions[i].slot} (HTTP ${confirmRes[i].status}).`);
    orderIds.push(Number(orderId));
    ordersCreated.add(1);
    console.log(`Created order id=${orderId} slot=${sessions[i].slot}`);
  }

  sleep(1);

  const uploadReqs = sessions.map((session, i) => ({
    method: "POST",
    url: `${API_URL}/api/orders/${orderIds[i]}/documents`,
    body: {
      type: "OTHER",
      file: http.file(
        testPdf(`K6-FULL-TEST slot ${session.slot}`),
        `K6-FULL-TEST-slot-${session.slot}.pdf`,
        "application/pdf"
      ),
    },
    params: {
      headers: bearerHeaders(session.token),
      tags: { name: "POST /api/orders/:id/documents", kind: "api" },
    },
  }));
  const uploadRes = batch(uploadReqs);
  const documentIds = [];
  for (let i = 0; i < n; i += 1) {
    record(uploadRes[i], `POST /api/orders/${orderIds[i]}/documents`);
    const doc = parseJson(uploadRes[i]);
    const documentId = doc && doc.id;
    const ok =
      uploadRes[i].status === 201 && Number.isFinite(Number(documentId)) && doc.type === "OTHER";
    check(uploadRes[i], { [`document uploaded slot ${sessions[i].slot}`]: () => ok });
    if (!ok) throw new Error(`Upload failed for slot ${sessions[i].slot} (HTTP ${uploadRes[i].status}).`);
    documentIds.push(Number(documentId));
    documentsUploaded.add(1);
  }

  const downloadReqs = sessions.map((session, i) => ({
    method: "GET",
    url: `${API_URL}/api/orders/${orderIds[i]}/documents/${documentIds[i]}/download`,
    params: {
      headers: bearerHeaders(session.token),
      tags: { name: "GET document download own", kind: "api" },
      responseType: "binary",
    },
  }));
  const downloadRes = batch(downloadReqs);
  for (let i = 0; i < n; i += 1) {
    record(downloadRes[i], `GET own document download slot ${sessions[i].slot}`);
    const body = downloadRes[i].body;
    const bodyLen = body ? body.byteLength || body.length || 0 : 0;
    const ok = downloadRes[i].status === 200 && bodyLen > 8;
    check(downloadRes[i], { [`own download slot ${sessions[i].slot}`]: () => ok });
    if (!ok) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} own document download failed`);
    }
  }

  const rfqListReqs = sessions.map((session) => ({
    method: "GET",
    url: `${API_URL}/api/rfqs`,
    params: {
      headers: jsonHeaders(session.token),
      tags: { name: "GET /api/rfqs isolation", kind: "api" },
    },
  }));
  const rfqListRes = batch(rfqListReqs);
  for (let i = 0; i < n; i += 1) {
    record(rfqListRes[i], `GET /api/rfqs slot ${sessions[i].slot}`);
    const listed = parseJson(rfqListRes[i]);
    const rows = Array.isArray(listed) ? listed : [];
    const foreign = rows.filter((r) => r && r.buyer && String(r.buyer.id) !== sessions[i].userId);
    const mine = rows.filter((r) => r && Number(r.id) === rfqIds[i]);
    if (foreign.length) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} RFQ list leaked ${foreign.length} other-buyer row(s)`);
    }
    if (mine.length !== 1) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} GET /api/rfqs missing own RFQ ${rfqIds[i]}`);
    }
  }

  const orderListReqs = sessions.map((session) => ({
    method: "GET",
    url: `${API_URL}/api/orders`,
    params: {
      headers: jsonHeaders(session.token),
      tags: { name: "GET /api/orders isolation", kind: "api" },
    },
  }));
  const orderListRes = batch(orderListReqs);
  for (let i = 0; i < n; i += 1) {
    record(orderListRes[i], `GET /api/orders slot ${sessions[i].slot}`);
    const listed = parseJson(orderListRes[i]);
    const rows = Array.isArray(listed) ? listed : [];
    const foreign = rows.filter((o) => o && o.buyer && String(o.buyer.id) !== sessions[i].userId);
    const mine = rows.filter((o) => o && Number(o.id) === orderIds[i]);
    if (foreign.length) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} order list leaked ${foreign.length} other-buyer row(s)`);
    }
    if (mine.length !== 1) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} GET /api/orders missing own order ${orderIds[i]}`);
    }
  }

  if (n >= 2) {
    const a = sessions[0];
    const otherOrderId = orderIds[1];
    const otherDocId = documentIds[1];
    const otherRfqId = rfqIds[1];

    const listRes = http.get(`${API_URL}/api/orders/${otherOrderId}/documents`, {
      headers: jsonHeaders(a.token),
      tags: { name: "GET other order documents", kind: "api" },
    });
    record(listRes, "GET other buyer documents", { expectDenied: true });
    if (listRes.status !== 403 && listRes.status !== 404) {
      isolationFailures.add(1);
      console.error(`expected 403/404 listing other documents, got ${listRes.status}`);
    }

    const denyDl = http.get(
      `${API_URL}/api/orders/${otherOrderId}/documents/${otherDocId}/download`,
      {
        headers: bearerHeaders(a.token),
        tags: { name: "GET other document download", kind: "api" },
      }
    );
    record(denyDl, "GET other buyer document download", { expectDenied: true });
    if (denyDl.status !== 403 && denyDl.status !== 404) {
      isolationFailures.add(1);
      console.error(`expected 403/404 downloading other document, got ${denyDl.status}`);
    }

    const denyConfirm = http.post(
      `${API_URL}/api/rfqs/${otherRfqId}/confirm`,
      JSON.stringify({}),
      {
        headers: jsonHeaders(a.token),
        tags: { name: "POST confirm other RFQ", kind: "api" },
      }
    );
    record(denyConfirm, "POST confirm other buyer RFQ", { expectDenied: true });
    if (denyConfirm.status !== 403 && denyConfirm.status !== 404) {
      isolationFailures.add(1);
      console.error(`expected 403/404 confirming other RFQ, got ${denyConfirm.status}`);
    }
  }

  for (let i = 0; i < n; i += 1) workflowsCompleted.add(1);
}
