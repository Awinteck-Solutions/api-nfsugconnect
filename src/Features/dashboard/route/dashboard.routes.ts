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
