import { NextFunction, Request, Response } from "express";
import * as jwt from "jsonwebtoken";

export const optionalAuthentication = (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const token = header && header.split(" ")[1];
    if (token) {
      req["currentUser"] = jwt.verify(token, process.env.JWT_SECRET);
    }
  } catch (error) {
    req["currentUser"] = null;
  }
  next();
};
