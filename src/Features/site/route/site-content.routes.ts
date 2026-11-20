import * as express from "express";
import { Request, Response } from "express";
import { SiteContentController } from "../controllers/site-content.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { authorization } from "../../../middlewares/authorization.middleware";
import { Roles } from "../../auth/enums/roles.enum";

const Router = express.Router();

Router.get("/content",
  (req: Request, res: Response) => {
    SiteContentController.listPublic(req, res);
  }
);

Router.get("/admin/content",
  authentification,
  authorization([Roles.ADMIN]),
  (req: Request, res: Response) => {
    SiteContentController.listAdmin(req, res);
  }
);

Router.post("/admin/content",
  authentification,
  authorization([Roles.ADMIN]),
  (req: Request, res: Response) => {
    SiteContentController.create(req, res);
  }
);

Router.patch("/admin/content/:id",
  authentification,
  authorization([Roles.ADMIN]),
  (req: Request, res: Response) => {
    SiteContentController.update(req, res);
  }
);

Router.delete("/admin/content/:id",
  authentification,
  authorization([Roles.ADMIN]),
  (req: Request, res: Response) => {
    SiteContentController.remove(req, res);
  }
);

export default Router;
