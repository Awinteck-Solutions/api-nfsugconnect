import * as nodemailer from "nodemailer";
import { brand } from "./layout";
import { buildMailTemplate, MailTemplateData, MailTemplateId, MAIL_CATALOG } from "./templates";

export { MAIL_CATALOG, buildMailTemplate };
export type { MailTemplateId, MailTemplateData };

function createTransporter() {
  const port = Number(process.env.MAIL_PORT || 465);
  const secure = port === 465;
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || "awinteck.com",
    port,
    secure,
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

export async function sendMail(
  to: string,
  template: MailTemplateId,
  data: MailTemplateData = {},
  options: { subject?: string; cc?: string | string[]; bcc?: string | string[] } = {}
) {
  if (!to) {
    console.warn("[mail] skipped: missing recipient");
    return { skipped: true };
  }

  const built = buildMailTemplate(template, data);
  const transporter = createTransporter();
  const fromAddress = process.env.MAIL_USERNAME || "no-reply@nfsugnetwork.com";

  const mailOptions = {
    from: `"${brand.fromName}" <${fromAddress}>`,
    to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject || built.subject,
    html: built.html,
  };

  console.info(`[mail] sending ${template} → ${to}`);
  try {
    const info = await transporter.sendMail(mailOptions);
    console.info(`[mail] sent ${template}: ${info.response}`);
    return info;
  } catch (error) {
    console.error(`[mail] failed ${template} → ${to}`, error);
    throw error;
  }
}

/** @deprecated Prefer sendMail(to, templateId, data) */
export async function sendMailLegacy(
  to: string,
  firstname: string,
  subject: string,
  html: string,
  data: any
) {
  const map: Record<string, MailTemplateId> = {
    signupHtml: "welcome",
    resetHtml: "password-reset",
    resetSuccessHtml: "password-reset-success",
  };
  const template = map[html] || "welcome";
  return sendMail(to, template, { firstname, ...data, token: data }, { subject });
}
