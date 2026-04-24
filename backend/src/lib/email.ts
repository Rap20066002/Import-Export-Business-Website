import sgMail from "@sendgrid/mail";

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "no-reply@example.com";

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
}

type EmailEvent =
  | "RFQ_SUBMITTED"
  | "RFQ_QUOTED"
  | "ORDER_CONFIRMED"
  | "ORDER_STATUS_UPDATED"
  | "DOCUMENT_UPLOADED";

export async function sendEventEmail(
  event: EmailEvent,
  to: string,
  templateId?: string,
  dynamicTemplateData?: Record<string, unknown>
) {
  if (!SENDGRID_KEY) return;

  const autoTemplateId =
    templateId ??
    ({
      RFQ_SUBMITTED: process.env.SENDGRID_TEMPLATE_RFQ_SUBMITTED,
      RFQ_QUOTED: process.env.SENDGRID_TEMPLATE_RFQ_QUOTED,
      ORDER_CONFIRMED: process.env.SENDGRID_TEMPLATE_ORDER_CONFIRMED,
      ORDER_STATUS_UPDATED: process.env.SENDGRID_TEMPLATE_ORDER_STATUS_UPDATED,
      DOCUMENT_UPLOADED: process.env.SENDGRID_TEMPLATE_DOCUMENT_UPLOADED,
    } satisfies Record<EmailEvent, string | undefined>)[event];

  const baseData = {
    RFQ_SUBMITTED: { subject: "RFQ submitted" },
    RFQ_QUOTED: { subject: "RFQ quoted" },
    ORDER_CONFIRMED: { subject: "Order confirmed" },
    ORDER_STATUS_UPDATED: { subject: "Order status updated" },
    DOCUMENT_UPLOADED: { subject: "New shipment document uploaded" },
  }[event];

  const msg: any = autoTemplateId
    ? {
        to,
        from: FROM_EMAIL,
        templateId: autoTemplateId,
        // SendGrid expects an object; if none is provided, send an empty payload.
        dynamicTemplateData: dynamicTemplateData ?? {},
      }
    : {
        to,
        from: FROM_EMAIL,
        subject: baseData.subject,
        text: "Notification from Qum Plastic Industries trade platform.",
      };

  await sgMail.send(msg);
}

