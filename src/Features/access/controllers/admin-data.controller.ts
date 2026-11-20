import { Request, Response } from "express";
import User from "../../auth/schema/user.schema";
import Interaction from "../../features/schema/interaction.schema";
import FeatureRecord from "../../features/schema/feature-record.schema";

const interactionStatuses = ["NEW", "REVIEWED", "ARCHIVED"];
const memberRoles = ["STUDENT", "ALUMNI"];
const actorFields = "firstname lastname email role profileImage";

function recordTitle(data: any, slug: string) {
  return data?.title || data?.name || data?.label || slug;
}

async function attachTargets(interactions: any[]) {
  const keys = interactions
    .filter((item) => item.targetSlug)
    .map((item) => ({ feature: item.feature, slug: item.targetSlug }));
  const records = keys.length
    ? await FeatureRecord.find({ kind: "item", $or: keys }).select("feature slug data.title data.name data.label")
    : [];
  const titles = new Map(records.map((record) => [`${record.feature}:${record.slug}`, recordTitle(record.data, record.slug)]));
  return interactions.map((item) => {
    const plain = item.toObject ? item.toObject() : item;
    return {
      ...plain,
      id: plain._id,
      targetTitle: plain.targetSlug ? titles.get(`${plain.feature}:${plain.targetSlug}`) || plain.targetSlug : "",
    };
  });
}

export async function interactionsFor(filter: any, limit = 300) {
  const interactions = await Interaction.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("actorId", actorFields);
  return attachTargets(interactions);
}

export class AdminDataController {
  static async listSubmissions(req: Request, res: Response) {
    try {
      const filter: any = {};
      if (req.query.feature) filter.feature = String(req.query.feature);
      if (req.query.action) filter.action = String(req.query.action);
      if (req.query.status && interactionStatuses.includes(String(req.query.status))) filter.status = String(req.query.status);
      const [items, summary] = await Promise.all([
        interactionsFor(filter, Number(req.query.limit) || 300),
        Interaction.aggregate([
          { $group: { _id: { feature: "$feature", action: "$action", status: { $ifNull: ["$status", "NEW"] } }, count: { $sum: 1 } } },
        ]),
      ]);
      return res.json({
        status: true,
        response: items,
        summary: summary.map((row) => ({ ...row._id, count: row.count })),
        total: items.length,
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async updateSubmission(req: Request, res: Response) {
    try {
      const updates: any = {};
      if (req.body.status) {
        if (!interactionStatuses.includes(req.body.status)) return res.status(400).json({ status: false, message: "Unknown status" });
        updates.status = req.body.status;
      }
      if (typeof req.body.note === "string") updates.note = req.body.note;
      const interaction = await Interaction.findByIdAndUpdate(req.params.id, updates, { new: true }).populate("actorId", actorFields);
      if (!interaction) return res.status(404).json({ status: false, message: "Submission not found" });
      const [item] = await attachTargets([interaction]);
      return res.json({ status: true, message: "Submission updated", response: item });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async removeSubmission(req: Request, res: Response) {
    try {
      const interaction = await Interaction.findByIdAndDelete(req.params.id);
      if (!interaction) return res.status(404).json({ status: false, message: "Submission not found" });
      return res.json({ status: true, message: "Submission deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async listMembers(req: Request, res: Response) {
    try {
      const filter: any = { role: { $in: memberRoles } };
      if (memberRoles.includes(String(req.query.role))) filter.role = String(req.query.role);
      const members = await User.find(filter).sort({ createdAt: -1 }).select("-password -otp -__v").lean();
      const counts = await Interaction.aggregate([
        { $match: { actorId: { $in: members.map((member) => member._id) } } },
        { $group: { _id: "$actorId", count: { $sum: 1 } } },
      ]);
      const activity = new Map(counts.map((row) => [String(row._id), row.count]));
      return res.json({
        status: true,
        response: members.map((member) => ({ ...member, id: member._id, activityCount: activity.get(String(member._id)) || 0 })),
        total: members.length,
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async memberDetail(req: Request, res: Response) {
    try {
      const member = await User.findOne({ _id: req.params.id, role: { $in: memberRoles } }).select("-password -otp -__v");
      if (!member) return res.status(404).json({ status: false, message: "Member not found" });
      const activity = await interactionsFor({ $or: [{ actorId: member._id }, { "payload.email": member.email }] }, 100);
      return res.json({ status: true, response: { member, activity } });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async updateMember(req: Request, res: Response) {
    try {
      const updates: any = {};
      ["firstname", "lastname", "phoneNumber"].forEach((key) => {
        if (typeof req.body[key] === "string") updates[key] = req.body[key];
      });
      if (req.body.role) {
        if (!memberRoles.includes(req.body.role)) return res.status(400).json({ status: false, message: "Members can only be students or alumni" });
        updates.role = req.body.role;
      }
      if (req.body.status) {
        if (!["ACTIVE", "DEACTIVE"].includes(req.body.status)) return res.status(400).json({ status: false, message: "Unknown status" });
        updates.status = req.body.status;
      }
      const member = await User.findOneAndUpdate({ _id: req.params.id, role: { $in: memberRoles } }, updates, { new: true }).select("-password -otp -__v");
      if (!member) return res.status(404).json({ status: false, message: "Member not found" });
      return res.json({ status: true, message: "Member updated", response: member });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async removeMember(req: Request, res: Response) {
    try {
      const member = await User.findOneAndDelete({ _id: req.params.id, role: { $in: memberRoles } });
      if (!member) return res.status(404).json({ status: false, message: "Member not found" });
      return res.json({ status: true, message: "Member deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
