import { NextFunction, Request, Response } from "express";
import User from "../Features/auth/schema/user.schema";
import { AccessService } from "../Features/access/services/access.service";

export const requirePermission = (feature: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const currentUser = req["currentUser"];
      if (!currentUser?.id) {
        res.status(401).json({ status: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findById(currentUser.id);
      if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
        res.status(403).json({ status: false, message: "Admin access required" });
        return;
      }

      const access = await AccessService.forUser(user);
      if (!AccessService.allows(access, feature, action)) {
        res.status(403).json({ status: false, message: "You do not have permission for this action" });
        return;
      }

      req["access"] = access;
      next();
    } catch (error) {
      res.status(403).json({ status: false, message: "Denied" });
    }
  };
};
