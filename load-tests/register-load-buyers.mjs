/**
 * One-time helper: register dedicated load-test BUYER accounts via
 * POST /api/auth/register-buyer only.
 *
 * Does not use Prisma seed, SQL, or password reset.
 * Already-registered emails are skipped (API returns 400 "Email already registered").
 * Does not print passwords or JWTs.
 *
 * Each successful create sends BUYER_WELCOME to the buyer and, if configured,
 * a second copy to ADMIN_NOTIFICATION_EMAIL.
 *
 * Required env:
 *   API_URL          https://qum-industries-backend.onrender.com  (no /api suffix)
 *   BUYER_PASSWORD   shared password, min 8 characters
 *
 * Do not run until you intend to create accounts.
 */
const EMAILS = [
  "punjani24445@iiitd.ac.in",
  "rezaabbaspunjani28@gmail.com",
  "khizerglass1196@gmail.com",
  "indopersiandates@gmail.com",
  "indopersiangyp@gmail.com",
  "rezaabbaspunjani7@gmail.com",
  "rezapunjani00006@gmail.com",
  "rezapunjani00008@gmail.com",
  "rezaabbas0709@gmail.com",
  "indopersianglass@gmail.com",
];

const API_URL = String(process.env.API_URL || "").replace(/\/$/, "");
const password = String(process.env.BUYER_PASSWORD || "");

function errorMessage(data) {
  if (data && typeof data.error === "string") return data.error;
  return "";
}

async function main() {
  if (!API_URL) {
    console.error("Set API_URL (backend origin, no /api suffix).");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Set BUYER_PASSWORD to at least 8 characters.");
    process.exit(1);
  }

  console.log(`Registering up to ${EMAILS.length} buyers at ${API_URL}/api/auth/register-buyer`);
  console.log("Successful registrations send a welcome email to the buyer, and may also email staff.");
  console.log("");

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < EMAILS.length; i += 1) {
    const n = i + 1;
    const email = EMAILS[i];
    const name = `Load Test Buyer ${n}`;
    const company = `Load Test Company ${n}`;

    let res;
    try {
      res = await fetch(`${API_URL}/api/auth/register-buyer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, company }),
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network error";
      console.error(`FAILED ${n} ${email}: ${reason}`);
      process.exit(1);
    }

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    const errText = errorMessage(data);

    if (res.status === 400 && errText === "Email already registered") {
      console.log(`SKIPPED ${n} ${email}: already registered (password not changed)`);
      skipped += 1;
      continue;
    }

    if (res.status !== 201) {
      console.error(`FAILED ${n} ${email}: HTTP ${res.status}${errText ? ` ${errText}` : ""}`);
      process.exit(1);
    }

    const role = data.user && data.user.role;
    if (role && role !== "BUYER") {
      console.error(`FAILED ${n} ${email}: unexpected role`);
      process.exit(1);
    }

    console.log(`CREATED ${n} ${email} (${name} / ${company})`);
    created += 1;
  }

  console.log("");
  console.log(`Done. created=${created} skipped=${skipped}`);
}

main();
