import sgMail from "@sendgrid/mail";
import nodemailer from "nodemailer";

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || "no-reply@example.com";
const COMPANY = "Qum Plastic Industries";
const SITE_URL = (process.env.FRONTEND_ORIGIN || "http://localhost:3000").split(",")[0]?.trim() || "http://localhost:3000";

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
}

const smtpTransport =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

export type EmailEvent =
  | "RFQ_SUBMITTED"
  | "RFQ_QUOTED"
  | "RFQ_REJECTED"
  | "ORDER_CONFIRMED"
  | "ORDER_STATUS_UPDATED"
  | "DOCUMENT_UPLOADED"
  | "CONTACT_INQUIRY"
  | "BUYER_WELCOME"
  | "RFQ_MESSAGE";

export function isEmailConfigured() {
  return Boolean(SENDGRID_KEY || smtpTransport);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#047857;">${COMPANY}</p>
    <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:12px;color:#64748b;">
      This is a trade notification from ${COMPANY}.
      <a href="${SITE_URL}/en">Open the platform</a>
    </p>
  </div>
</body>
</html>`;
}

function detailsList(data: Record<string, unknown>) {
  const rows = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length > 0)
    .map(
      ([key, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;">${escapeHtml(key)}</td><td style="padding:6px 0;">${escapeHtml(String(value))}</td></tr>`
    )
    .join("");
  return `<table style="border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

export async function sendMail(options: { to: string; subject: string; html: string; text: string }) {
  if (!options.to) return;
  if (!isEmailConfigured()) {
    console.warn(`[email] skipped (not configured): ${options.subject} -> ${options.to}`);
    return;
  }

  if (SENDGRID_KEY) {
    await sgMail.send({
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return;
  }

  if (smtpTransport) {
    await smtpTransport.sendMail({
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }
}

export async function sendEventEmail(
  event: EmailEvent,
  to: string,
  details: Record<string, unknown> = {}
) {
  const copy: Record<EmailEvent, { subject: string; intro: string }> = {
    RFQ_SUBMITTED: {
      subject: `RFQ received — ${COMPANY}`,
      intro: "A new request for quotation has been submitted.",
    },
    RFQ_QUOTED: {
      subject: `Quotation ready — ${COMPANY}`,
      intro: "A quotation is ready for your RFQ. Sign in to review price, validity, and confirm the order.",
    },
    RFQ_REJECTED: {
      subject: `RFQ update — ${COMPANY}`,
      intro: "Your RFQ could not be accepted in its current form. Please see the note below or contact our sales team.",
    },
    ORDER_CONFIRMED: {
      subject: `Order confirmed — ${COMPANY}`,
      intro: "The quotation was confirmed and an order is now in process.",
    },
    ORDER_STATUS_UPDATED: {
      subject: `Shipment status update — ${COMPANY}`,
      intro: "The status of your order has changed.",
    },
    DOCUMENT_UPLOADED: {
      subject: `New trade document — ${COMPANY}`,
      intro: "A document was uploaded to your order. Sign in to download it from the documents page.",
    },
    CONTACT_INQUIRY: {
      subject: `Website inquiry — ${COMPANY}`,
      intro: "A buyer sent a message from the contact page.",
    },
    BUYER_WELCOME: {
      subject: `Welcome to ${COMPANY}`,
      intro: "Your buyer account is ready. You can now submit RFQs and track quotations privately.",
    },
    RFQ_MESSAGE: {
      subject: `New message on RFQ — ${COMPANY}`,
      intro: "A new note was added to an RFQ conversation. Sign in to read and reply.",
    },
  };

  const { subject, intro } = copy[event];
  const html = layout(subject.replace(` — ${COMPANY}`, ""), `<p>${intro}</p>${detailsList(details)}`);
  const text = `${intro}\n\n${Object.entries(details)
    .filter(([, value]) => value != null && String(value).length)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n")}`;

  try {
    await sendMail({ to, subject, html, text });
  } catch (err) {
    console.error("[email] send failed", event, to, err);
  }
}

export async function notifyBuyerAndAdmin(event: EmailEvent, buyerEmail: string, details: Record<string, unknown> = {}) {
  await sendEventEmail(event, buyerEmail, details);
  if (process.env.ADMIN_NOTIFICATION_EMAIL && process.env.ADMIN_NOTIFICATION_EMAIL !== buyerEmail) {
    await sendEventEmail(event, process.env.ADMIN_NOTIFICATION_EMAIL, details);
  }
}
