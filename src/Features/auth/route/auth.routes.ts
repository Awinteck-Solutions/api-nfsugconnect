import * as express from "express"; 
import {Response, Request} from "express"; 
import * as multer from 'multer';
import path = require("path");
import { Roles } from "../enums/roles.enum";
import { AuthController } from "../controllers/auth.controller";
import { authentification } from "../../../middlewares/authentication.middleware";
import { Notification } from "../enums/notification.enum";
import { upload } from "../../../helpers/uploader";


const Router = express.Router();

// ----------------------------------------- USER ROUTES ---------------------------------------------------
//
// AUTH
Router.post("/signup",
    (req: Request, res: Response) => { 
        AuthController.signup(req, res)
    }
);

Router.post("/register",
    (req: Request, res: Response) => { 
        AuthController.signup(req, res)
    }
);

Router.post("/login",
    (req: Request, res: Response) => { 
        AuthController.login(req, res)
    }
);

Router.post("/admin/login",
    (req: Request, res: Response) => { 
        AuthController.adminLogin(req, res)
    }
);

Router.post("/admin/register",
    (req: Request, res: Response) => {
        req.body.role = Roles.ADMIN;
        AuthController.signup(req, res)
    }
);


// FORGET PASSWORD
Router.post("/forgot-password",
    // notification(Notification.FORGOT_PASSWORD),
    (req: Request, res: Response) => { 
        AuthController.forgotPassword(req,res)
    }
);

// RESET PASSWORD
Router.post("/reset-password",
    // notification(Notification.RESET_PASSWORD),
    (req: Request, res: Response) => { 
        AuthController.resetPassword(req,res)
    }
);

export default Router;