const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const interactionSchema = new Schema({
  feature: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  targetSlug: { type: String, default: "" },
  actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  payload: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ["NEW", "REVIEWED", "ARCHIVED"], default: "NEW", index: true },
  note: { type: String, default: "" },
}, { timestamps: true });

const Interaction = mongoose.model("Interaction", interactionSchema);

export default Interaction;
