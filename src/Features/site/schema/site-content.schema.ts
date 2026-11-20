const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const siteContentSchema = new Schema({
  section: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  status: {
    type: String,
    enum: ["DRAFT", "PUBLISHED"],
    default: "DRAFT",
  },
  metadata: { type: Schema.Types.Mixed, default: {} },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const SiteContent = mongoose.model("SiteContent", siteContentSchema);

export default SiteContent;
