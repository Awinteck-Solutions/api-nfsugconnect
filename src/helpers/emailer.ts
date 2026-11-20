/**
 * Backward-compatible entry point.
 * Prefer importing from `helpers/mail/emailer`.
 */
export {
  sendMail,
  sendMailLegacy,
  buildMailTemplate,
  MAIL_CATALOG,
} from "./mail/emailer";
export type { MailTemplateId, MailTemplateData } from "./mail/emailer";

import { sendMailLegacy } from "./mail/emailer";

/** Legacy signature used by older auth code: sendMail(to, firstname, subject, htmlKey, data) */
export async function sendMailCompat(
  to: string,
  firstname: string,
  subject: string,
  html: string,
  data: any
) {
  return sendMailLegacy(to, firstname, subject, html, data);
}
