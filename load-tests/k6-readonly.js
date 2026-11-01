/**
 * Read-only k6 load test for the Qum Industries site.
 * Hits public HTML pages and GET APIs only. No login, RFQ, contact, uploads, or other writes.
 *
 * Conservative pacing: sleep between requests so a default 2 VU / 30s run stays well
 * under the backend's 100 requests / 15 minutes / IP limiter (express-rate-limit).
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const FRONTEND_URL = String(__ENV.FRONTEND_URL || "").replace(/\/$/, "");
const API_URL = String(__ENV.API_URL || "").replace(/\/$/, "");
const PRODUCT_SLUG = __ENV.PRODUCT_SLUG || "export-bananas";

const http429 = new Counter("http_429");
const otherFailures = new Counter("http_other_failures");
const failedRequests = new Rate("failed_requests");
const apiDuration = new Trend("api_req_duration", true);
const pageDuration = new Trend("page_req_duration", true);

export const options = {
  vus: Number(__ENV.VUS || 2),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_duration: ["p(95)<5000"],
    http_429: ["count<10"],
    http_other_failures: ["count<5"],
    failed_requests: ["rate<0.1"],
  },
};

function record(res, name, kind) {
  const is429 = res.status === 429;
  const ok = res.status >= 200 && res.status < 400;

  if (is429) {
    http429.add(1);
    console.error(`HTTP 429  ${name}  ${res.url}`);
  } else if (!ok) {
    otherFailures.add(1);
    console.error(`FAIL ${res.status}  ${name}  ${res.url}`);
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
    [`${name} has a body`]: (r) => String(r.body || "").length > 0,
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

function getApi(path) {
  const res = http.get(`${API_URL}${path}`, {
    tags: { name: path, kind: "api" },
    redirects: 5,
  });
  record(res, `api ${path}`, "api");
  sleep(2);
}

export function setup() {
  if (!FRONTEND_URL || !API_URL) {
    throw new Error(
      "Set FRONTEND_URL and API_URL. Example: k6 run -e FRONTEND_URL=https://YOUR_FRONTEND.onrender.com -e API_URL=https://qum-industries-backend.onrender.com load-tests/k6-readonly.js"
    );
  }
  return { frontend: FRONTEND_URL, api: API_URL, slug: PRODUCT_SLUG };
}

export default function (data) {
  getPage("/en");
  getPage("/en/about");
  getPage("/en/trade-process");
  getPage("/en/products");
  getPage(`/en/products/${data.slug}`);

  getApi("/health");
  getApi("/api/products");
  getApi(`/api/products/${data.slug}`);
  getApi("/api/lookups/ports");
  getApi("/api/lookups/countries");

  sleep(3);
}
