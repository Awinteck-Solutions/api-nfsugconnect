import * as express from "express";
import { Request, Response } from "express";
import { authentification } from "../../../middlewares/authentication.middleware";
import { requirePermission } from "../../../middlewares/permission.middleware";
import { AccessController } from "../controllers/access.controller";
import { AdminDataController } from "../controllers/admin-data.controller";
import { UploadController, receiveFile, receiveImage } from "../controllers/upload.controller";
import { authorization } from "../../../middlewares/authorization.middleware";
import { Roles } from "../../auth/enums/roles.enum";

const Router = express.Router();

Router.get("/access", authentification, (req: Request, res: Response) => {
  AccessController.session(req, res);
});

Router.get("/roles", authentification, requirePermission("roles", "read"), (req: Request, res: Response) => {
  AccessController.listRoles(req, res);
});
Router.post("/roles", authentification, requirePermission("roles", "create"), (req: Request, res: Response) => {
  AccessController.saveRole(req, res);
});
Router.patch("/roles/:id", authentification, requirePermission("roles", "update"), (req: Request, res: Response) => {
  AccessController.saveRole(req, res);
});
Router.delete("/roles/:id", authentification, requirePermission("roles", "delete"), (req: Request, res: Response) => {
  AccessController.removeRole(req, res);
});

Router.get("/users", authentification, requirePermission("admin-users", "read"), (req: Request, res: Response) => {
  AccessController.listUsers(req, res);
});
Router.post("/users", authentification, requirePermission("admin-users", "create"), (req: Request, res: Response) => {
  AccessController.saveUser(req, res);
});
Router.patch("/users/:id", authentification, requirePermission("admin-users", "update"), (req: Request, res: Response) => {
  AccessController.saveUser(req, res);
});
Router.delete("/users/:id", authentification, requirePermission("admin-users", "delete"), (req: Request, res: Response) => {
  AccessController.removeUser(req, res);
});

Router.post("/uploads", authentification, authorization([Roles.ADMIN]), receiveImage, (req: Request, res: Response) => {
  UploadController.image(req, res);
});
Router.post("/uploads/files", authentification, authorization([Roles.ADMIN]), receiveFile, (req: Request, res: Response) => {
  UploadController.file(req, res);
});

Router.get("/submissions", authentification, requirePermission("submissions", "read"), (req: Request, res: Response) => {
  AdminDataController.listSubmissions(req, res);
});
Router.patch("/submissions/:id", authentification, requirePermission("submissions", "update"), (req: Request, res: Response) => {
  AdminDataController.updateSubmission(req, res);
});
Router.delete("/submissions/:id", authentification, requirePermission("submissions", "delete"), (req: Request, res: Response) => {
  AdminDataController.removeSubmission(req, res);
});

Router.get("/members", authentification, requirePermission("members", "read"), (req: Request, res: Response) => {
  AdminDataController.listMembers(req, res);
});
Router.get("/members/:id", authentification, requirePermission("members", "read"), (req: Request, res: Response) => {
  AdminDataController.memberDetail(req, res);
});
Router.patch("/members/:id", authentification, requirePermission("members", "update"), (req: Request, res: Response) => {
  AdminDataController.updateMember(req, res);
});
Router.delete("/members/:id", authentification, requirePermission("members", "delete"), (req: Request, res: Response) => {
  AdminDataController.removeMember(req, res);
});

export default Router;
