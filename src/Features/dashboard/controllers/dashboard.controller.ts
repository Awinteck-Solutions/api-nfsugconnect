import { Request, Response } from "express";
import User from "../../auth/schema/user.schema";
import FeatureRecord from "../../features/schema/feature-record.schema";
import Interaction from "../../features/schema/interaction.schema";
import { Roles } from "../../auth/enums/roles.enum";
import { interactionsFor } from "../../access/controllers/admin-data.controller";

const highlightFields = ["date", "time", "location", "campus", "company", "type", "category", "deadline", "amount", "salary", "format", "role", "position", "year", "goal", "raised"];

const highlightsByRole = {
  [Roles.STUDENT]: [
    { feature: "events", label: "Upcoming events" },
    { feature: "scholarships", label: "Scholarships" },
    { feature: "jobs", label: "Jobs & internships" },
    { feature: "resources", label: "Study resources" },
  ],
  [Roles.ALUMNI]: [
    { feature: "events", label: "Upcoming events" },
    { feature: "year-groups", label: "Year groups" },
    { feature: "jobs", label: "Career opportunities" },
    { feature: "support", label: "Giving campaigns" },
  ],
};

function slimRecord(record: any) {
  const data = record.data || {};
  const text = data.excerpt || data.description || data.summary || data.bio || "";
  const meta: any = {};
  highlightFields.forEach((key) => {
    if (data[key] !== undefined && data[key] !== null && data[key] !== "" && typeof data[key] !== "object") meta[key] = data[key];
  });
  return {
    slug: record.slug,
    title: data.title || data.name || data.label || record.slug,
    image: data.image || data.cover || data.avatar || data.thumbnail || "",
    text: String(text).slice(0, 180),
    meta,
  };
}

function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth() + 1}`, label: date.toLocaleString("en", { month: "short" }), start: date };
  });
}


const leaderRole = /admin|moderator|host|lead|\brep\b/i;

function presentRecord(record: any) {
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

function personKey(value: string) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function resolveMembership(user: any, community: any, yearGroup: any) {
  const fullName = personKey([user.firstname, user.lastname].filter(Boolean).join(" "));
  const members = Array.isArray(community?.members) ? community.members : [];
  const member = members.find((item: any) => {
    if (user.email && item.email && personKey(item.email) === personKey(user.email)) return true;
    if (user.handle && item.handle && personKey(item.handle) === personKey(user.handle)) return true;
    if (fullName && item.name && personKey(item.name) === fullName) return true;
    return false;
  }) || null;
  const adminNames = Array.isArray(yearGroup?.admins) ? yearGroup.admins.map(personKey) : [];
  const isLeader = Boolean(
    (member?.role && leaderRole.test(String(member.role)))
    || (fullName && adminNames.includes(fullName))
  );
  return {
    member,
    isLeader,
    role: member?.role || (isLeader ? "Admin" : "Member"),
  };
}

async function loadYearGroupBundle(user: any) {
  const yearGroups = await FeatureRecord.find({ feature: "year-groups", kind: "item" });
  let yearRecord = null as any;
  if (user.yearGroupSlug) {
    yearRecord = yearGroups.find((item) => item.slug === user.yearGroupSlug) || null;
  }
  if (!yearRecord && user.classYear) {
    yearRecord = yearGroups.find((item) => Number(item.data?.year) === Number(user.classYear)) || null;
  }
  if (!yearRecord) return null;

  const yearGroup = presentRecord(yearRecord);
  const communitySlug = yearGroup.communitySlug || yearGroup.slug;
  const communityRecord = await FeatureRecord.findOne({ feature: "community", kind: "item", slug: communitySlug });
  if (!communityRecord) {
    return { yearGroup, community: null, membership: { member: null, isLeader: false, role: "Member" }, upcomingEvents: [] };
  }
  const community = presentRecord(communityRecord);
  const eventSlugs = Array.isArray(community.eventSlugs) ? community.eventSlugs : [];
  const eventRecords = eventSlugs.length
    ? await FeatureRecord.find({ feature: "events", kind: "item", slug: { $in: eventSlugs } })
    : [];
  const bySlug = new Map(eventRecords.map((item) => [item.slug, presentRecord(item)]));
  const upcomingEvents = eventSlugs.map((slug: string) => bySlug.get(slug)).filter(Boolean);
  const membership = resolveMembership(user, community, yearGroup);
  return { yearGroup, community: { ...community, upcomingEvents }, membership, upcomingEvents };
}

export class DashboardController {
  static async currentUserDashboard(req: Request, res: Response) {
    try {
      const currentUser = req["currentUser"];
      const user = await User.findById(currentUser.id).select("-password -otp -__v");
      if (!user) {
        return res.status(404).json({ status: false, message: "User not found" });
      }

      const activity = await interactionsFor({ $or: [{ actorId: user._id }, { "payload.email": user.email }] }, 50);
      const byAction = activity.reduce((totals, item) => {
        totals[item.action] = (totals[item.action] || 0) + 1;
        return totals;
      }, {});
      const donated = activity
        .filter((item) => item.action === "donations")
        .reduce((total, item) => total + (Number(item.payload?.amount) || 0), 0);

      const sections = highlightsByRole[user.role] || highlightsByRole[Roles.STUDENT];
      const alsoAlumni = user.role === Roles.ALUMNI || Boolean((user as any).alsoAlumni);
      let highlightSections = sections;
      if (user.role === Roles.STUDENT && alsoAlumni) {
        const alumniSections = highlightsByRole[Roles.ALUMNI] || [];
        const seen = new Set(sections.map((section) => section.feature));
        highlightSections = [...sections, ...alumniSections.filter((section) => !seen.has(section.feature))];
      }
      const highlights = await Promise.all(highlightSections.map(async (section) => {
        const records = await FeatureRecord.find({
          feature: section.feature,
          kind: "item",
          $or: [{ "data.visibility": { $exists: false } }, { "data.visibility": { $ne: "draft" } }],
        }).sort({ updatedAt: -1 }).limit(4);
        return { ...section, items: records.map(slimRecord) };
      }));

      const cards = [
        { key: "applications", label: "Applications", value: byAction.applications || 0 },
        { key: "rsvp", label: "Event RSVPs", value: byAction.rsvp || 0 },
        { key: "connections", label: "Connections & requests", value: (byAction.connect || 0) + (byAction.requests || 0) + (byAction.join || 0) },
        { key: "donations", label: "Donated", value: donated, currency: true },
      ];

      const yearGroupBundle = await loadYearGroupBundle(user);

      return res.status(200).json({
        status: true,
        message: "Dashboard loaded",
        response: {
          user,
          role: user.role,
          alsoAlumni,
          cards,
          activity,
          highlights,
          yearGroup: yearGroupBundle?.yearGroup || null,
          community: yearGroupBundle?.community || null,
          membership: yearGroupBundle?.membership || null,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }


  static async updateYearGroupCommunity(req: Request, res: Response) {
    try {
      const currentUser = req["currentUser"];
      const user = await User.findById(currentUser.id).select("-password -otp -__v");
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      const bundle = await loadYearGroupBundle(user);
      if (!bundle?.community) return res.status(404).json({ status: false, message: "No year group community found" });
      if (!bundle.membership?.isLeader) return res.status(403).json({ status: false, message: "Only group leaders can update settings" });

      const record = await FeatureRecord.findOne({ feature: "community", kind: "item", slug: bundle.community.slug });
      if (!record) return res.status(404).json({ status: false, message: "Community not found" });

      const allowed = ["settings", "hostName", "hostDisplayName", "hostAvatar", "location", "longDescription", "description", "image", "joinStatus"];
      const next = { ...(record.data || {}) };
      allowed.forEach((key) => {
        if (req.body[key] !== undefined) next[key] = req.body[key];
      });
      if (req.body.settings && typeof req.body.settings === "object") {
        next.settings = { ...(record.data?.settings || {}), ...req.body.settings };
      }
      record.data = next;
      record.markModified("data");
      await record.save();
      const community = presentRecord(record);
      return res.json({
        status: true,
        message: "Community settings updated",
        response: {
          community: { ...community, upcomingEvents: bundle.upcomingEvents },
          membership: bundle.membership,
          yearGroup: bundle.yearGroup,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async adminDashboard(req: Request, res: Response) {
    try {
      const months = lastMonths(6);
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const since30 = new Date(now - 30 * day);
      const since60 = new Date(now - 60 * day);
      const members = { role: { $in: [Roles.STUDENT, Roles.ALUMNI] } };

      const [
        totalUsers, students, alumni, admins, activeMembers,
        records, recordsUpdated30, totalSubmissions, newSubmissions,
        recentUsers, recentSubmissions,
        signupRows, submissionRows, actionRows, statusRows,
        dailySubmissions, dailySignups,
        members30, membersPrev, submissions30, submissionsPrev,
        donationRows, topRows, newsletter, campaigns, recordRows, recentlyUpdated,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: Roles.STUDENT }),
        User.countDocuments({ role: Roles.ALUMNI }),
        User.countDocuments({ role: Roles.ADMIN }),
        Interaction.distinct("actorId", { createdAt: { $gte: since30 }, actorId: { $ne: null } }),
        FeatureRecord.countDocuments({ kind: "item" }),
        FeatureRecord.countDocuments({ kind: "item", updatedAt: { $gte: since30 } }),
        Interaction.countDocuments(),
        Interaction.countDocuments({ $or: [{ status: "NEW" }, { status: { $exists: false } }] }),
        User.find().sort({ createdAt: -1 }).limit(6).select("-password -otp -__v"),
        interactionsFor({}, 6),
        User.aggregate([
          { $match: { ...members, createdAt: { $gte: months[0].start } } },
          { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, role: "$role" }, count: { $sum: 1 } } },
        ]),
        Interaction.aggregate([{ $group: { _id: "$feature", count: { $sum: 1 } } }]),
        Interaction.aggregate([{ $group: { _id: "$action", count: { $sum: 1 } } }]),
        Interaction.aggregate([{ $group: { _id: { $ifNull: ["$status", "NEW"] }, count: { $sum: 1 } } }]),
        Interaction.aggregate([
          { $match: { createdAt: { $gte: since30 } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        ]),
        User.aggregate([
          { $match: { ...members, createdAt: { $gte: since30 } } },
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        ]),
        User.countDocuments({ ...members, createdAt: { $gte: since30 } }),
        User.countDocuments({ ...members, createdAt: { $gte: since60, $lt: since30 } }),
        Interaction.countDocuments({ createdAt: { $gte: since30 } }),
        Interaction.countDocuments({ createdAt: { $gte: since60, $lt: since30 } }),
        Interaction.find({ action: "donations" }).select("payload.amount createdAt").lean(),
        Interaction.aggregate([
          { $match: { targetSlug: { $ne: "" } } },
          { $group: { _id: { feature: "$feature", slug: "$targetSlug" }, count: { $sum: 1 }, last: { $max: "$createdAt" } } },
          { $sort: { count: -1, last: -1 } },
          { $limit: 6 },
        ]),
        Interaction.countDocuments({ action: "subscribe" }),
        FeatureRecord.find({ feature: "support", kind: "item" }).select("slug data.title data.raised data.goal data.donorCount data.daysLeft data.statusLabel").lean(),
        FeatureRecord.aggregate([
          { $match: { kind: "item" } },
          { $group: { _id: "$feature", count: { $sum: 1 }, updated30: { $sum: { $cond: [{ $gte: ["$updatedAt", since30] }, 1, 0] } }, lastUpdated: { $max: "$updatedAt" } } },
        ]),
        FeatureRecord.find({ kind: "item" }).sort({ updatedAt: -1 }).limit(6).select("feature slug data.title data.name updatedAt createdAt").lean(),
      ]);

      const signupMap = new Map<string, number>();
      signupRows.forEach((row) => signupMap.set(`${row._id.y}-${row._id.m}-${row._id.role}`, row.count));

      const dailyMap = new Map(dailySubmissions.map((row) => [row._id, row.count]));
      const dailySignupMap = new Map(dailySignups.map((row) => [row._id, row.count]));
      const daily = Array.from({ length: 30 }, (_, index) => {
        const date = new Date(now - (29 - index) * day);
        const key = date.toISOString().slice(0, 10);
        return {
          date: date.toLocaleString("en-GB", { day: "numeric", month: "short" }),
          submissions: dailyMap.get(key) || 0,
          signups: dailySignupMap.get(key) || 0,
        };
      });

      const amounts = donationRows.map((row) => ({ amount: Number(row.payload?.amount) || 0, at: new Date(row.createdAt).getTime() }));
      const donated = (from: number, to = Infinity) => amounts.filter((row) => row.at >= from && row.at < to).reduce((total, row) => total + row.amount, 0);
      const donationTotal = amounts.reduce((total, row) => total + row.amount, 0);

      const topKeys = topRows.map((row) => ({ feature: row._id.feature, slug: row._id.slug }));
      const topRecords = topKeys.length ? await FeatureRecord.find({ kind: "item", $or: topKeys }).select("feature slug data.title data.name").lean() : [];
      const topTitles = new Map(topRecords.map((record: any) => [`${record.feature}:${record.slug}`, record.data?.title || record.data?.name || record.slug]));

      const campaignRows = campaigns.map((record: any) => {
        const raised = Number(record.data?.raised) || 0;
        const goal = Number(record.data?.goal) || 0;
        return {
          slug: record.slug,
          title: record.data?.title || record.slug,
          raised,
          goal,
          percent: goal ? Math.min(100, Math.round((raised / goal) * 1000) / 10) : 0,
          donors: Number(record.data?.donorCount) || 0,
          daysLeft: record.data?.daysLeft ?? null,
          status: record.data?.statusLabel || "",
        };
      }).sort((a, b) => b.raised - a.raised);

      return res.status(200).json({
        status: true,
        message: "Admin dashboard loaded",
        response: {
          metrics: {
            totalUsers, students, alumni, admins, records, recordsUpdated30, totalSubmissions, newSubmissions,
            activeMembers: activeMembers.length, newsletter,
          },
          trends: {
            members: { current: members30, previous: membersPrev },
            submissions: { current: submissions30, previous: submissionsPrev },
            donations: { current: donated(since30.getTime()), previous: donated(since60.getTime(), since30.getTime()) },
          },
          daily,
          signups: months.map((month) => ({
            label: month.label,
            students: signupMap.get(`${month.key}-${Roles.STUDENT}`) || 0,
            alumni: signupMap.get(`${month.key}-${Roles.ALUMNI}`) || 0,
          })),
          submissionsByFeature: submissionRows.map((row) => ({ feature: row._id, count: row.count })).sort((a, b) => b.count - a.count),
          submissionsByAction: actionRows.map((row) => ({ action: row._id, count: row.count })).sort((a, b) => b.count - a.count),
          submissionsByStatus: statusRows.map((row) => ({ status: row._id, count: row.count })),
          topItems: topRows.map((row) => ({
            feature: row._id.feature,
            slug: row._id.slug,
            title: topTitles.get(`${row._id.feature}:${row._id.slug}`) || row._id.slug,
            count: row.count,
            last: row.last,
          })),
          fundraising: {
            totalRaised: campaignRows.reduce((total, row) => total + row.raised, 0),
            totalGoal: campaignRows.reduce((total, row) => total + row.goal, 0),
            donors: campaignRows.reduce((total, row) => total + row.donors, 0),
            onlineDonations: { count: amounts.length, total: donationTotal, average: amounts.length ? Math.round(donationTotal / amounts.length) : 0 },
            campaigns: campaignRows.slice(0, 5),
          },
          content: recordRows.map((row) => ({ feature: row._id, count: row.count, updated30: row.updated30, lastUpdated: row.lastUpdated })),
          recentlyUpdated: recentlyUpdated.map((record: any) => ({
            feature: record.feature,
            slug: record.slug,
            title: record.data?.title || record.data?.name || record.slug,
            updatedAt: record.updatedAt,
            created: Math.abs(new Date(record.updatedAt).getTime() - new Date(record.createdAt).getTime()) < 2000,
          })),
          recentUsers,
          recentSubmissions,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
