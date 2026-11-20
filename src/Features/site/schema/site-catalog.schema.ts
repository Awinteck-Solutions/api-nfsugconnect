const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const siteCatalogSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "public" },
  data: { type: Schema.Types.Mixed, required: true },
}, { timestamps: true });

const SiteCatalog = mongoose.model("SiteCatalog", siteCatalogSchema);

export default SiteCatalog;
