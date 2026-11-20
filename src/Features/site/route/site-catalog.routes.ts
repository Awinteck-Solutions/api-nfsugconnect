import * as express from "express";
import { Request, Response } from "express";
import { SiteCatalogController } from "../controllers/site-catalog.controller";

const Router = express.Router();

Router.get("/", (req: Request, res: Response) => {
  SiteCatalogController.getPublic(req, res);
});

export default Router;
