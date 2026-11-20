import Role from "../schema/role.schema";
import { permissionActions } from "../access.catalog";

export class AccessService {
  static async forUser(user: any) {
    if (!user?.adminRole) {
      return { role: null, permissions: [], unrestricted: false };
    }
    const role = await Role.findById(user.adminRole);
    if (!role) return { role: null, permissions: [], unrestricted: false };
    return {
      role: {
        id: role._id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        isSystem: role.isSystem,
      },
      permissions: role.permissions || [],
      unrestricted: role.slug === "super-admin",
    };
  }

  static allows(access: any, feature: string, action: string) {
    if (!access) return false;
    if (access.unrestricted) return true;
    const permission = (access.permissions || []).find((item) => item.feature === feature);
    return Boolean(permission && permission.actions && permission.actions.includes(action));
  }

  static sanitizePermissions(permissions: any[] = []) {
    return permissions
      .filter((permission) => permission && permission.feature)
      .map((permission) => ({
        feature: String(permission.feature),
        actions: (permission.actions || []).filter((action) => permissionActions.includes(action)),
      }));
  }
}
