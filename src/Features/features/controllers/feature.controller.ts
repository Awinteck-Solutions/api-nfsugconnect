import { Request, Response } from "express";
import FeatureRecord from "../schema/feature-record.schema";
import Interaction from "../schema/interaction.schema";
import { featureDefinitions } from "../feature.registry";
import { sendMail } from "../../../helpers/emailer";
import {
  broadcastFeatureRecord,
  BroadcastAudience,
  isBroadcastable,
} from "../../../helpers/mail/broadcast.service";

function safeMail(promise: Promise<any>) {
  return promise.catch((err) => {
    console.error("[mail] non-blocking failure", err?.message || err);
  });
}

function notifyAdmin() {
  return process.env.MAIL_NOTIFY_EMAIL || process.env.MAIL_USERNAME || "";
}

function actorName(body: any, user: any) {
  return (
    body?.fullName ||
    body?.name ||
    [user?.firstname, user?.lastname].filter(Boolean).join(" ") ||
    "Member"
  );
}

function actorEmail(body: any, user: any) {
  return body?.email || user?.email || "";
}

function titleOf(record: any) {
  const data = record?.data || {};
  return data.title || data.name || data.headline || record?.slug || "Item";
}

async function notifyActionMails(
  feature: string,
  action: string,
  record: any,
  body: any,
  user: any
) {
  const firstname = (actorName(body, user) || "").split(" ")[0];
  const email = actorEmail(body, user);
  const title = titleOf(record);
  const admin = notifyAdmin();

  if (action === "applications" && feature === "jobs" && email) {
    safeMail(
      sendMail(email, "job-application-received", {
        firstname,
        jobTitle: title,
        company: record?.data?.company || record?.data?.employer || "",
      })
    );
    if (admin) {
      safeMail(
        sendMail(admin, "job-application-admin", {
          jobTitle: title,
          applicantName: actorName(body, user),
          applicantEmail: email,
          phone: body?.phone || "",
          notes: body?.coverLetter || body?.message || body?.notes || "",
        })
      );
    }
  }

  if (action === "applications" && feature === "scholarships" && email) {
    safeMail(
      sendMail(email, "scholarship-application-received", {
        firstname,
        scholarshipTitle: title,
      })
    );
    if (admin) {
      safeMail(
        sendMail(admin, "scholarship-application-admin", {
          scholarshipTitle: title,
          applicantName: actorName(body, user),
          applicantEmail: email,
          program: body?.program || user?.program || "",
          notes: body?.message || body?.notes || "",
        })
      );
    }
  }

  if (action === "rsvp" && email) {
    safeMail(
      sendMail(email, "event-rsvp-confirmation", {
        firstname,
        eventTitle: title,
        when: record?.data?.date || record?.data?.when || record?.data?.startsAt || "",
        where: record?.data?.location || record?.data?.venue || record?.data?.where || "",
        guests: body?.guests || body?.partySize || "",
        eventUrl: `${process.env.WEB_URL || "https://nfsugnetwork.com"}/events/${record?.slug || ""}`,
      })
    );
  }

  if (action === "donations" && email) {
    safeMail(
      sendMail(email, "donation-thank-you", {
        firstname: body?.anonymous ? "" : firstname,
        campaignTitle: title,
        amount: body?.amount,
        reference: body?.reference || "",
      })
    );
  }

  if (action === "enquiries" && feature === "marketplace") {
    if (email) {
      safeMail(
        sendMail(email, "marketplace-enquiry-received", {
          firstname,
          listingTitle: title,
          message: body?.message || "",
        })
      );
    }
    const sellerEmail = record?.data?.contactEmail || record?.data?.sellerEmail || admin;
    if (sellerEmail) {
      safeMail(
        sendMail(sellerEmail, "marketplace-enquiry-seller", {
          sellerName: record?.data?.sellerName || record?.data?.ownerName || "",
          listingTitle: title,
          buyerName: actorName(body, user),
          buyerEmail: email,
          buyerPhone: body?.phone || "",
          message: body?.message || "",
          listingUrl: `${process.env.WEB_URL || "https://nfsugnetwork.com"}/marketplace/${record?.slug || ""}`,
        })
      );
    }
  }

  if (action === "join" && email) {
    safeMail(
      sendMail(email, "community-join-confirmation", {
        firstname,
        groupName: title,
        groupUrl: `${process.env.WEB_URL || "https://nfsugnetwork.com"}/${
          feature === "year-groups" ? "alumni/year-groups" : "community"
        }/${record?.slug || ""}`,
      })
    );
  }

  if (action === "requests" && feature === "mentors") {
    if (email) {
      safeMail(
        sendMail(email, "mentorship-request-received", {
          firstname,
          mentorName: title,
          message: body?.message || "",
        })
      );
    }
    const mentorEmail = record?.data?.email || record?.data?.contactEmail || admin;
    if (mentorEmail) {
      safeMail(
        sendMail(mentorEmail, "mentorship-request-mentor", {
          mentorName: title,
          menteeName: actorName(body, user),
          menteeEmail: email,
          focus: body?.focus || body?.topic || "",
          message: body?.message || "",
        })
      );
    }
  }

  if (action === "connect" && feature === "alumni-profiles") {
    const profileEmail = record?.data?.email || record?.data?.contactEmail;
    if (profileEmail) {
      safeMail(
        sendMail(profileEmail, "alumni-connect-request", {
          firstname: (record?.data?.name || title || "").split(" ")[0],
          requesterName: actorName(body, user),
          requesterEmail: email,
          message: body?.message || "",
          profileUrl: `${process.env.WEB_URL || "https://nfsugnetwork.com"}/alumni/${record?.slug || ""}`,
        })
      );
    }
  }
}


function present(record: any) {
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data : { value: record.data };
  return {
    ...data,
    id: record._id,
    feature: record.feature,
    slug: record.slug,
    postedAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

const computedKeys = [
  "id",
  "_id",
  "feature",
  "postedAt",
  "updatedAt",
  "notifySubscribers",
  "broadcastAudience",
  "forceBroadcast",
];

function recordData(body: any) {
  const data = { ...(body || {}) };
  computedKeys.forEach((key) => delete data[key]);
  return data;
}

function wantsBroadcast(body: any) {
  const value = body?.notifySubscribers;
  return value === true || value === "true" || value === 1 || value === "1";
}

function broadcastAudience(body: any): BroadcastAudience {
  const value = String(body?.broadcastAudience || "all").toLowerCase();
  if (value === "subscribers" || value === "members") return value;
  return "all";
}

async function maybeBroadcast(feature: string, record: any, body: any, options: { force?: boolean } = {}) {
  if (!isBroadcastable(feature) || !record) return null;
  if (record?.data?.visibility === "draft") return null;
  if (!wantsBroadcast(body) && !options.force) return null;
  return broadcastFeatureRecord({
    feature,
    record,
    audience: broadcastAudience(body),
    force: Boolean(options.force || body?.forceBroadcast),
  });
}

function isDraft(record: any) {
  return record?.data?.visibility === "draft";
}

// Drafts are only returned to admins who explicitly ask for them, so the public site never shows them
function wantsDrafts(req: Request) {
  return Boolean(req.query.drafts) && req["currentUser"]?.role === "ADMIN";
}

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `item-${Date.now()}`;
}

export class FeatureController {
  static manifest(req: Request, res: Response) {
    return res.json({
      status: true,
      message: "Feature APIs",
      response: featureDefinitions,
    });
  }

  static async list(feature: string, req: Request, res: Response) {
    try {
      const [items, config] = await Promise.all([
        FeatureRecord.find({ feature, kind: "item" }).sort({ createdAt: 1 }),
        FeatureRecord.findOne({ feature, kind: "config", slug: "main" }),
      ]);
      const query = String(req.query.q || "").toLowerCase();
      const filters = { ...req.query };
      delete filters.q;
      delete filters.drafts;
      const includeDrafts = wantsDrafts(req);
      let response = items.filter((item) => includeDrafts || !isDraft(item)).map(present);
      if (query) {
        response = response.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
      }
      Object.entries(filters).forEach(([key, value]) => {
        if (!value) return;
        response = response.filter((item) => String(item[key] || "").toLowerCase() === String(value).toLowerCase());
      });
      return res.json({
        status: true,
        message: `${feature} loaded`,
        response,
        settings: config?.data || {},
        total: response.length,
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async detail(feature: string, req: Request, res: Response) {
    try {
      const record = await FeatureRecord.findOne({ feature, kind: "item", slug: req.params.slug });
      if (!record || (isDraft(record) && !wantsDrafts(req))) return res.status(404).json({ status: false, message: "Not found" });
      return res.json({ status: true, message: `${feature} loaded`, response: present(record) });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async settings(feature: string, req: Request, res: Response) {
    try {
      const record = await FeatureRecord.findOne({ feature, kind: "config", slug: "main" });
      return res.json({ status: true, message: `${feature} settings loaded`, response: record?.data || {} });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async updateSettings(feature: string, req: Request, res: Response) {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ status: false, message: "Settings must be an object" });
      }
      const record = await FeatureRecord.findOneAndUpdate(
        { feature, kind: "config", slug: "main" },
        { data: req.body },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return res.json({ status: true, message: `${feature} settings saved`, response: record.data || {} });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async create(feature: string, req: Request, res: Response) {
    try {
      const slug = slugify(req.body.slug || req.body.title || req.body.name || req.body.id);
      const record = await FeatureRecord.findOneAndUpdate(
        { feature, kind: "item", slug },
        { data: recordData(req.body) },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const broadcast = await maybeBroadcast(feature, record, req.body);
      return res.status(201).json({
        status: true,
        message: `${feature} saved`,
        response: present(record),
        broadcast: broadcast || undefined,
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async update(feature: string, req: Request, res: Response) {
    try {
      const record = await FeatureRecord.findOne({ feature, kind: "item", slug: req.params.slug });
      if (!record) return res.status(404).json({ status: false, message: "Not found" });
      if (req.body.slug) record.slug = slugify(req.body.slug);
      record.data = { ...(record.data || {}), ...recordData(req.body), slug: record.slug };
      record.markModified("data");
      await record.save();
      const broadcast = await maybeBroadcast(feature, record, req.body);
      return res.json({
        status: true,
        message: `${feature} updated`,
        response: present(record),
        broadcast: broadcast || undefined,
      });
    } catch (error) {
      if (error && error.code === 11000) return res.status(409).json({ status: false, message: "Slug already exists" });
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async broadcast(feature: string, req: Request, res: Response) {
    try {
      if (!isBroadcastable(feature)) {
        return res.status(400).json({ status: false, message: "This feature does not support email broadcasts" });
      }
      const record = await FeatureRecord.findOne({ feature, kind: "item", slug: req.params.slug });
      if (!record) return res.status(404).json({ status: false, message: "Not found" });
      if (record.data?.visibility === "draft") {
        return res.status(400).json({ status: false, message: "Publish the record before broadcasting" });
      }
      const result = await broadcastFeatureRecord({
        feature,
        record,
        audience: broadcastAudience(req.body || {}),
        force: true,
      });
      return res.json({
        status: true,
        message: result.skipped
          ? `Broadcast skipped (${result.reason})`
          : `Broadcast sent to ${result.sent} recipient${result.sent === 1 ? "" : "s"}`,
        response: present(record),
        broadcast: result,
      });
    } catch (error) {
      console.error("[broadcast]", error);
      return res.status(500).json({ status: false, message: "Unable to send broadcast" });
    }
  }

  static async remove(feature: string, req: Request, res: Response) {
    try {
      const record = await FeatureRecord.findOneAndDelete({ feature, kind: "item", slug: req.params.slug });
      if (!record) return res.status(404).json({ status: false, message: "Not found" });
      return res.json({ status: true, message: `${feature} deleted` });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async action(feature: string, action: string, req: Request, res: Response) {
    try {
      const allowed = featureDefinitions.find((item) => item.feature === feature)?.actions || [];
      if (!allowed.includes(action)) return res.status(404).json({ status: false, message: "Unknown action" });

      const record = await FeatureRecord.findOne({ feature, kind: "item", slug: req.params.slug });
      if (!record && (action === "donations" || action === "join")) {
        return res.status(404).json({ status: false, message: "Not found" });
      }

      if (record && action === "donations") {
        const amount = Number(req.body.amount);
        if (!amount || amount < 1) return res.status(400).json({ status: false, message: "A valid donation amount is required" });
        if (!req.body.email) return res.status(400).json({ status: false, message: "Email is required" });
        record.data.raised = Number(record.data.raised || 0) + amount;
        record.data.donorCount = Number(record.data.donorCount || 0) + 1;
        const anonymous = Boolean(req.body.anonymous);
        const supporters = Array.isArray(record.data.recentSupporters) ? record.data.recentSupporters : [];
        record.data.recentSupporters = [
          {
            id: `donation-${Date.now().toString(36)}`,
            name: anonymous ? "Anonymous Supporter" : String(req.body.fullName || "Supporter").trim(),
            amount,
            anonymous,
            date: new Date().toISOString(),
          },
          ...supporters,
        ];
        if (record.data.goal) {
          record.data.percent = Math.min(100, Math.round((record.data.raised / record.data.goal) * 1000) / 10);
        }
        record.markModified("data");
        await record.save();
      }

      if (record && action === "join") {
        record.data.joined = true;
        record.data.isJoined = true;
        record.data.joinStatus = "Joined";
        record.data.members = Number(record.data.members || record.data.memberCount || 0) + 1;
        record.data.memberCount = record.data.members;
        record.markModified("data");
        await record.save();
      }

      const interaction = await Interaction.create({
        feature,
        action,
        targetSlug: req.params.slug,
        actorId: req["currentUser"]?.id || null,
        payload: req.body || {},
      });

      await notifyActionMails(feature, action, record, req.body || {}, req["currentUser"]);

      return res.status(201).json({
        status: true,
        message: `${action} saved`,
        response: { id: interaction._id, item: record ? present(record) : null },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async newsletter(req: Request, res: Response) {
    try {
      if (!req.body.email) return res.status(400).json({ status: false, message: "Email is required" });
      const email = String(req.body.email).trim().toLowerCase();
      const interaction = await Interaction.create({
        feature: "newsletter",
        action: "subscribe",
        payload: { email },
        actorId: req["currentUser"]?.id || null,
      });
      safeMail(sendMail(email, "newsletter-welcome", { email, firstname: req.body.name || "" }));
      return res.status(201).json({ status: true, message: "Subscribed", response: { id: interaction._id } });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
