import { Request, Response } from "express";
import { UserResponse } from "../dto/user.dto";
import { Status } from "../enums/status.enum";
import multer from "multer";
import User from "../schema/user.schema";
import { encrypt } from "../../../helpers/tokenizer";

// Extend Express Request to include Multer's file property
interface MulterRequest extends Request {
  file: multer.File;
}

const SOCIAL_KEYS = ["linkedin", "twitter", "instagram", "facebook", "youtube", "tiktok", "website", "github", "whatsapp"];
const TEXT_LIMITS: Record<string, number> = {
  firstname: 80,
  lastname: 80,
  phoneNumber: 40,
  profileImage: 500,
  program: 160,
  yearGroupSlug: 80,
  handle: 80,
  headline: 160,
  bio: 2000,
  location: 120,
  organisation: 160,
  interests: 400,
};

function cleanSocials(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const socials: Record<string, string> = {};
  SOCIAL_KEYS.forEach((key) => {
    if (typeof source[key] === "string") socials[key] = source[key].trim().slice(0, 300);
  });
  return socials;
}
export class UserController {
  // Admin routes

 

  // DELETE ACCOUNT
  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;

      User.deleteOne({_id:id})
      .then((result) => {
          return res.status(201).json({
              status:true,
              message: 'User delete success', 
          });
      }).catch((error) => {
          return res.status(404).json({
              status: false,
              message: 'User delete failed',
              other: error
          });
      })
  
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error"
        });
    }
  }

  // GET ALL USERS
  static async getAllUsers(req: Request, res: Response) {
    try {
      User.find()
      .then((result) => {
          return res.status(201).json({
              status:true,
              message: 'User success',
              response: result,
          });
      }).catch((error) => {
          return res.status(404).json({
              status: false,
              message: 'User failed',
              other: error
          });
      })
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error"
        });
    }
  }

  // GET SINGLE USERS
  static async getOneUser(req: Request, res: Response) {
    try {
      let { id } = req.params;
      User.findOne({_id:id})
        .then((response) => {
            return res.status(201).json({
                status:true,
                message: 'User success', 
                response
            });
        }).catch((error) => {
            return res.status(404).json({
                status: false,
                message: 'User failed',
                other: error
            });
        })

    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error"
        });
    }
  }

  // GET ALL USERS
  static async updateUserStatus(req: Request, res: Response) {
    try {
      let { id } = req.params;
      let { status } = req.body;
      User.findOneAndUpdate(
        { _id: id }, 
        { $set: { status } },
        { new: true, runValidators: true }
      )
        .then((response) => {
            return res.status(201).json({
                status:true,
              message: 'User success', 
                response
            });
        }).catch((error) => {
            return res.status(404).json({
                status: false,
                message: 'User failed',
                other: error
            });
        })
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error"
        });
    }
  }


  
  // User routes
  // GET PROFILE
  static async profile(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"];
      User.findOne({_id:id}).select("-password -otp -__v")
      .then((response) => {
          return res.status(201).json({
              status:true,
              message: 'User success', 
              response
          });
      }).catch((error) => {
          return res.status(404).json({
              status: false,
              message: 'User failed',
              other: error
          });
      })
    } catch (error) {
      return res
        .status(500)
        .json({
          success: false,
          message: "Internal server error"
        });
    }
  }

  static async updateUser(req: MulterRequest, res: Response) {
    try {
      const id = req.params.id || req["currentUser"].id;
      const existing = await User.findById(id).select("classYear role alsoAlumni");
      if (!existing) return res.status(404).json({ status: false, message: "User not found" });
      const yearLocked = Boolean(existing.classYear);
      const allowedFields = ["firstname", "lastname", "phoneNumber", "profileImage", "classYear", "program", "yearGroupSlug", "handle", "alsoAlumni", "headline", "bio", "location", "organisation", "interests", "socials"];
      if (req.params.id) allowedFields.push("role", "status");
      const updates = { ...req.body };
      if (yearLocked && !req.params.id) {
        delete updates.classYear;
        delete updates.yearGroupSlug;
      }
      const profileImage = req.file ? req.file.filename : null;

      const user:any = {};
      // Only allow updates for specific fields
      Object.keys(updates).forEach((key) => {
        if (!allowedFields.includes(key)) return;
        if (key === "socials") {
          user.socials = cleanSocials(updates.socials);
          return;
        }
        if (typeof updates[key] === "string" && TEXT_LIMITS[key]) {
          user[key] = updates[key].trim().slice(0, TEXT_LIMITS[key]);
          return;
        }
        user[key] = updates[key];
      });

      // Update profile image if provided
      if (profileImage) {
        user.profileImage = profileImage;
      }

      const classYear = yearLocked ? existing.classYear : (user.classYear ?? existing.classYear);
      const graduated = Number(classYear) > 0 && Number(classYear) <= new Date().getFullYear();
      if (graduated && !req.params.id) {
        user.role = "ALUMNI";
        user.alsoAlumni = true;
      }
      if (!yearLocked && user.classYear) {
        user.yearGroupSlug = `class-of-${user.classYear}`;
      }

      User.updateOne({_id:id}, {...user}, {upsert:false})
        .then(() => {
            return res.status(201).json({
                status:true,
                message: 'User update success',
                response: {
                  role: user.role || existing.role,
                  alsoAlumni: user.alsoAlumni !== undefined ? Boolean(user.alsoAlumni) : Boolean(existing.alsoAlumni),
                  classYear: classYear || null,
                  yearLocked: yearLocked || Boolean(user.classYear),
                  graduated,
                },
            });
        }).catch((error) => {
            return res.status(404).json({
                status: false,
                message: 'User update failed',
                other: error
            });
        })
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }

  // CHANGE PASSWORD
  static async changePassword(req: Request, res: Response) {
    try {
      const { id } = req["currentUser"];
      const { password, newPassword } = req.body;
      if (!password || !newPassword) {
        return res.status(400).json({ status: false, message: "Current and new password are required" });
      }
      if (String(newPassword).length < 6) {
        return res.status(400).json({ status: false, message: "New password must be at least 6 characters" });
      }
      const existing = await User.findById(id);
      if (!existing || !existing.password || !encrypt.comparepassword(existing.password, password)) {
        return res.status(400).json({ status: false, message: "Current password is incorrect" });
      }

      const encryptPassword = await encrypt.encryptpass(newPassword);
      User.updateOne({ _id: id }, { password: encryptPassword }, { upsert: false })
      .then((result) => {
          return res.status(201).json({
              status:true,
              message: 'User update success', 
          });
      }).catch((error) => {
          return res.status(404).json({
              status: false,
              message: 'User update failed',
              other: error
          });
      })

      
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
}
