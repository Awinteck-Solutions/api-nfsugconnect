import { Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import Role from "../schema/role.schema";
import User from "../../auth/schema/user.schema";
import { AccessService } from "../services/access.service";
import { accessFeatures, fullPermissions, permissionActions, sitePageFeatures } from "../access.catalog";
import { featureDefinitions } from "../../features/feature.registry";
import { sendMail } from "../../../helpers/emailer";

function slugify(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `role-${Date.now()}`;
}

function presentRole(role: any) {
  return {
    id: role._id,
    name: role.name,
    slug: role.slug,
    description: role.description,
    isSystem: role.isSystem,
    permissions: role.permissions,
  };
}

export class AccessController {
  static async session(req: Request, res: Response) {
    try {
      const user = await User.findById(req["currentUser"].id).select("-password -otp");
      if (!user || user.role !== "ADMIN") return res.status(403).json({ status: false, message: "Admin access required" });
      const access = await AccessService.forUser(user);
      const roles = await Role.find().select("name slug").sort({ name: 1 });
      return res.json({
        status: true,
        response: {
          user,
          ...access,
          roles: roles.map((role) => ({ id: role._id, name: role.name, slug: role.slug })),
          actions: permissionActions,
          features: featureDefinitions,
          sitePages: sitePageFeatures,
          permissionFeatures: accessFeatures,
        },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async listRoles(req: Request, res: Response) {
    try {
      const roles = await Role.find().sort({ createdAt: 1 });
      return res.json({ status: true, response: roles.map(presentRole) });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async saveRole(req: Request, res: Response) {
    try {
      const name = String(req.body.name || "").trim();
      if (!name) return res.status(400).json({ status: false, message: "Role name is required" });
      const slug = req.body.slug ? slugify(req.body.slug) : slugify(name);
      const existing = req.params.id ? await Role.findById(req.params.id) : null;
      if (req.params.id && !existing) return res.status(404).json({ status: false, message: "Role not found" });
      if (existing?.isSystem && slug !== existing.slug) {
        return res.status(400).json({ status: false, message: "The system role slug cannot be changed" });
      }

      const payload = {
        name,
        slug: existing?.isSystem ? existing.slug : slug,
        description: req.body.description || "",
        permissions: AccessService.sanitizePermissions(req.body.permissions),
      };
      const role = existing
        ? await Role.findByIdAndUpdate(existing._id, payload, { new: true })
        : await Role.create(payload);
      return res.status(existing ? 200 : 201).json({ status: true, message: "Role saved", response: presentRole(role) });
    } catch (error) {
      if (error && error.code === 11000) return res.status(409).json({ status: false, message: "Role name already exists" });
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async removeRole(req: Request, res: Response) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) return res.status(404).json({ status: false, message: "Role not found" });
      if (role.isSystem) return res.status(400).json({ status: false, message: "The system role cannot be deleted" });
      const assigned = await User.countDocuments({ adminRole: role._id });
      if (assigned) return res.status(400).json({ status: false, message: "Remove this role from admin users before deleting it" });
      await role.deleteOne();
      return res.json({ status: true, message: "Role deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async listUsers(req: Request, res: Response) {
    try {
      const users = await User.find({ role: "ADMIN" }).select("-password -otp").populate("adminRole", "name slug");
      return res.json({ status: true, response: users });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async saveUser(req: Request, res: Response) {
    try {
      const { firstname, lastname, email, password, adminRole, status } = req.body;
      if (!req.params.id && (!firstname || !lastname || !email || !password || !adminRole)) {
        return res.status(400).json({ status: false, message: "Name, email, password, and role are required" });
      }
      if (adminRole) {
        const role = await Role.findById(adminRole);
        if (!role) return res.status(400).json({ status: false, message: "Selected role does not exist" });
      }

      if (!req.params.id) {
        const roleDoc = adminRole ? await Role.findById(adminRole) : null;
        const user = await User.create({
          firstname,
          lastname,
          email: String(email).toLowerCase(),
          password: bcrypt.hashSync(password, 12),
          role: "ADMIN",
          adminRole,
          status: status || "ACTIVE",
        });
        const saved = await User.findById(user._id).select("-password -otp").populate("adminRole", "name slug");
        sendMail(String(email).toLowerCase(), "admin-invite", {
          firstname,
          roleName: roleDoc?.name || saved?.adminRole?.["name"] || "Administrator",
          temporaryPassword: password,
        }).catch((err) => console.error("[mail] admin-invite failed", err?.message || err));
        return res.status(201).json({ status: true, message: "Admin user created", response: saved });
      }

      const updates: any = {};
      if (firstname) updates.firstname = firstname;
      if (lastname) updates.lastname = lastname;
      if (email) updates.email = String(email).toLowerCase();
      if (status) updates.status = status;
      if (adminRole) updates.adminRole = adminRole;
      if (password) updates.password = bcrypt.hashSync(password, 12);
      const user = await User.findOneAndUpdate({ _id: req.params.id, role: "ADMIN" }, updates, { new: true })
        .select("-password -otp")
        .populate("adminRole", "name slug");
      if (!user) return res.status(404).json({ status: false, message: "Admin user not found" });
      return res.json({ status: true, message: "Admin user updated", response: user });
    } catch (error) {
      if (error && error.code === 11000) return res.status(409).json({ status: false, message: "Email already exists" });
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static async removeUser(req: Request, res: Response) {
    try {
      if (String(req.params.id) === String(req["currentUser"].id)) {
        return res.status(400).json({ status: false, message: "You cannot delete your own account" });
      }
      const user = await User.findOneAndDelete({ _id: req.params.id, role: "ADMIN" });
      if (!user) return res.status(404).json({ status: false, message: "Admin user not found" });
      return res.json({ status: true, message: "Admin user deleted" });
    } catch (error) {
      return res.status(500).json({ status: false, message: "System error" });
    }
  }

  static defaultPermissions() {
    return fullPermissions();
  }
}
