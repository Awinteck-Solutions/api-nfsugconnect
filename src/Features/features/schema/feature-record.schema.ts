const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const featureRecordSchema = new Schema({
  feature: { type: String, required: true, index: true },
  kind: { type: String, enum: ["item", "config"], default: "item", index: true },
  slug: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

featureRecordSchema.index({ feature: 1, kind: 1, slug: 1 }, { unique: true });

const FeatureRecord = mongoose.model("FeatureRecord", featureRecordSchema);

export default FeatureRecord;
