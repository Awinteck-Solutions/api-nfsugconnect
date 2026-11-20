import { brand, escapeHtml, mailLayout } from "./layout";

export type MailTemplateId =
  | "welcome"
  | "otp"
  | "password-reset"
  | "password-reset-success"
  | "newsletter-welcome"
  | "job-application-received"
  | "job-application-admin"
  | "scholarship-application-received"
  | "scholarship-application-admin"
  | "event-rsvp-confirmation"
  | "donation-thank-you"
  | "marketplace-enquiry-received"
  | "marketplace-enquiry-seller"
  | "community-join-confirmation"
  | "mentorship-request-received"
  | "mentorship-request-mentor"
  | "alumni-connect-request"
  | "admin-invite"
  | "status-update";

export type MailTemplateData = Record<string, any>;

type BuiltMail = { subject: string; html: string };

function greeting(name?: string) {
  const first = String(name || "").trim();
  return first ? `Hi ${escapeHtml(first)},` : "Hello,";
}

function detailRows(rows: Array<[string, string]>) {
  const cells = rows
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #eef2f0;color:#5c6b73;width:38%;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eef2f0;color:#0a1519;vertical-align:top">${value}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 8px">${cells}</table>`;
}

export function buildMailTemplate(id: MailTemplateId, data: MailTemplateData = {}): BuiltMail {
  const firstname = data.firstname || data.name || "";
  const site = brand.siteUrl;

  switch (id) {
    case "welcome": {
      const role = String(data.role || "member").toLowerCase();
      const roleLabel = role === "alumni" ? "alumni" : role === "admin" ? "admin" : "student";
      return {
        subject: `Welcome to ${brand.name}`,
        html: mailLayout({
          title: `Welcome to ${brand.name}`,
          preheader: "Your account is ready.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>Thanks for joining the Nutrition &amp; Food Science network as a <strong>${escapeHtml(roleLabel)}</strong>. Your account is ready.</p>
            <p>From your dashboard you can update your profile, join your year group or community, and explore jobs, events, scholarships, and resources.</p>
          `,
          ctaLabel: "Open dashboard",
          ctaUrl: `${site}/dashboard`,
        }),
      };
    }

    case "otp": {
      const code = escapeHtml(data.code || data.otp || "");
      return {
        subject: `${brand.name} verification code`,
        html: mailLayout({
          title: "Verify your email",
          preheader: `Your verification code is ${code}`,
          body: `
            <p>${greeting(firstname)}</p>
            <p>Use this one-time code to verify your email address:</p>
            <p style="margin:20px 0;font-size:28px;letter-spacing:6px;font-weight:700;color:${brand.navy}">${code}</p>
            <p>This code expires soon. If you did not create an account, you can ignore this message.</p>
          `,
        }),
      };
    }

    case "password-reset": {
      const resetUrl = data.resetUrl || `${site}/reset-password?token=${encodeURIComponent(data.token || "")}`;
      return {
        subject: `Reset your ${brand.name} password`,
        html: mailLayout({
          title: "Password reset request",
          preheader: "Reset your account password.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>We received a request to reset your password. Click the button below to choose a new one. This link expires after a short time.</p>
            ${data.token ? `<p style="font-size:13px;color:#5c6b73">Or use this reset token: <strong>${escapeHtml(data.token)}</strong></p>` : ""}
            <p>If you did not ask for a reset, you can safely ignore this email.</p>
          `,
          ctaLabel: "Reset password",
          ctaUrl: resetUrl,
        }),
      };
    }

    case "password-reset-success":
      return {
        subject: `Your ${brand.name} password was changed`,
        html: mailLayout({
          title: "Password updated",
          preheader: "Your password was changed successfully.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>Your password has been updated successfully. You can now sign in with your new password.</p>
            <p>If you did not make this change, contact support immediately.</p>
          `,
          ctaLabel: "Sign in",
          ctaUrl: `${site}/login`,
        }),
      };

    case "newsletter-welcome":
      return {
        subject: `You're subscribed to ${brand.name}`,
        html: mailLayout({
          title: "You're on the list",
          preheader: "Thanks for subscribing to NFS updates.",
          body: `
            <p>${greeting(firstname || data.email)}</p>
            <p>Thanks for subscribing. We’ll share department news, events, opportunities, and community highlights from Nutrition &amp; Food Science.</p>
          `,
          ctaLabel: "Visit the site",
          ctaUrl: site,
        }),
      };

    case "job-application-received":
      return {
        subject: `Application received: ${data.jobTitle || "Job"}`,
        html: mailLayout({
          title: "Application received",
          preheader: "We received your job application.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>We received your application for <strong>${escapeHtml(data.jobTitle || "this role")}</strong>.</p>
            ${detailRows([
              ["Role", escapeHtml(data.jobTitle || "")],
              ["Company", escapeHtml(data.company || "")],
              ["Submitted", escapeHtml(data.submittedAt || new Date().toLocaleString())],
            ])}
            <p>We’ll review it and follow up if more information is needed.</p>
          `,
          ctaLabel: "Browse more jobs",
          ctaUrl: `${site}/jobs`,
        }),
      };

    case "job-application-admin":
      return {
        subject: `New job application: ${data.jobTitle || "Job"}`,
        html: mailLayout({
          title: "New job application",
          preheader: `${data.applicantName || "Someone"} applied for ${data.jobTitle || "a role"}.`,
          body: `
            <p>A new application was submitted.</p>
            ${detailRows([
              ["Role", escapeHtml(data.jobTitle || "")],
              ["Applicant", escapeHtml(data.applicantName || "")],
              ["Email", escapeHtml(data.applicantEmail || "")],
              ["Phone", escapeHtml(data.phone || "")],
              ["Notes", escapeHtml(data.notes || "")],
            ])}
          `,
          ctaLabel: "Open admin",
          ctaUrl: `${site}/admin/dashboard`,
        }),
      };

    case "scholarship-application-received":
      return {
        subject: `Scholarship application received: ${data.scholarshipTitle || "Scholarship"}`,
        html: mailLayout({
          title: "Scholarship application received",
          preheader: "We received your scholarship application.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>We received your application for <strong>${escapeHtml(data.scholarshipTitle || "this scholarship")}</strong>.</p>
            ${detailRows([
              ["Scholarship", escapeHtml(data.scholarshipTitle || "")],
              ["Submitted", escapeHtml(data.submittedAt || new Date().toLocaleString())],
            ])}
            <p>Keep an eye on your inbox for updates from the awards team.</p>
          `,
          ctaLabel: "View scholarships",
          ctaUrl: `${site}/scholarships`,
        }),
      };

    case "scholarship-application-admin":
      return {
        subject: `New scholarship application: ${data.scholarshipTitle || "Scholarship"}`,
        html: mailLayout({
          title: "New scholarship application",
          preheader: `${data.applicantName || "Someone"} applied for a scholarship.`,
          body: `
            <p>A new scholarship application was submitted.</p>
            ${detailRows([
              ["Scholarship", escapeHtml(data.scholarshipTitle || "")],
              ["Applicant", escapeHtml(data.applicantName || "")],
              ["Email", escapeHtml(data.applicantEmail || "")],
              ["Program", escapeHtml(data.program || "")],
              ["Notes", escapeHtml(data.notes || "")],
            ])}
          `,
          ctaLabel: "Open admin",
          ctaUrl: `${site}/admin/dashboard`,
        }),
      };

    case "event-rsvp-confirmation":
      return {
        subject: `RSVP confirmed: ${data.eventTitle || "Event"}`,
        html: mailLayout({
          title: "RSVP confirmed",
          preheader: `You’re registered for ${data.eventTitle || "the event"}.`,
          body: `
            <p>${greeting(firstname)}</p>
            <p>You’re registered for <strong>${escapeHtml(data.eventTitle || "this event")}</strong>.</p>
            ${detailRows([
              ["When", escapeHtml(data.when || data.date || "")],
              ["Where", escapeHtml(data.where || data.location || "")],
              ["Guests", escapeHtml(data.guests || "")],
            ])}
            <p>Add it to your calendar and we look forward to seeing you there.</p>
          `,
          ctaLabel: "View event",
          ctaUrl: data.eventUrl || `${site}/events`,
        }),
      };

    case "donation-thank-you":
      return {
        subject: `Thank you for supporting ${brand.name}`,
        html: mailLayout({
          title: "Thank you for your support",
          preheader: "Your contribution was received.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>Thank you for supporting <strong>${escapeHtml(data.campaignTitle || "our campaign")}</strong>. Your generosity helps Nutrition &amp; Food Science students and alumni thrive.</p>
            ${detailRows([
              ["Campaign", escapeHtml(data.campaignTitle || "")],
              ["Amount", escapeHtml(data.amount || "")],
              ["Reference", escapeHtml(data.reference || "")],
            ])}
          `,
          ctaLabel: "See impact",
          ctaUrl: `${site}/support`,
        }),
      };

    case "marketplace-enquiry-received":
      return {
        subject: `Enquiry sent: ${data.listingTitle || "Marketplace listing"}`,
        html: mailLayout({
          title: "Enquiry sent",
          preheader: "Your marketplace enquiry was delivered.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>Your enquiry about <strong>${escapeHtml(data.listingTitle || "this listing")}</strong> was sent to the seller.</p>
            ${detailRows([["Message", escapeHtml(data.message || "")]])}
          `,
          ctaLabel: "Back to marketplace",
          ctaUrl: `${site}/marketplace`,
        }),
      };

    case "marketplace-enquiry-seller":
      return {
        subject: `New enquiry: ${data.listingTitle || "Marketplace listing"}`,
        html: mailLayout({
          title: "New marketplace enquiry",
          preheader: `${data.buyerName || "Someone"} enquired about your listing.`,
          body: `
            <p>${greeting(data.sellerName)}</p>
            <p>You received a new enquiry on <strong>${escapeHtml(data.listingTitle || "your listing")}</strong>.</p>
            ${detailRows([
              ["From", escapeHtml(data.buyerName || "")],
              ["Email", escapeHtml(data.buyerEmail || "")],
              ["Phone", escapeHtml(data.buyerPhone || "")],
              ["Message", escapeHtml(data.message || "")],
            ])}
          `,
          ctaLabel: "View listing",
          ctaUrl: data.listingUrl || `${site}/marketplace`,
        }),
      };

    case "community-join-confirmation":
      return {
        subject: `Welcome to ${data.groupName || "the community"}`,
        html: mailLayout({
          title: "You’re in",
          preheader: `You joined ${data.groupName || "a community group"}.`,
          body: `
            <p>${greeting(firstname)}</p>
            <p>You joined <strong>${escapeHtml(data.groupName || "the community group")}</strong>. You can now see members, events, and group updates.</p>
          `,
          ctaLabel: "Open community",
          ctaUrl: data.groupUrl || `${site}/community`,
        }),
      };

    case "mentorship-request-received":
      return {
        subject: "Mentorship request sent",
        html: mailLayout({
          title: "Mentorship request sent",
          preheader: "Your mentor request was submitted.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>Your mentorship request to <strong>${escapeHtml(data.mentorName || "your mentor")}</strong> was submitted. We’ll notify you when they respond.</p>
            ${detailRows([["Message", escapeHtml(data.message || "")]])}
          `,
          ctaLabel: "Browse mentors",
          ctaUrl: `${site}/alumni/mentors`,
        }),
      };

    case "mentorship-request-mentor":
      return {
        subject: `New mentorship request from ${data.menteeName || "a member"}`,
        html: mailLayout({
          title: "New mentorship request",
          preheader: `${data.menteeName || "A member"} asked you to mentor them.`,
          body: `
            <p>${greeting(data.mentorName)}</p>
            <p><strong>${escapeHtml(data.menteeName || "A member")}</strong> requested mentorship.</p>
            ${detailRows([
              ["Email", escapeHtml(data.menteeEmail || "")],
              ["Focus", escapeHtml(data.focus || "")],
              ["Message", escapeHtml(data.message || "")],
            ])}
          `,
          ctaLabel: "Open dashboard",
          ctaUrl: `${site}/dashboard`,
        }),
      };

    case "alumni-connect-request":
      return {
        subject: `${data.requesterName || "Someone"} wants to connect`,
        html: mailLayout({
          title: "New connection request",
          preheader: `${data.requesterName || "A member"} wants to connect with you.`,
          body: `
            <p>${greeting(firstname)}</p>
            <p><strong>${escapeHtml(data.requesterName || "A member")}</strong> wants to connect on ${brand.name}.</p>
            ${detailRows([
              ["Email", escapeHtml(data.requesterEmail || "")],
              ["Message", escapeHtml(data.message || "")],
            ])}
          `,
          ctaLabel: "View profile",
          ctaUrl: data.profileUrl || `${site}/alumni`,
        }),
      };

    case "admin-invite":
      return {
        subject: `You're invited to manage ${brand.name}`,
        html: mailLayout({
          title: "Admin invitation",
          preheader: "You have been invited as an administrator.",
          body: `
            <p>${greeting(firstname)}</p>
            <p>You have been invited to manage ${brand.name}${data.roleName ? ` as <strong>${escapeHtml(data.roleName)}</strong>` : ""}.</p>
            <p>Sign in with the email address this invitation was sent to.</p>
            ${data.temporaryPassword ? `<p>Temporary password: <strong>${escapeHtml(data.temporaryPassword)}</strong></p><p>Change it after your first sign-in.</p>` : ""}
          `,
          ctaLabel: "Open admin",
          ctaUrl: `${site}/admin/dashboard`,
        }),
      };

    case "status-update":
      return {
        subject: `${data.subjectTitle || "Update"}: ${data.status || "status changed"}`,
        html: mailLayout({
          title: data.heading || "Status update",
          preheader: `${data.subjectTitle || "Your submission"} is now ${data.status || "updated"}.`,
          body: `
            <p>${greeting(firstname)}</p>
            <p>${escapeHtml(data.message || `Your submission “${data.subjectTitle || ""}” is now marked as ${data.status || "updated"}.`)}</p>
            ${detailRows([
              ["Item", escapeHtml(data.subjectTitle || "")],
              ["Status", escapeHtml(data.status || "")],
              ["Note", escapeHtml(data.note || "")],
            ])}
          `,
          ctaLabel: data.ctaLabel || "Open dashboard",
          ctaUrl: data.ctaUrl || `${site}/dashboard`,
        }),
      };

    default:
      return {
        subject: brand.name,
        html: mailLayout({
          title: brand.name,
          body: `<p>${greeting(firstname)}</p><p>No template content was provided.</p>`,
        }),
      };
  }
}

/** Catalog for docs / admin reference */
export const MAIL_CATALOG: Array<{
  id: MailTemplateId;
  name: string;
  trigger: string;
  audience: string;
}> = [
  { id: "welcome", name: "Welcome / signup", trigger: "User registers (student, alumni, or admin)", audience: "New member" },
  { id: "otp", name: "Email verification OTP", trigger: "Signup or re-verify email", audience: "New / unverified member" },
  { id: "password-reset", name: "Password reset request", trigger: "Forgot password", audience: "Member" },
  { id: "password-reset-success", name: "Password reset success", trigger: "Password successfully changed", audience: "Member" },
  { id: "newsletter-welcome", name: "Newsletter subscription", trigger: "Footer / newsletter subscribe", audience: "Subscriber" },
  { id: "job-application-received", name: "Job application received", trigger: "POST /jobs/:id/applications", audience: "Applicant" },
  { id: "job-application-admin", name: "Job application (admin)", trigger: "Same as above", audience: "Admin / careers team" },
  { id: "scholarship-application-received", name: "Scholarship application received", trigger: "POST /scholarships/:id/applications", audience: "Applicant" },
  { id: "scholarship-application-admin", name: "Scholarship application (admin)", trigger: "Same as above", audience: "Admin / awards team" },
  { id: "event-rsvp-confirmation", name: "Event RSVP confirmation", trigger: "POST /events/:id/rsvp", audience: "Attendee" },
  { id: "donation-thank-you", name: "Donation thank you", trigger: "POST /support/:id/donations", audience: "Donor" },
  { id: "marketplace-enquiry-received", name: "Marketplace enquiry confirmation", trigger: "POST /marketplace/:id/enquiries", audience: "Buyer" },
  { id: "marketplace-enquiry-seller", name: "Marketplace enquiry (seller)", trigger: "Same as above", audience: "Seller / admin" },
  { id: "community-join-confirmation", name: "Community / year-group join", trigger: "POST join on community or year-groups", audience: "Member" },
  { id: "mentorship-request-received", name: "Mentorship request confirmation", trigger: "POST /alumni/mentors/:id/requests", audience: "Mentee" },
  { id: "mentorship-request-mentor", name: "Mentorship request (mentor)", trigger: "Same as above", audience: "Mentor" },
  { id: "alumni-connect-request", name: "Alumni connect request", trigger: "POST /alumni/profiles/:id/connect", audience: "Alumni profile owner" },
  { id: "admin-invite", name: "Admin invitation", trigger: "Admin creates access user", audience: "New admin" },
  { id: "status-update", name: "Generic status update", trigger: "Admin reviews application / request", audience: "Member" },
];
