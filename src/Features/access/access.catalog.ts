import { featureDefinitions } from "../features/feature.registry";

export const permissionActions = ["create", "read", "update", "delete"];

export const sitePageFeatures = ["home", "alumni", "about"];

export const accessFeatures = [
  ...featureDefinitions.map((feature) => feature.feature),
  "site-pages",
  "submissions",
  "members",
  "roles",
  "admin-users",
];

export function fullPermissions() {
  return accessFeatures.map((feature) => ({
    feature,
    actions: [...permissionActions],
  }));
}
