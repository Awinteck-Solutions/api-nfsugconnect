import mongoose from "mongoose";
import * as dotenv from "dotenv";
import FeatureRecord from "../Features/features/schema/feature-record.schema";

dotenv.config();

const contributorRoles = ["Lecturer", "Teaching Assistant", "Student", "Alumni", "Department", "Guest Contributor"];

async function migrateResources() {
  const records = await FeatureRecord.find({ feature: "resources", kind: "item" });
  let changed = 0;
  for (const record of records) {
    const data = { ...(record.data || {}) };
    if (!("lecturer" in data)) continue;
    const match = String(data.lecturer || "").match(/^\s*([^:]+):\s*(.+)$/);
    data.postedBy = data.postedBy || (match ? match[2].trim() : String(data.lecturer || "").trim());
    data.postedByRole = data.postedByRole || (match ? match[1].trim() : "Lecturer");
    delete data.lecturer;
    record.data = data;
    record.markModified("data");
    await record.save();
    changed += 1;
  }

  const config = await FeatureRecord.findOne({ feature: "resources", kind: "config", slug: "main" });
  if (config && !config.data?.resourceContributorRoles) {
    config.data = { ...(config.data || {}), resourceContributorRoles: contributorRoles };
    config.markModified("data");
    await config.save();
  }
  console.log(`resources: ${changed} records moved from lecturer to postedBy/postedByRole`);
}

export async function migrateContentV3() {
  await migrateResources();
}

async function migrate() {
  await mongoose.connect(process.env.DB_URL, { serverSelectionTimeoutMS: 15000 });
  await migrateContentV3();
  await mongoose.disconnect();
}

if (require.main === module) migrate().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
