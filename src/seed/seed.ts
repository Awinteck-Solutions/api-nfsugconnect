import fs = require("fs");
import path = require("path");
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as bcrypt from "bcryptjs";
import SiteCatalog from "../Features/site/schema/site-catalog.schema";
import User from "../Features/auth/schema/user.schema";
import Role from "../Features/access/schema/role.schema";
import { fullPermissions } from "../Features/access/access.catalog";
import { syncFeatureRecords } from "../Features/features/services/feature-sync.service";
import { migrateContentV1 } from "./migrate-content";
import { migrateContentV2 } from "./migrate-content-v2";
import { migrateContentV3 } from "./migrate-content-v3";

dotenv.config();

async function seed() {
  await mongoose.connect(process.env.DB_URL, {
    serverSelectionTimeoutMS: 15000,
  });

  const catalogPath = path.join(__dirname, "site-content.json");
  const data = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  await SiteCatalog.findOneAndUpdate(
    { key: "public" },
    { key: "public", data },
    { upsert: true, new: true },
  );
  const synced = await syncFeatureRecords(data);
  await migrateContentV1();
  await migrateContentV2();
  await migrateContentV3();
  console.log(`Synced ${synced.records} feature records`);

  const password = bcrypt.hashSync("azazaz", 12);
  await User.findOneAndUpdate(
    { email: "admin@gmail.com" },
    {
      email: "admin@gmail.com",
      password,
      firstname: "Site",
      lastname: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const superAdmin = await Role.findOneAndUpdate(
    { slug: "super-admin" },
    {
      name: "Super Admin",
      slug: "super-admin",
      description: "Full access to every feature, role, and admin user.",
      isSystem: true,
      permissions: fullPermissions(),
    },
    { upsert: true, new: true },
  );
  await User.updateOne({ email: "admin@gmail.com" }, { adminRole: superAdmin._id });

  console.log("Seeded site content, super admin role, and admin user");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error.message || error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
