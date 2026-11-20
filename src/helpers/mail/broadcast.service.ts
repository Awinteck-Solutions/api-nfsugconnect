import Interaction from "../../Features/features/schema/interaction.schema";
import User from "../../Features/auth/schema/user.schema";
import { Status } from "../../Features/auth/enums/status.enum";
import { sendMail, MailTemplateId } from "./emailer";
import { brand } from "./layout";

export const BROADCASTABLE = ["news", "events", "scholarships", "jobs"] as const;
export type BroadcastFeature = (typeof BROADCASTABLE)[number];

export type BroadcastAudience = "subscribers" | "members" | "all";

const templateByFeature: Record<BroadcastFeature, MailTemplateId> = {
  news: "broadcast-news",
  events: "broadcast-event",
  scholarships: "broadcast-scholarship",
  jobs: "broadcast-job",
};

const pathByFeature: Record<BroadcastFeature, string> = {
  news: "/news",
  events: "/events",
  scholarships: "/scholarships",
  jobs: "/jobs",
};

function normalizeEmail(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stripHtml(value: unknown) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value: unknown, max = 220) {
  const text = stripHtml(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

export function isBroadcastable(feature: string): feature is BroadcastFeature {
  return (BROADCASTABLE as readonly string[]).includes(feature);
}

export function broadcastTemplate(feature: BroadcastFeature): MailTemplateId {
  return templateByFeature[feature];
}

export function recordBroadcastPayload(feature: BroadcastFeature, record: any) {
  const data = record?.data || {};
  const site = process.env.WEB_URL || brand.siteUrl;
  const slug = record?.slug || data.slug || "";
  const title = data.title || data.name || data.headline || slug || "Update";
  const summary =
    excerpt(data.summary || data.excerpt || data.description || data.body || data.content || data.details || "") ||
    `New ${feature.replace(/-/g, " ")} from ${brand.name}.`;

  return {
    title,
    summary,
    feature,
    when: data.date || data.when || data.startsAt || data.deadline || data.postedAt || "",
    where: data.location || data.venue || data.where || data.company || data.employer || data.provider || "",
    company: data.company || data.employer || "",
    deadline: data.deadline || data.closesAt || data.applicationDeadline || "",
    category: data.category || data.type || data.tag || "",
    ctaUrl: `${site}${pathByFeature[feature]}/${slug}`,
    ctaLabel:
      feature === "jobs"
        ? "View job"
        : feature === "events"
          ? "View event"
          : feature === "scholarships"
            ? "View scholarship"
            : "Read article",
  };
}

export async function collectBroadcastRecipients(audience: BroadcastAudience = "all") {
  const emails = new Set<string>();

  if (audience === "subscribers" || audience === "all") {
    const subs = await Interaction.find({ feature: "newsletter", action: "subscribe" })
      .select("payload.email")
      .lean();
    for (const row of subs) {
      const email = normalizeEmail((row as any)?.payload?.email);
      if (isEmail(email)) emails.add(email);
    }
  }

  if (audience === "members" || audience === "all") {
    const users = await User.find({
      status: Status.ACTIVE,
      role: { $in: ["STUDENT", "ALUMNI"] },
      email: { $exists: true, $ne: "" },
    })
      .select("email")
      .lean();
    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (isEmail(email)) emails.add(email);
    }
  }

  return Array.from(emails);
}

export async function broadcastFeatureRecord(options: {
  feature: BroadcastFeature;
  record: any;
  audience?: BroadcastAudience;
  force?: boolean;
}) {
  const { feature, record, audience = "all", force = false } = options;
  if (!record) return { sent: 0, skipped: true, reason: "missing-record" };
  if (record?.data?.visibility === "draft") {
    return { sent: 0, skipped: true, reason: "draft" };
  }
  if (!force && record?.data?.broadcastAt) {
    return { sent: 0, skipped: true, reason: "already-broadcast", broadcastAt: record.data.broadcastAt };
  }

  const recipients = await collectBroadcastRecipients(audience);
  if (!recipients.length) {
    return { sent: 0, skipped: true, reason: "no-recipients" };
  }

  const template = broadcastTemplate(feature);
  const payload = recordBroadcastPayload(feature, record);
  let sent = 0;
  let failed = 0;

  // Sequential with light batching to avoid SMTP rate limits
  const chunkSize = 8;
  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((email) => sendMail(email, template, { ...payload, email }))
    );
    for (const result of results) {
      if (result.status === "fulfilled") sent += 1;
      else failed += 1;
    }
  }

  record.data = { ...(record.data || {}), broadcastAt: new Date().toISOString(), broadcastCount: sent };
  record.markModified?.("data");
  if (typeof record.save === "function") await record.save();

  return {
    sent,
    failed,
    total: recipients.length,
    skipped: false,
    template,
    broadcastAt: record.data.broadcastAt,
  };
}
