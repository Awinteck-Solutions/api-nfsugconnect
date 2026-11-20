import { Request, Response } from "express";
import SiteContent from "../schema/site-content.schema";

export class SiteContentController {
  static async listPublic(req: Request, res: Response) {
    try {
      const { section } = req.query;
      const filter: any = { status: "PUBLISHED" };
      if (section) {
        filter.section = section;
      }

      const response = await SiteContent.find(filter).sort({ updatedAt: -1 });
      return res.status(200).json({ status: true, message: "Content loaded", response });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async listAdmin(req: Request, res: Response) {
    try {
      const response = await SiteContent.find().sort({ updatedAt: -1 });
      return res.status(200).json({ status: true, message: "Content loaded", response });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { section, title, body, status, metadata } = req.body;
      if (!section || !title) {
        return res.status(400).json({ status: false, message: "section and title are required" });
      }

      const response = await SiteContent.create({
        section,
        title,
        body,
        status,
        metadata,
        updatedBy: req["currentUser"].id,
      });
      return res.status(201).json({ status: true, message: "Content created", response });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const allowedFields = ["section", "title", "body", "status", "metadata"];
      const updates: any = { updatedBy: req["currentUser"].id };
      allowedFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field];
        }
      });

      const response = await SiteContent.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      });
      if (!response) {
        return res.status(404).json({ status: false, message: "Content not found" });
      }
      return res.status(200).json({ status: true, message: "Content updated", response });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const response = await SiteContent.findByIdAndDelete(req.params.id);
      if (!response) {
        return res.status(404).json({ status: false, message: "Content not found" });
      }
      return res.status(200).json({ status: true, message: "Content deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
