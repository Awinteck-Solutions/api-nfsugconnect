import * as express from "express";
import { Request, Response } from "express";
import { DashboardController } from "../controllers/dashboard.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { authorization } from "../../../middlewares/authorization.middleware";
import { Roles } from "../../auth/enums/roles.enum";

const Router = express.Router();

Router.get("/me",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.currentUserDashboard(req, res);
  }
);

Router.post("/me/bookmarks",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.toggleBookmark(req, res);
  }
);

Router.post("/me/messages",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.sendMessage(req, res);
  }
);

Router.patch("/me/notifications",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.updateNotificationPrefs(req, res);
  }
);

Router.post("/me/notifications/read",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.markNotificationsRead(req, res);
  }
);

Router.post("/me/communities",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.joinCommunity(req, res);
  }
);

Router.post("/me/communities/leave",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.leaveCommunity(req, res);
  }
);

Router.patch("/me/year-group",
  authentification,
  (req: Request, res: Response) => {
    DashboardController.updateYearGroupCommunity(req, res);
  }
);

Router.get("/admin",
  authentification,
  authorization([Roles.ADMIN]),
  (req: Request, res: Response) => {
    DashboardController.adminDashboard(req, res);
  }
);

export default Router;
