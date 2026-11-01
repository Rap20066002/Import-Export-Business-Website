/**
 * One-shot RFQ create + isolation test.
 *
 * Each VU logs in as a different BUYER (setup), then default() runs ONCE
 * (per-vu-iterations, iterations: 1) and creates exactly one RFQ.
 *
 * There is no GET /api/rfqs/:id. Own retrieve is GET /api/rfqs (buyer-scoped).
 * Cross-buyer denial uses POST /api/rfqs/:id/confirm, which returns 403/404
 * without creating an order on unquoted SUBMITTED RFQs.
 *
 * Never logs passwords or JWTs.
 *
 * Env: API_URL (no /api), BUYER_EMAILS, BUYER_PASSWORD or BUYER_PASSWORDS, VUS (default 10)
 */
import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const API_URL = String(__ENV.API_URL || "").replace(/\/$/, "");
const envVus = Number(__ENV.VUS || 10);

const http429 = new Counter("http_429");
const otherFailures = new Counter("http_other_failures");
const failedRequests = new Rate("failed_requests");
const apiDuration = new Trend("api_req_duration", true);
const rfqsCreated = new Counter("rfqs_created");
const accessDeniedOk = new Counter("rfq_access_denied_ok");
const isolationFailures = new Counter("rfq_isolation_failures");

export const options = {
  scenarios: {
    create_one_rfq_each: {
      executor: "per-vu-iterations",
      vus: envVus,
      iterations: 1,
      maxDuration: "8m",
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<8000"],
    http_429: ["count<5"],
    http_other_failures: ["count<3"],
    failed_requests: ["rate<0.1"],
    rfqs_created: [`count>=${envVus}`],
    rfq_isolation_failures: ["count==0"],
  },
};

function plannedVuCount() {
  try {
    const scenarios = (exec.test.options && exec.test.options.scenarios) || {};
    let max = 0;
    Object.keys(scenarios).forEach((name) => {
      const s = scenarios[name] || {};
      const n = Number(s.vus || s.startVUs || 0);
      if (n > max) max = n;
    });
    if (max > 0) return max;
  } catch (_) {
    /* use env */
  }
  return envVus;
}

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

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
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

  const vus = plannedVuCount();
  if (emails.length < vus) {
    throw new Error(
      `Need at least ${vus} emails in BUYER_EMAILS (one distinct buyer per VU). Got ${emails.length}.`
    );
  }

  const productsRes = http.get(`${API_URL}/api/products`, {
    tags: { name: "/api/products", kind: "api" },
  });
  record(productsRes, "api GET /api/products");
  if (productsRes.status === 429) {
    throw new Error("Catalog GET hit HTTP 429. Wait 15 minutes and retry.");
  }
  const products = parseJson(productsRes);
  const product =
    (Array.isArray(products) && products.find((p) => p && p.slug === "rabbi-dates" && p.id)) ||
    (Array.isArray(products) && products.find((p) => p && p.id && p.isActive !== false));
  if (!product) {
    throw new Error("No active product from GET /api/products; cannot build RFQ payload.");
  }

  const portsRes = http.get(`${API_URL}/api/lookups/ports`, {
    tags: { name: "/api/lookups/ports", kind: "api" },
  });
  record(portsRes, "api GET /api/lookups/ports");
  const ports = parseJson(portsRes);
  const port = Array.isArray(ports) && ports.find((p) => p && Number.isFinite(Number(p.id)));
  if (!port) {
    throw new Error("No destination port from GET /api/lookups/ports; cannot build RFQ payload.");
  }

  sleep(2);

  const sessions = [];
  for (let i = 0; i < vus; i += 1) {
    const password = passwords[i] || sharedPassword;
    if (!password) {
      throw new Error("Set BUYER_PASSWORD (or BUYER_PASSWORDS aligned with BUYER_EMAILS).");
    }

    const res = http.post(
      `${API_URL}/api/auth/login`,
      JSON.stringify({ email: emails[i], password }),
      {
        headers: { "Content-Type": "application/json" },
        tags: { name: "/api/auth/login", kind: "api" },
      }
    );
    record(res, `api POST /api/auth/login slot ${i + 1}`);

    if (res.status === 429) {
      throw new Error("Login hit HTTP 429 (rate limit). Wait 15 minutes or use fewer VUs.");
    }
    if (res.status !== 200) {
      throw new Error(`Login failed for buyer slot ${i + 1} (HTTP ${res.status}).`);
    }

    const body = parseJson(res);
    const role = body && body.user && body.user.role;
    const userId = body && body.user && body.user.id;
    if (!body || !body.token || role !== "BUYER" || !userId) {
      throw new Error(`Login failed for buyer slot ${i + 1} (not a BUYER JWT).`);
    }

    sessions.push({ token: String(body.token), userId: String(userId), slot: i + 1 });
    sleep(2);
  }

  const runTag = `K6-LOAD-TEST ${Date.now()}`;
  console.log(
    `RFQ create run tag=${runTag} productId=${product.id} portId=${port.id} buyers=${sessions.length}`
  );

  return {
    sessions,
    productId: Number(product.id),
    destinationPortId: Number(port.id),
    runTag,
  };
}

export default function (data) {
  const vuIndex = exec.vu.idInTest;
  const session = data.sessions[vuIndex - 1];
  if (!session || !session.token) {
    throw new Error("No JWT for this VU. Increase BUYER_EMAILS or lower VUS.");
  }

  const notes = `${data.runTag} | slot=${vuIndex}`;
  const payload = {
    productIds: [data.productId],
    grade: "K6-LOAD-TEST",
    quantityContainers: 1,
    containerType: "DRY_20",
    packagingKg: 5,
    numberOfBoxes: 100,
    destinationPortId: data.destinationPortId,
    incoterm: "FOB",
    targetPricePerTon: 100,
    targetPriceCurrency: "USD",
    notes,
  };

  const createRes = http.post(`${API_URL}/api/rfqs`, JSON.stringify(payload), {
    headers: authHeaders(session.token),
    tags: { name: "POST /api/rfqs", kind: "api" },
  });
  record(createRes, "api POST /api/rfqs");

  const created = parseJson(createRes);
  const rfqId = created && created.id;
  const createdOk =
    createRes.status === 201 && Number.isFinite(Number(rfqId)) && created.status === "SUBMITTED";

  check(createRes, {
    "RFQ created with numeric id": () => createdOk,
  });

  if (!createdOk) {
    throw new Error(`VU ${vuIndex} did not create an RFQ (HTTP ${createRes.status}).`);
  }

  rfqsCreated.add(1);
  console.log(`Created RFQ id=${rfqId} slot=${vuIndex}`);
  sleep(2);

  const listRes = http.get(`${API_URL}/api/rfqs`, {
    headers: authHeaders(session.token),
    tags: { name: "GET /api/rfqs", kind: "api" },
  });
  record(listRes, "api GET /api/rfqs own");

  const list = parseJson(listRes);
  const rows = Array.isArray(list) ? list : [];
  const found = rows.find((r) => r && Number(r.id) === Number(rfqId));
  const onlyOwnBuyer = rows.every((r) => !r || !r.buyer || String(r.buyer.id) === session.userId);

  check(listRes, {
    "own list contains created RFQ": () => Boolean(found),
    "own list only contains this buyer": () => onlyOwnBuyer,
  });

  if (!found) {
    isolationFailures.add(1);
    console.error(`VU ${vuIndex} created RFQ id=${rfqId} but GET /api/rfqs did not return it`);
  }
  if (!onlyOwnBuyer) {
    isolationFailures.add(1);
    console.error(`VU ${vuIndex} GET /api/rfqs included another buyer`);
  }

  sleep(2);
}

export function teardown(data) {
  const sessions = (data && data.sessions) || [];
  const runTag = data && data.runTag;
  if (!sessions.length || !runTag) {
    console.error("teardown missing sessions or runTag");
    return;
  }

  const createdBySlot = [];

  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    const listRes = http.get(`${API_URL}/api/rfqs`, {
      headers: authHeaders(session.token),
      tags: { name: "GET /api/rfqs teardown", kind: "api" },
    });
    record(listRes, `teardown GET /api/rfqs slot ${session.slot}`);

    const listed = parseJson(listRes);
    const rows = Array.isArray(listed) ? listed : [];
    const mine = rows.filter((r) => r && String(r.notes || "").indexOf(runTag) !== -1);
    const ids = mine.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));

    if (ids.length !== 1) {
      isolationFailures.add(1);
      console.error(
        `slot ${session.slot} expected exactly 1 RFQ for this run, found ${ids.length}`
      );
    }

    const foreign = rows.filter((r) => r && r.buyer && String(r.buyer.id) !== session.userId);
    if (foreign.length) {
      isolationFailures.add(1);
      console.error(`slot ${session.slot} list leaked ${foreign.length} other-buyer RFQ(s)`);
    }

    createdBySlot[i] = ids[0] || null;
    sleep(1);
  }

  const knownIds = createdBySlot.filter((id) => Number.isFinite(id));
  console.log(`Isolation check across RFQ ids: ${knownIds.join(",")}`);

  for (let i = 0; i < sessions.length; i += 1) {
    const otherIndex = (i + 1) % sessions.length;
    const otherId = createdBySlot[otherIndex];
    if (!otherId || sessions.length < 2) continue;

    const denyRes = http.post(
      `${API_URL}/api/rfqs/${otherId}/confirm`,
      JSON.stringify({}),
      {
        headers: authHeaders(sessions[i].token),
        tags: { name: "POST /api/rfqs/:id/confirm other", kind: "api" },
      }
    );
    record(denyRes, `teardown confirm other RFQ as slot ${sessions[i].slot}`, {
      expectDenied: true,
    });

    if (denyRes.status !== 403 && denyRes.status !== 404) {
      isolationFailures.add(1);
      console.error(
        `slot ${sessions[i].slot} expected 403/404 on other RFQ id=${otherId}, got ${denyRes.status}`
      );
    }

    const listRes = http.get(`${API_URL}/api/rfqs`, {
      headers: authHeaders(sessions[i].token),
      tags: { name: "GET /api/rfqs isolation", kind: "api" },
    });
    record(listRes, `teardown list isolation slot ${sessions[i].slot}`);
    const listed = parseJson(listRes);
    const rows = Array.isArray(listed) ? listed : [];
    const sawOther = rows.some((r) => r && Number(r.id) === Number(otherId));
    check(listRes, {
      "list does not include another buyer RFQ": () => !sawOther,
    });
    if (sawOther) {
      isolationFailures.add(1);
      console.error(`slot ${sessions[i].slot} list included other RFQ id=${otherId}`);
    }

    sleep(1);
  }
}
