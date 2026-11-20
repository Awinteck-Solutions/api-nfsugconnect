import mongoose from "mongoose";
import * as dotenv from "dotenv";
import FeatureRecord from "../Features/features/schema/feature-record.schema";

dotenv.config();

const escape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const list = (items: unknown[]) => `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`;

async function config(feature: string) {
  return FeatureRecord.findOne({ feature, kind: "config", slug: "main" });
}

async function items(feature: string) {
  return FeatureRecord.find({ feature, kind: "item" }).sort({ createdAt: 1, _id: 1 });
}

async function save(record: any, data: Record<string, any>) {
  record.data = data;
  record.markModified("data");
  await record.save();
}

async function migrateHome() {
  const home = await config("home");
  if (!home) return;
  const data = { ...(home.data || {}) };
  const frozen = data.homePage || {};
  if (!data.homeHero) {
    data.homeHero = {
      videoSrc: frozen.heroVideoSrc || "/videos/department-hero.mp4",
      poster: frozen.heroVideoPoster || "",
      slides: frozen.heroSlides || [],
    };
  }
  data.heroFloatingStats = (data.heroFloatingStats || []).map((stat: any) => ({ live: "", ...stat }));
  delete data.homePage;
  delete data.resourcePreviewItems;
  delete data.communityFeed;
  await save(home, data);
  console.log("home settings:", Object.keys(data).join(", "));
}

async function migrateJobs() {
  const jobs = await config("jobs");
  const settings = { ...(jobs?.data || {}) };
  const text = settings.sectionText || {};
  const records = await items("jobs");
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (!("summary" in data)) data.summary = settings.cardCopy || "";
    if (!("experienceLevel" in data)) data.experienceLevel = "Entry to Mid-level";
    if (!data.description) {
      data.description = [
        `<h3>Job summary</h3><p>${escape(text.summary || data.summary || "")}</p>`,
        text.responsibilities?.length ? `<h3>Responsibilities</h3>${list(text.responsibilities)}` : "",
        text.qualifications?.length ? `<h3>Qualifications and skills</h3>${list(text.qualifications)}` : "",
        text.offer?.length ? `<h3>What we offer</h3>${list(text.offer)}` : "",
      ].join("");
    }
    await save(record, data);
  }
  if (jobs) {
    delete settings.sectionText;
    delete settings.cardCopy;
    delete settings.similarJobs;
    delete settings.companies;
    await save(jobs, settings);
  }
  console.log("jobs updated:", records.length);
}

async function migrateNews() {
  const records = await items("news");
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (Array.isArray(data.sections)) {
      if (!data.body) {
        data.body = data.sections
          .map((section: any) => `${section.heading ? `<h2>${escape(section.heading)}</h2>` : ""}<p>${escape(section.body)}</p>`)
          .join("");
      }
      delete data.sections;
    }
    if (!("body" in data)) data.body = "";
    await save(record, data);
  }
  console.log("news updated:", records.length);
}

async function migrateResources() {
  const resources = await config("resources");
  const settings = { ...(resources?.data || {}) };
  const files = Array.isArray(settings.resourcePreviewFiles) ? settings.resourcePreviewFiles : [];
  const tabs = (settings.resourceTabs || []).filter((tab: string) => tab !== "All");
  const records = await items("resources");
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const data = { ...(record.data || {}) };
    if (!("category" in data)) data.category = "food-safety-quality-assurance";
    if (!("resourceType" in data)) data.resourceType = tabs.length ? tabs[index % tabs.length] : "";
    if (!("description" in data)) data.description = "";
    if (!Array.isArray(data.files)) {
      data.files = files
        .filter((_: unknown, fileIndex: number) => fileIndex % records.length === index)
        .map((file: any) => ({ name: file.name, type: file.type, url: "", image: file.image || "" }));
    }
    await save(record, data);
  }
  if (resources) {
    delete settings.resourcePreviewFiles;
    await save(resources, settings);
  }
  console.log("resources updated:", records.length);
}

async function migrateCommunity() {
  const community = await config("community");
  const settings = { ...(community?.data || {}) };
  const chats = settings.communityChatBySlug || {};
  const records = await items("community");
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (!Array.isArray(data.messages)) data.messages = chats[record.slug] || chats.default || [];
    if (Array.isArray(data.upcomingEvents)) {
      data.eventSlugs = data.upcomingEvents.map((event: any) => event?.slug).filter((slug: string, index: number, all: string[]) => slug && all.indexOf(slug) === index);
      delete data.upcomingEvents;
    }
    if (!Array.isArray(data.eventSlugs)) data.eventSlugs = [];
    await save(record, data);
  }
  if (community) {
    delete settings.communityChatBySlug;
    delete settings.communityMembers;
    delete settings.defaultCommunitySettings;
    await save(community, settings);
  }
  console.log("community updated:", records.length);
}

async function migrateAlumni() {
  const alumni = await config("alumni");
  const settings = { ...(alumni?.data || {}) };
  const posts = Array.isArray(settings.yearGroupPosts) ? settings.yearGroupPosts : [];
  const records = await items("year-groups");
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (!Array.isArray(data.posts)) {
      data.posts = posts.map((post: any) => ({ ...post, id: `${record.slug}-${post.id}` }));
    }
    await save(record, data);
  }
  if (alumni) {
    delete settings.yearGroupPosts;
    await save(alumni, settings);
  }
  console.log("year groups updated:", records.length);
}

async function migrateAbout() {
  const about = await config("about");
  const settings = { ...(about?.data || {}) };
  const labels: Record<string, string> = {};
  (settings.aboutProgramsNav || []).forEach((item: any) => {
    if (item?.slug) labels[item.slug] = item.label;
  });
  const records = await items("programs");
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (!data.navLabel) data.navLabel = labels[record.slug] || String(data.title || "").replace(/\s+Programmes?$/i, "");
    if (!("order" in data)) data.order = ["undergraduate", "graduate", "phd"].indexOf(record.slug) + 1 || 9;
    await save(record, data);
  }
  if (about) {
    settings.aboutNavItems = (settings.aboutNavItems || []).filter((item: any) => item?.group !== "programs");
    delete settings.aboutProgramsNav;
    delete settings.aboutSubNavLinks;
    await save(about, settings);
  }
  console.log("programs updated:", records.length);
}

export async function migrateContentV2() {
  await migrateHome();
  await migrateJobs();
  await migrateNews();
  await migrateResources();
  await migrateCommunity();
  await migrateAlumni();
  await migrateAbout();
}

async function migrate() {
  await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });
  await migrateContentV2();
  await mongoose.disconnect();
}

if (require.main === module) migrate().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
