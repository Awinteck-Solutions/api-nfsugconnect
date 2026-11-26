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
    { feature: "jobs", label: "Career opportunities" },
    { feature: "support", label: "Giving campaigns" },
  ],
};

function recordBlob(data: any) {
  try {
    return JSON.stringify(data || {}).toLowerCase();
  } catch {
    return "";
  }
}

function relevanceScore(feature: string, data: any, user: any) {
  const blob = recordBlob(data);
  let score = 1;
  const program = String(user.program || "").trim().toLowerCase();
  if (program.length > 2 && blob.includes(program)) score += 4;
  if (user.classYear && blob.includes(String(user.classYear))) score += 3;

  const studentSignal = /\bstudent\b|undergraduate|\bug\b|intern|part[ -]?time|campus|lab manual|past question|flashcard|walkthrough/.test(blob);
  const alumniSignal = /\balumni\b|reunion|mentorship|\bmentor\b|giving|donation|full[ -]?time|postgraduate|year group|career/.test(blob);
  const studentOnly = user.role === Roles.STUDENT && !user.alsoAlumni;
  const alumniOnly = user.role === Roles.ALUMNI;

  if (studentOnly) {
    if (studentSignal) score += 2;
    if (alumniSignal && !studentSignal) score -= 5;
    if (feature === "scholarships" && /postgraduate|phd/.test(blob) && !/undergraduate/.test(blob)) score -= 5;
  }
  if (alumniOnly) {
    if (alumniSignal) score += 2;
    if (/lab manual|past question|flashcard|walkthrough/.test(blob) && !alumniSignal) score -= 5;
    if (feature === "scholarships" && /^undergraduate$/i.test(String(data.levelOfStudy || "")) && !alumniSignal) score -= 4;
  }
  if (user.role === Roles.STUDENT && user.alsoAlumni && (studentSignal || alumniSignal)) score += 1;
  return score;
}

function plainNotice(value: unknown) {
  return String(value || "")
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slimRecord(record: any) {
  const data = record.data || {};
  const text = plainNotice(data.excerpt || data.description || data.summary || data.bio || "");
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

function cleanAttachment(value: any) {
  if (!value || typeof value !== "object") return null;
  const type = value.type === "image" || value.type === "file" ? value.type : "";
  const url = String(value.url || "").trim().slice(0, 500);
  if (!type || !/^https?:\/\//i.test(url)) return null;
  return {
    type,
    url,
    name: String(value.name || "").trim().slice(0, 180),
    size: Number(value.size) || 0,
  };
}

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

function publicProfile(user: any) {
  const socials = user?.socials && typeof user.socials === "object" ? user.socials : {};
  return {
    headline: user.headline || "",
    bio: user.bio || "",
    about: user.bio || "",
    location: user.location || "",
    organisation: user.organisation || "",
    interests: Array.isArray(user.interests) ? user.interests.join(", ") : (user.interests || ""),
    program: user.program || "",
    profileImage: user.profileImage || "",
    classYear: user.classYear || null,
    socials,
  };
}

async function enrichMembers(members: any[]) {
  const list = Array.isArray(members) ? members : [];
  if (!list.length) return list;
  const handles = Array.from(new Set(list.map((member) => String(member.handle || "").replace(/^@/, "").trim()).filter(Boolean)));
  const emails = Array.from(new Set(list.map((member) => String(member.email || "").trim().toLowerCase()).filter(Boolean)));
  const nameQueries = list.map((member) => {
    const parts = String(member.name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    return { firstname: new RegExp(`^${parts[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), lastname: new RegExp(`^${parts.slice(1).join(" ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") };
  }).filter(Boolean);
  const or = [
    ...(handles.length ? [{ handle: { $in: handles } }] : []),
    ...(emails.length ? [{ email: { $in: emails } }] : []),
    ...nameQueries,
  ];
  if (!or.length) return list;
  const users: any[] = await User.find({ $or: or })
    .select("firstname lastname email handle headline bio location organisation interests socials program profileImage classYear")
    .limit(list.length + 4)
    .lean();
  const byHandle = new Map(users.map((user) => [personKey(user.handle), user]));
  const byEmail = new Map(users.map((user) => [personKey(user.email), user]));
  const byName = new Map(users.map((user) => [personKey([user.firstname, user.lastname].filter(Boolean).join(" ")), user]));
  return list.map((member) => {
    const handle = personKey(String(member.handle || "").replace(/^@/, ""));
    const match = byHandle.get(handle) || byEmail.get(personKey(member.email)) || byName.get(personKey(member.name));
    if (!match) return member;
    const profile = publicProfile(match);
    return {
      ...member,
      ...profile,
      name: member.name || [match.firstname, match.lastname].filter(Boolean).join(" "),
      avatar: member.avatar || profile.profileImage,
      image: member.image || profile.profileImage,
    };
  });
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
  const members = await enrichMembers(Array.isArray(community.members) ? community.members : []);
  community.members = members;
  const membership = resolveMembership(user, community, yearGroup);
  const yearText = String(yearGroup.year || "");
  const supportRecords = await FeatureRecord.find({
    feature: "support",
    kind: "item",
    $or: [{ "data.visibility": { $exists: false } }, { "data.visibility": { $ne: "draft" } }],
  }).sort({ updatedAt: -1 }).limit(24);
  const campaigns = supportRecords
    .map((record) => presentRecord(record))
    .filter((item) => {
      const blob = recordBlob(item);
      return (yearText && blob.includes(yearText)) || (communitySlug && blob.includes(String(communitySlug).toLowerCase()));
    })
    .slice(0, 4);
  const interactions = eventSlugs.length
    ? await Interaction.find({ targetSlug: { $in: eventSlugs }, action: { $in: ["rsvp", "donations", "join"] } }).sort({ createdAt: -1 }).limit(8).lean()
    : [];
  const activity = [
    ...upcomingEvents.slice(0, 4).map((event: any) => ({
      kind: /meetup|reunion|social|mixer/i.test(`${event.title} ${event.format} ${event.category}`) ? "meetup" : "event",
      title: event.title,
      slug: event.slug,
      date: event.date || "",
      image: event.image || event.cover || "",
      text: event.location || event.format || "",
    })),
    ...campaigns.map((campaign: any) => ({
      kind: "giving",
      title: campaign.title,
      slug: campaign.slug,
      text: [campaign.raised, campaign.goal].filter(Boolean).length ? `${campaign.raised || "0"} raised · ${campaign.goal || "goal open"}` : "Giving campaign",
    })),
    ...interactions.map((item: any) => ({
      kind: item.action,
      title: item.payload?.title || item.targetSlug,
      text: item.action === "donations" ? "A classmate supported a class campaign" : item.action === "rsvp" ? "A classmate is going" : "A classmate joined",
      createdAt: item.createdAt,
    })),
  ];
  return { yearGroup, community: { ...community, upcomingEvents, campaigns, activity }, membership, upcomingEvents };
}

function isYearGroupCommunity(record: any) {
  return Boolean(record?.data?.isYearGroup) || /^class-of-\d+$/.test(String(record?.slug || ""));
}

function communityCard(record: any) {
  const item = presentRecord(record);
  const members = Array.isArray(item.members) ? item.members : [];
  return {
    slug: item.slug,
    title: item.title || item.slug,
    image: item.image || "",
    description: item.description || "",
    category: item.category || "",
    memberCount: Number(item.memberCount || members.length || 0),
    isYearGroup: isYearGroupCommunity(record),
  };
}

function memberMatchesUser(user: any, member: any) {
  if (member?.id && String(member.id) === String(user._id)) return true;
  if (user.email && member?.email && personKey(member.email) === personKey(user.email)) return true;
  if (user.handle && member?.handle && personKey(member.handle) === personKey(user.handle)) return true;
  const fullName = personKey([user.firstname, user.lastname].filter(Boolean).join(" "));
  return Boolean(fullName && member?.name && personKey(member.name) === fullName);
}

async function loadCommunityCircles(user: any, yearGroupBundle: any) {
  const records = await FeatureRecord.find({ feature: "community", kind: "item" });
  const yearSlug = yearGroupBundle?.community?.slug || "";
  const joined = new Set((Array.isArray(user.communitySlugs) ? user.communitySlugs : []).map((slug: string) => String(slug)));
  const circles: any[] = [];
  const directory: any[] = [];
  for (const record of records) {
    const card = communityCard(record);
    if (card.slug === yearSlug) {
      circles.push({
        ...card,
        members: yearGroupBundle?.community?.members || [],
        automatic: true,
        isYearGroup: true,
      });
      continue;
    }
    if (card.isYearGroup) continue;
    if (joined.has(card.slug)) {
      const members = await enrichMembers(Array.isArray(record.data?.members) ? record.data.members : []);
      circles.push({ ...card, members, automatic: false, isYearGroup: false });
    } else {
      directory.push(card);
    }
  }
  circles.sort((a, b) => Number(b.automatic) - Number(a.automatic) || String(a.title).localeCompare(String(b.title)));
  directory.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return { circles, directory, groupSlugs: circles.map((circle) => circle.slug) };
}

const defaultNotificationPrefs = {
  email: true,
  newsletter: true,
  chat: true,
  events: true,
  scholarships: true,
  resources: true,
  jobs: true,
  giving: true,
};

function notificationPrefs(user: any) {
  return { ...defaultNotificationPrefs, ...(user?.notificationPrefs || {}) };
}

function graduatedYear(classYear: unknown) {
  const year = Number(classYear);
  return Number.isFinite(year) && year > 0 && year <= new Date().getFullYear();
}

async function applyGraduation(user: any) {
  if (user.role === Roles.STUDENT && graduatedYear(user.classYear)) {
    user.role = Roles.ALUMNI;
    user.alsoAlumni = true;
    await user.save();
  }
}

function buildNotices({ user, prefs, highlights, messages, yearGroupBundle, seenAt }: any) {
  const notices: any[] = [];
  const allow = (feature: string) => {
    if (feature === "events") return prefs.events !== false;
    if (feature === "scholarships") return prefs.scholarships !== false;
    if (feature === "resources") return prefs.resources !== false;
    if (feature === "jobs") return prefs.jobs !== false;
    if (feature === "support") return prefs.giving !== false;
    return true;
  };
  if (prefs.chat !== false) {
    messages
      .filter((item: any) => String(item.actorId || "") !== String(user._id))
      .slice(-6)
      .forEach((item: any) => {
        const created = new Date(item.createdAt).getTime();
        notices.push({
          id: `chat:${item._id}`,
          type: "chat",
          title: item.payload?.authorName ? `${item.payload.authorName} sent a message` : "New message",
          body: plainNotice(item.payload?.text) || "Open messaging to read it.",
          createdAt: item.createdAt,
          threadId: item.targetSlug || "",
          unread: created > seenAt,
        });
      });
  }
  (highlights || []).forEach((section: any) => {
    if (!allow(section.feature)) return;
    (section.items || []).slice(0, 2).forEach((item: any) => {
      notices.push({
        id: `${section.feature}:${item.slug}`,
        type: section.feature,
        title: plainNotice(item.title),
        body: plainNotice(item.text) || section.label,
        path: noticePath(section.feature, item.slug),
        unread: !seenAt,
      });
    });
  });
  if (prefs.events !== false) {
    (yearGroupBundle?.upcomingEvents || []).slice(0, 2).forEach((event: any) => {
      if (notices.some((item) => item.id === `events:${event.slug}`)) return;
      notices.push({
        id: `events:${event.slug}`,
        type: "events",
        title: plainNotice(event.title),
        body: [event.date, plainNotice(event.location)].filter(Boolean).join(" · ") || "Coming up in your year group",
        path: noticePath("events", event.slug),
        unread: !seenAt,
      });
    });
  }
  return notices.slice(0, 16);
}

function noticePath(feature: string, slug: string) {
  const roots: Record<string, string> = {
    events: "/events",
    scholarships: "/scholarships",
    resources: "/resources",
    jobs: "/jobs",
    support: "/support",
    news: "/news",
  };
  return roots[feature] ? `${roots[feature]}/${slug}` : "";
}

export class DashboardController {
  static async currentUserDashboard(req: Request, res: Response) {
    try {
      const currentUser = req["currentUser"];
      const user = await User.findById(currentUser.id).select("-password -otp -__v");
      if (!user) {
        return res.status(404).json({ status: false, message: "User not found" });
      }
      await applyGraduation(user);
      const prefs = notificationPrefs(user);

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
        }).sort({ updatedAt: -1 }).limit(40);
        const items = records
          .map((record) => ({ record, score: relevanceScore(section.feature, record.data || {}, user) }))
          .filter((item) => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 4)
          .map((item) => slimRecord(item.record));
        return { ...section, items };
      }));

      const cards = [
        { key: "applications", label: "Applications", value: byAction.applications || 0 },
        { key: "rsvp", label: "Event RSVPs", value: byAction.rsvp || 0 },
        { key: "connections", label: "Connections & requests", value: (byAction.connect || 0) + (byAction.requests || 0) + (byAction.join || 0) },
        { key: "donations", label: "Donated", value: donated, currency: true },
      ];

      const yearGroupBundle = await loadYearGroupBundle(user);
      const { circles, directory, groupSlugs } = await loadCommunityCircles(user, yearGroupBundle);
      const [savedInteractions, threadMessages] = await Promise.all([
        Interaction.find({ actorId: user._id, action: "bookmark" }).sort({ createdAt: -1 }).limit(40).lean(),
        Interaction.find({
          action: "messages",
          $or: [
            { actorId: user._id },
            ...(user.handle ? [{ "payload.recipientHandle": user.handle }] : []),
            ...(groupSlugs.length ? [{ "payload.groupSlug": { $in: groupSlugs } }] : []),
          ],
        }).sort({ createdAt: 1 }).limit(400).lean(),
      ]);
      const savedPairs = savedInteractions.filter((item) => item.feature && item.targetSlug);
      const savedRecords = savedPairs.length
        ? await FeatureRecord.find({ kind: "item", $or: savedPairs.map((item) => ({ feature: item.feature, slug: item.targetSlug })) })
        : [];
      const savedByKey = new Map(savedRecords.map((record) => [`${record.feature}:${record.slug}`, record]));
      const bookmarks = savedPairs.map((item) => {
        const record = savedByKey.get(`${item.feature}:${item.targetSlug}`);
        if (!record) return null;
        return { ...slimRecord(record), feature: item.feature, savedAt: item.createdAt };
      }).filter(Boolean);

      const seenAtNow = new Date();
      await User.updateOne({ _id: user._id }, { $set: { lastSeenAt: seenAtNow } });
      const onlineSince = new Date(seenAtNow.getTime() - 90 * 1000);
      const yearFilter = user.yearGroupSlug
        ? { yearGroupSlug: user.yearGroupSlug }
        : (user.classYear ? { classYear: user.classYear } : null);
      const sharedSlugs = circles.filter((circle) => !circle.isYearGroup).map((circle) => circle.slug);
      const onlineMatch = [
        ...(yearFilter ? [yearFilter] : []),
        ...(sharedSlugs.length ? [{ communitySlugs: { $in: sharedSlugs } }] : []),
      ];
      const onlineUsers = onlineMatch.length
        ? await User.find({
          _id: { $ne: user._id },
          lastSeenAt: { $gte: onlineSince },
          status: "ACTIVE",
          $or: onlineMatch,
        }).select("handle firstname lastname").lean()
        : [];

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
          bookmarks,
          messages: threadMessages.map((item: any) => ({
            id: item._id,
            threadId: item.targetSlug,
            text: item.payload?.text || "",
            attachment: item.payload?.attachment || null,
            authorId: String(item.actorId || ""),
            authorName: item.payload?.authorName || "",
            authorHandle: item.payload?.authorHandle || "",
            recipientHandle: item.payload?.recipientHandle || "",
            recipientName: item.payload?.recipientName || "",
            groupSlug: item.payload?.groupSlug || "",
            createdAt: item.createdAt,
          })),
          yearGroup: yearGroupBundle?.yearGroup || null,
          community: yearGroupBundle?.community || null,
          membership: yearGroupBundle?.membership || null,
          circles,
          directory,
          notificationPrefs: prefs,
          online: onlineUsers.map((person: any) => ({
            handle: person.handle || "",
            name: [person.firstname, person.lastname].filter(Boolean).join(" "),
          })),
          notifications: buildNotices({
            user,
            prefs,
            highlights,
            messages: threadMessages,
            yearGroupBundle,
            seenAt: user.notificationSeenAt ? new Date(user.notificationSeenAt).getTime() : 0,
          }),
        },
      });
    } catch (error) {
      const err = error as { name?: string; message?: string; stack?: string };
      console.error("[dashboard/me]", err?.name || "Error", err?.message || error);
      if (err?.stack) console.error(err.stack);
      return res.status(500).json({ status: false, message: "System error" });
    }
  }


  static async toggleBookmark(req: Request, res: Response) {
    try {
      const userId = req["currentUser"]?.id;
      const feature = String(req.body?.feature || "").trim();
      const slug = String(req.body?.slug || "").trim();
      if (!feature || !slug) return res.status(400).json({ status: false, message: "Choose an item to save" });
      const existing = await Interaction.findOne({ actorId: userId, action: "bookmark", feature, targetSlug: slug });
      if (existing) {
        await existing.deleteOne();
        return res.json({ status: true, message: "Removed from saved", response: { saved: false, feature, slug } });
      }
      const record = await FeatureRecord.findOne({ feature, kind: "item", slug });
      if (!record) return res.status(404).json({ status: false, message: "Item not found" });
      await Interaction.create({
        feature,
        action: "bookmark",
        targetSlug: slug,
        actorId: userId,
        payload: { title: record.data?.title || record.data?.name || slug },
      });
      return res.json({ status: true, message: "Saved", response: { saved: true, feature, slug, item: { ...slimRecord(record), feature } } });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const currentUser = req["currentUser"];
      const user = await User.findById(currentUser.id).select("firstname lastname handle email");
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      const text = String(req.body?.text || "").trim().slice(0, 2000);
      const threadId = String(req.body?.threadId || "").trim().slice(0, 180);
      const attachment = cleanAttachment(req.body?.attachment);
      if ((!text && !attachment) || !threadId) return res.status(400).json({ status: false, message: "Write a message first" });
      const created = await Interaction.create({
        feature: "messages",
        action: "messages",
        targetSlug: threadId,
        actorId: user._id,
        payload: {
          text,
          attachment,
          authorName: [user.firstname, user.lastname].filter(Boolean).join(" "),
          authorHandle: user.handle || "",
          recipientHandle: String(req.body?.recipientHandle || "").trim(),
          recipientName: String(req.body?.recipientName || "").trim(),
          groupSlug: String(req.body?.groupSlug || "").trim(),
        },
      });
      return res.json({
        status: true,
        message: "Message sent",
        response: {
          id: created._id,
          threadId,
          text: created.payload?.text,
          attachment: created.payload?.attachment || null,
          authorId: String(user._id),
          authorName: created.payload?.authorName,
          authorHandle: created.payload?.authorHandle || "",
          recipientHandle: created.payload?.recipientHandle,
          recipientName: created.payload?.recipientName,
          groupSlug: created.payload?.groupSlug,
          createdAt: created.createdAt,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async updateNotificationPrefs(req: Request, res: Response) {
    try {
      const user = await User.findById(req["currentUser"]?.id);
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      const current = notificationPrefs(user);
      const incoming = req.body?.notificationPrefs || req.body || {};
      Object.keys(defaultNotificationPrefs).forEach((key) => {
        if (typeof incoming[key] === "boolean") current[key] = incoming[key];
      });
      user.notificationPrefs = current;
      user.markModified("notificationPrefs");
      await user.save();
      if (current.newsletter === false && user.email) {
        await Interaction.deleteMany({ feature: "newsletter", action: "subscribe", "payload.email": String(user.email).toLowerCase() });
      }
      if (current.newsletter && user.email) {
        const email = String(user.email).toLowerCase();
        const existing = await Interaction.findOne({ feature: "newsletter", action: "subscribe", "payload.email": email });
        if (!existing) {
          await Interaction.create({ feature: "newsletter", action: "subscribe", actorId: user._id, payload: { email } });
        }
      }
      return res.json({ status: true, message: "Notification settings saved", response: current });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async markNotificationsRead(req: Request, res: Response) {
    try {
      await User.updateOne({ _id: req["currentUser"]?.id }, { notificationSeenAt: new Date() });
      return res.json({ status: true, message: "Notifications marked read" });
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

  static async joinCommunity(req: Request, res: Response) {
    try {
      const user = await User.findById(req["currentUser"]?.id).select("-password -otp -__v");
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      const slug = String(req.body?.slug || "").trim();
      const record = await FeatureRecord.findOne({ feature: "community", kind: "item", slug });
      if (!record) return res.status(404).json({ status: false, message: "Community not found" });
      if (isYearGroupCommunity(record)) {
        return res.status(400).json({ status: false, message: "Year groups are added from your class year" });
      }
      await User.updateOne({ _id: user._id }, { $addToSet: { communitySlugs: slug } });
      user.communitySlugs = Array.from(new Set([...(user.communitySlugs || []), slug]));
      const members = Array.isArray(record.data?.members) ? record.data.members : [];
      if (!members.some((member: any) => memberMatchesUser(user, member))) {
        members.push({
          id: String(user._id),
          name: [user.firstname, user.lastname].filter(Boolean).join(" "),
          handle: user.handle || "",
          email: user.email || "",
          role: "Member",
          avatar: user.profileImage || "",
        });
        record.data.members = members;
        record.data.memberCount = Number(record.data.memberCount || members.length - 1) + 1;
        record.markModified("data");
        await record.save();
      }
      await Interaction.create({
        feature: "community",
        action: "join",
        targetSlug: slug,
        actorId: user._id,
        payload: { title: record.data?.title || slug },
      });
      const bundle = await loadYearGroupBundle(user);
      const circles = await loadCommunityCircles(user, bundle);
      return res.json({ status: true, message: "Joined community", response: circles });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async leaveCommunity(req: Request, res: Response) {
    try {
      const user = await User.findById(req["currentUser"]?.id).select("-password -otp -__v");
      if (!user) return res.status(404).json({ status: false, message: "User not found" });
      const slug = String(req.body?.slug || req.params?.slug || "").trim();
      const record = await FeatureRecord.findOne({ feature: "community", kind: "item", slug });
      if (!record) return res.status(404).json({ status: false, message: "Community not found" });
      if (isYearGroupCommunity(record)) {
        return res.status(400).json({ status: false, message: "Your year group stays with your class year" });
      }
      await User.updateOne({ _id: user._id }, { $pull: { communitySlugs: slug } });
      user.communitySlugs = (user.communitySlugs || []).filter((item: string) => item !== slug);
      const members = Array.isArray(record.data?.members) ? record.data.members : [];
      const nextMembers = members.filter((member: any) => !memberMatchesUser(user, member));
      if (nextMembers.length !== members.length) {
        record.data.members = nextMembers;
        record.data.memberCount = Math.max(nextMembers.length, Number(record.data.memberCount || members.length) - 1);
        record.markModified("data");
        await record.save();
      }
      const bundle = await loadYearGroupBundle(user);
      const circles = await loadCommunityCircles(user, bundle);
      return res.json({ status: true, message: "Left community", response: circles });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
