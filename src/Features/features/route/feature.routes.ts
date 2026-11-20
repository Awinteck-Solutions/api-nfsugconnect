import * as express from "express";
import { Request, Response } from "express";
import { FeatureController } from "../controllers/feature.controller";
import { featureDefinitions } from "../feature.registry";
import { authentification } from "../../../middlewares/authentication.middleware";
import { requirePermission } from "../../../middlewares/permission.middleware";
import { optionalAuthentication } from "../../../middlewares/optional-authentication.middleware";

const Router = express.Router();

function mountFeature(path: string, feature: string, actions: string[]) {
  Router.get(`${path}/settings`, (req: Request, res: Response) => {
    FeatureController.settings(feature, req, res);
  });
  Router.put(`${path}/settings`, authentification, requirePermission(feature, "update"), (req: Request, res: Response) => {
    FeatureController.updateSettings(feature, req, res);
  });
  Router.get(path, optionalAuthentication, (req: Request, res: Response) => {
    FeatureController.list(feature, req, res);
  });
  Router.get(`${path}/:slug`, optionalAuthentication, (req: Request, res: Response) => {
    FeatureController.detail(feature, req, res);
  });
  Router.post(path, authentification, requirePermission(feature, "create"), (req: Request, res: Response) => {
    FeatureController.create(feature, req, res);
  });
  Router.patch(`${path}/:slug`, authentification, requirePermission(feature, "update"), (req: Request, res: Response) => {
    FeatureController.update(feature, req, res);
  });
  Router.delete(`${path}/:slug`, authentification, requirePermission(feature, "delete"), (req: Request, res: Response) => {
    FeatureController.remove(feature, req, res);
  });
  actions.forEach((action) => {
    Router.post(`${path}/:slug/${action}`, optionalAuthentication, (req: Request, res: Response) => {
      FeatureController.action(feature, action, req, res);
    });
  });
}

Router.get("/features", (req: Request, res: Response) => {
  FeatureController.manifest(req, res);
});
Router.get("/home", (req: Request, res: Response) => {
  FeatureController.settings("home", req, res);
});
Router.get("/alumni", (req: Request, res: Response) => {
  FeatureController.settings("alumni", req, res);
});
Router.get("/about", (req: Request, res: Response) => {
  FeatureController.settings("about", req, res);
});
Router.get("/about/vision", (req: Request, res: Response) => {
  FeatureController.settings("about", req, res);
});
["home", "alumni", "about"].forEach((page) => {
  Router.put(`/${page}`, authentification, requirePermission("site-pages", "update"), (req: Request, res: Response) => {
    FeatureController.updateSettings(page, req, res);
  });
});
Router.post("/newsletter", optionalAuthentication, (req: Request, res: Response) => {
  FeatureController.newsletter(req, res);
});

featureDefinitions.forEach((definition) => {
  mountFeature(definition.path, definition.feature, definition.actions);
});

export default Router;
