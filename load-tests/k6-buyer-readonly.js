/**
 * Read-only multi-buyer k6 test.
 *
 * setup() runs ONCE per test (not per VU). It logs each buyer in once and
 * returns JWTs. Each VU keeps exec.vu.idInTest for the whole test, so
 * sessions[idInTest - 1] is the same account on every iteration.
 *
 * Credentials (env only, never logged):
 *   BUYER_EMAILS / BUYER_PASSWORD or BUYER_PASSWORDS
 *   FRONTEND_URL, API_URL (no /api suffix)
 *   VUS (default 2), DURATION (default 30s)
 *
 * Also honor k6 CLI --vus / --duration via execution.test.options.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Rate, Trend } from "k6/metrics";

const FRONTEND_URL = String(__ENV.FRONTEND_URL || "").replace(/\/$/, "");
const API_URL = String(__ENV.API_URL || "").replace(/\/$/, "");

const http429 = new Counter("http_429");
const otherFailures = new Counter("http_other_failures");
const failedRequests = new Rate("failed_requests");
const apiDuration = new Trend("api_req_duration", true);
const pageDuration = new Trend("page_req_duration", true);

const envVus = Number(__ENV.VUS || 2);
const envDuration = __ENV.DURATION || "30s";

export const options = {
  vus: envVus,
  duration: envDuration,
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_429: ["count<10"],
    http_other_failures: ["count<5"],
    failed_requests: ["rate<0.1"],
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

function record(res, name, kind) {
  const is429 = res.status === 429;
  const ok = res.status >= 200 && res.status < 400;

  if (is429) {
    http429.add(1);
    console.error(`HTTP 429  ${name}`);
  } else if (!ok) {
    otherFailures.add(1);
    console.error(`FAIL ${res.status}  ${name}`);
  }

  failedRequests.add(!ok);

  if (kind === "api") {
    apiDuration.add(res.timings.duration);
  } else {
    pageDuration.add(res.timings.duration);
  }

  check(res, {
    [`${name} is 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400,
    [`${name} is not 429`]: (r) => r.status !== 429,
  });
}

function getPage(path) {
  const res = http.get(`${FRONTEND_URL}${path}`, {
    tags: { name: path, kind: "frontend" },
    redirects: 5,
  });
  record(res, `page ${path}`, "page");
  sleep(2);
}

function getApi(path, token) {
  const res = http.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: path, kind: "api" },
    redirects: 5,
  });
  record(res, `api ${path}`, "api");
  sleep(2);
  return res;
}

export function setup() {
  if (!FRONTEND_URL || !API_URL) {
    throw new Error("Set FRONTEND_URL and API_URL (API origin without /api).");
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

    if (res.status === 429) {
      throw new Error("Login hit HTTP 429 (rate limit). Wait 15 minutes or use fewer VUs.");
    }
    if (res.status !== 200) {
      throw new Error(`Login failed for buyer slot ${i + 1} (HTTP ${res.status}).`);
    }

    let body;
    try {
      body = res.json();
    } catch (_) {
      throw new Error(`Login failed for buyer slot ${i + 1} (invalid JSON).`);
    }

    const role = body && body.user && body.user.role;
    if (!body || !body.token || role !== "BUYER") {
      throw new Error(`Login failed for buyer slot ${i + 1} (not a BUYER JWT).`);
    }

    sessions.push({ token: String(body.token) });
    sleep(2);
  }

  return { sessions };
}

export default function (data) {
  const vuIndex = exec.vu.idInTest;
  const session = data.sessions[vuIndex - 1];
  if (!session || !session.token) {
    throw new Error("No JWT for this VU. Increase BUYER_EMAILS or lower VUS.");
  }
  const token = session.token;

  getPage("/en/buyer/login");
  getPage("/en/buyer/dashboard");
  getPage("/en/buyer/rfq");

  getApi("/api/auth/me", token);
  getApi("/api/rfqs", token);
  const ordersRes = getApi("/api/orders", token);

  let orders = [];
  try {
    if (ordersRes.status === 200) {
      const parsed = ordersRes.json();
      if (Array.isArray(parsed)) orders = parsed;
    }
  } catch (_) {
    orders = [];
  }

  const ownIds = orders
    .map((o) => o && o.id)
    .filter((id) => Number.isFinite(Number(id)))
    .slice(0, 2);

  for (const orderId of ownIds) {
    getApi(`/api/orders/${orderId}/documents`, token);
  }

  sleep(3);
}
