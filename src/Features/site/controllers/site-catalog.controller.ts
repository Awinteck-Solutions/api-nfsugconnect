import { Request, Response } from "express";
import SiteCatalog from "../schema/site-catalog.schema";

export class SiteCatalogController {
  static async getPublic(req: Request, res: Response) {
    try {
      const catalog = await SiteCatalog.findOne({ key: "public" });
      return res.status(200).json({
        status: true,
        message: "Site content loaded",
        response: catalog?.data || {},
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }
}
