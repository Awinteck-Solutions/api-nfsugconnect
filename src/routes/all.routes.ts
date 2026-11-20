import * as express from "express"; 
import path = require("path");

import userRoutes from "../Features/auth/route/user.routes";
import authRoutes from "../Features/auth/route/auth.routes";
import accountsRoutes from '../Features/accounts/route/accounts.route';
import dashboardRoutes from "../Features/dashboard/route/dashboard.routes";
import siteContentRoutes from "../Features/site/route/site-content.routes";
import siteCatalogRoutes from "../Features/site/route/site-catalog.routes";
import featureRoutes from "../Features/features/route/feature.routes";
import accessRoutes from "../Features/access/route/access.routes";

const Router = express.Router();

/**
 * @swagger
 * /auth:
 *   get:
 *     summary: Authentication routes
 */
Router.use("/auth", authRoutes);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: User routes
 */
Router.use("/users", userRoutes);

Router.use("/dashboard", dashboardRoutes);

Router.use("/admin", accessRoutes);

Router.use("/site", siteContentRoutes);

Router.use("/content", siteCatalogRoutes);

Router.use("/", featureRoutes);

Router.use("/test", accountsRoutes);
 


export { Router }