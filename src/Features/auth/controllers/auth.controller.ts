import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { encrypt } from "../../../helpers/tokenizer";
import { Roles } from "../enums/roles.enum";
import { Status } from "../enums/status.enum";
import { sendMail } from "../../../helpers/emailer";
import User from "../schema/user.schema";
import getRandomInt from "../../../helpers/random";
import { AccessService } from "../../access/services/access.service";

const resetSecret = () => process.env.JWT_RESET_PASSWORD || process.env.JWT_SECRET || "";

function safeMail(promise: Promise<any>) {
  return promise.catch((err) => {
    console.error("[mail] non-blocking failure", err?.message || err);
  });
}

export class AuthController {
  private static normalizeRole(role: string) {
    const requestedRole = String(role || Roles.STUDENT).toUpperCase();
    return [Roles.STUDENT, Roles.ALUMNI, Roles.ADMIN].includes(requestedRole as Roles)
      ? requestedRole
      : Roles.STUDENT;
  }

  private static userPayload(user: any) {
    const source = user.toObject ? user.toObject() : user._doc || user;
    const { password, otp, __v, ...safeUser } = source;
    return safeUser;
  }

  static async signup(req: Request, res: Response) {
    try {
      const { firstname, lastname, email, password, role, classYear, program, yearGroupSlug, alsoAlumni, handle } = req.body;
      if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({
          status: false,
          message: "firstname, lastname, email and password are required",
        });
      }

      const otp = getRandomInt(999, 9999);
      const encryptedPassword = await encrypt.encryptpass(password);
      const normalizedRole = AuthController.normalizeRole(role);
      const year = classYear ? Number(classYear) : null;
      const graduated = Number.isFinite(year) && year > 0 && year <= new Date().getFullYear() && normalizedRole !== Roles.ADMIN;

      const user = await User.create({
        firstname,
        lastname,
        email,
        password: encryptedPassword,
        otp,
        role: graduated ? Roles.ALUMNI : normalizedRole,
        classYear: Number.isFinite(year) ? year : null,
        program: program || null,
        yearGroupSlug: yearGroupSlug || (year ? `class-of-${year}` : null),
        alsoAlumni: Boolean(alsoAlumni) || normalizedRole === Roles.ALUMNI || graduated,
        handle: handle || null,
      });

      const token = encrypt.generateToken({
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
      });

      safeMail(sendMail(user.email, "welcome", { firstname: user.firstname, role: user.role }));
      safeMail(sendMail(user.email, "otp", { firstname: user.firstname, code: String(otp) }));

      return res.status(201).json({
        status: true,
        message: "New User registered",
        response: { ...AuthController.userPayload(user), token },
        user: { ...AuthController.userPayload(user), token },
      });
    } catch (error) {
      console.log("error :>> ", error);
      const duplicateEmail = error && (error as any).code === 11000;
      if (duplicateEmail || (error as any).name === "ValidationError") {
        return res.status(duplicateEmail ? 409 : 400).json({
          status: false,
          message: duplicateEmail ? "Email already registered" : "Unsuccessful registration",
          other: error,
        });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: " email and password required" });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ status: false, message: "User not found" });
      }
      if (user.status !== Status.ACTIVE) {
        return res.status(403).json({ status: false, message: "Account not active" });
      }

      const passwordMatches = encrypt.comparepassword(user.password, password);
      if (!passwordMatches) {
        return res.status(404).json({ status: false, message: "password incorrect!" });
      }

      const token = encrypt.generateToken({
        id: user._id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
      });
      const access = await AccessService.forUser(user);
      return res.json({
        status: true,
        message: "Login success",
        response: {
          ...AuthController.userPayload(user),
          token,
          permissions: access.permissions,
          unrestricted: access.unrestricted,
          adminRole: access.role,
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  static async adminLogin(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ status: false, message: "email and password required" });
      }

      const user = await User.findOne({ email });
      if (!user || user.role !== Roles.ADMIN) {
        return res.status(403).json({ status: false, message: "Admin access required" });
      }
      if (user.status !== Status.ACTIVE) {
        return res.status(403).json({ status: false, message: "Account not active" });
      }

      const passwordMatches = encrypt.comparepassword(user.password, password);
      if (!passwordMatches) {
        return res.status(404).json({ status: false, message: "password incorrect!" });
      }

      const token = encrypt.generateToken({
        id: user._id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
      });
      const access = await AccessService.forUser(user);
      return res.json({
        status: true,
        message: "Login success",
        response: {
          ...AuthController.userPayload(user),
          token,
          permissions: access.permissions,
          unrestricted: access.unrestricted,
          adminRole: access.role,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "Internal server error" });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const email = String(req.body.email || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ status: false, message: "Email is required" });
      }

      const user = await User.findOne({ email });
      // Always respond the same way to avoid email enumeration
      if (user) {
        const token = jwt.sign({ id: user._id, email: user.email, purpose: "reset" }, resetSecret(), {
          expiresIn: "1h",
        });
        const webUrl = process.env.WEB_URL || "https://nfsugnetwork.com";
        safeMail(
          sendMail(user.email, "password-reset", {
            firstname: user.firstname,
            token,
            resetUrl: `${webUrl}/reset-password?token=${encodeURIComponent(token)}`,
          })
        );
      }

      return res.status(200).json({
        status: true,
        message: "If that email is registered, a reset link has been sent",
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, password, newPassword } = req.body;
      const nextPassword = password || newPassword;
      if (!token || !nextPassword) {
        return res.status(400).json({ status: false, message: "token and password are required" });
      }

      let payload: any;
      try {
        payload = jwt.verify(token, resetSecret());
      } catch {
        return res.status(400).json({ status: false, message: "Invalid or expired reset token" });
      }

      if (payload?.purpose && payload.purpose !== "reset") {
        return res.status(400).json({ status: false, message: "Invalid reset token" });
      }

      const user = await User.findById(payload.id);
      if (!user) {
        return res.status(404).json({ status: false, message: "User not found" });
      }

      user.password = await encrypt.encryptpass(nextPassword);
      await user.save();

      safeMail(sendMail(user.email, "password-reset-success", { firstname: user.firstname }));

      return res.status(200).json({
        status: true,
        message: "Your password has been reset successfully",
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}
