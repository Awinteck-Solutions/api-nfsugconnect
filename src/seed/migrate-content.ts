import mongoose from "mongoose";
import * as dotenv from "dotenv";
import FeatureRecord from "../Features/features/schema/feature-record.schema";

dotenv.config();

const defaultEventGroups = {
  today: { eyebrow: "Happening Today", title: "Here is a list of Events Happening Today" },
  upcoming: { eyebrow: "Upcoming Events", title: "Here is a list of Events Happening here at NFS" },
  past: { eyebrow: "Past Events", title: "Catch up on recent events at NFS" },
};

const fundingByType: Record<string, string> = {
  "Full Ride": "Fully funded",
  Partial: "Partially funded",
};

export async function migrateContentV1() {
  const events = await FeatureRecord.findOne({ feature: "events", kind: "config", slug: "main" });
  if (events) {
    const data = { ...(events.data || {}) };
    if (!data.eventGroups) {
      const sections = Array.isArray(data.eventSections) ? data.eventSections : [];
      data.eventGroups = {
        today: { ...defaultEventGroups.today, ...pick(sections[0]) },
        upcoming: { ...defaultEventGroups.upcoming, ...pick(sections[1]) },
        past: defaultEventGroups.past,
      };
    }
    delete data.eventSections;
    delete data.eventPreview;
    events.data = data;
    events.markModified("data");
    await events.save();
    console.log("events settings:", Object.keys(data).join(", "));
  }

  const scholarshipConfig = await FeatureRecord.findOne({ feature: "scholarships", kind: "config", slug: "main" });
  if (scholarshipConfig) {
    const data = { ...(scholarshipConfig.data || {}) };
    delete data.scholarshipPreview;
    scholarshipConfig.data = data;
    scholarshipConfig.markModified("data");
    await scholarshipConfig.save();
    console.log("scholarship settings:", Object.keys(data).join(", "));
  }

  const scholarships = await FeatureRecord.find({ feature: "scholarships", kind: "item" });
  for (const record of scholarships) {
    const data = { ...(record.data || {}) };
    delete data.deadlineFilter;
    delete data.postingDate;
    if (!("sponsor" in data)) data.sponsor = "";
    if (!("funding" in data)) data.funding = fundingByType[data.scholarshipType] || "";
    record.data = data;
    record.markModified("data");
    await record.save();
  }
  console.log("scholarships updated:", scholarships.length);
}

async function migrate() {
  await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });
  await migrateContentV1();
  await mongoose.disconnect();
}

function pick(section: any) {
  if (!section || typeof section !== "object") return {};
  const result: Record<string, string> = {};
  if (section.eyebrow) result.eyebrow = section.eyebrow;
  if (section.title) result.title = section.title;
  return result;
}

if (require.main === module) migrate().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
