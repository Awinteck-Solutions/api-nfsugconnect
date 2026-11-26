import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

/** Docker --env-file keeps shell quotes; dotenv strips them. Normalize both. */
function mongoUri() {
  const raw = process.env.DB_URL || process.env.MONGODB_URI || "";
  const uri = String(raw).trim().replace(/^['"]|['"]$/g, "");
  if (!uri) {
    throw new Error("DB_URL is missing. Set it in .env or pass -e DB_URL=mongodb://...");
  }
  if (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://")) {
    throw new Error(
      `DB_URL must start with mongodb:// or mongodb+srv:// (got "${uri.slice(0, 24)}..."). ` +
        "If using Docker --env-file, remove quotes around the value in .env."
    );
  }
  return uri;
}

const connectToDatabase = async () => {
  try {
    // Do not enable sanitizeFilter. Mongoose 8.24 applies it to every query and
    // wraps server-built operators ($in, $ne, $gte, $exists) in $eq, which
    // makes GET /dashboard/me throw CastError on FeatureRecord.slug.
    await mongoose.connect(mongoUri(), {
      autoCreate: true,
    });
    console.log("Connected to MongoDB successfully!");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

export default connectToDatabase;
