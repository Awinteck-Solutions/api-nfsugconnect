export type FeatureDefinition = {
  feature: string;
  path: string;
  actions: string[];
};

export const featureDefinitions: FeatureDefinition[] = [
  { feature: "jobs", path: "/jobs", actions: ["applications"] },
  { feature: "events", path: "/events", actions: ["rsvp"] },
  { feature: "news", path: "/news", actions: [] },
  { feature: "scholarships", path: "/scholarships", actions: ["applications"] },
  { feature: "resource-categories", path: "/resources/categories", actions: [] },
  { feature: "resources", path: "/resources", actions: [] },
  { feature: "success-stories", path: "/success-stories", actions: [] },
  { feature: "marketplace", path: "/marketplace", actions: ["enquiries"] },
  { feature: "support", path: "/support", actions: ["donations"] },
  { feature: "community", path: "/community", actions: ["join", "messages"] },
  { feature: "alumni-profiles", path: "/alumni/profiles", actions: ["connect", "messages"] },
  { feature: "year-groups", path: "/alumni/year-groups", actions: ["join", "posts", "comments", "rsvp"] },
  { feature: "mentors", path: "/alumni/mentors", actions: ["requests"] },
  { feature: "leadership", path: "/about/leadership", actions: [] },
  { feature: "staff", path: "/about/staff", actions: [] },
  { feature: "programs", path: "/about/programs", actions: [] },
];

export const itemSources = [
  { feature: "jobs", list: "jobs" },
  { feature: "events", list: "events", slugKeys: ["slug", "id"] },
  { feature: "news", list: "newsArticles", slugKeys: ["slug", "id"] },
  { feature: "scholarships", list: "scholarships", slugKeys: ["slug", "id"] },
  { feature: "resources", list: "resourceFiles", slugKeys: ["slug", "id"] },
  { feature: "resource-categories", list: "featuredResourceCategories", slugKeys: ["id", "slug"] },
  { feature: "success-stories", list: "successStories", slugKeys: ["id", "title"] },
  { feature: "marketplace", list: "marketplaceListings", slugKeys: ["slug", "id"] },
  { feature: "support", list: "supportCampaigns", slugKeys: ["slug", "id"] },
  { feature: "community", list: "communityGroups", slugKeys: ["slug", "id"] },
  { feature: "alumni-profiles", list: "alumniProfiles", slugKeys: ["slug", "id"] },
  { feature: "year-groups", list: "yearGroups", slugKeys: ["slug", "id"] },
  { feature: "mentors", list: "mentors", slugKeys: ["slug", "id"] },
  { feature: "leadership", list: "leadershipTeam", slugKeys: ["id", "name"] },
  { feature: "staff", list: "staffDirectory", slugKeys: ["id", "email", "name"] },
];

export const configSources = [
  { feature: "home", keys: ["homePage", "homeNavItems", "partnerLogos", "platformStats", "heroRotatingWords", "heroFloatingStats", "departmentOverview", "bentoModules", "homeTestimonials", "BRAND_NAME", "footerSocialLinks"] },
  { feature: "jobs", keys: ["sectionText", "cardCopy", "similarJobs", "companies"] },
  { feature: "events", keys: ["eventGroups"] },
  { feature: "news", keys: ["newsCategories"] },
  { feature: "scholarships", keys: ["scholarshipFilterOptions", "scholarshipTabs"] },
  { feature: "resources", keys: ["resourceTabs", "resourcePreviewFiles"] },
  { feature: "success-stories", keys: ["successStoryTabs", "featuredSuccessStory"] },
  { feature: "marketplace", keys: ["marketplaceCategories", "marketplaceOwnerTypes"] },
  { feature: "support", keys: ["DONATION_PRESETS", "supportFeatured", "wallOfSupportDonors", "SUPPORT_CAMPAIGN_STATUSES", "supportStatusLabels", "DEPARTMENT_NAME"] },
  { feature: "community", keys: ["COMMUNITY_TABS", "COMMUNITY_PREVIEW_TABS", "communityMembers", "communityChatBySlug", "defaultCommunitySettings"] },
  { feature: "alumni", keys: ["alumniStats", "alumniQuickActions", "alumniCountries", "alumniSpotlight", "alumniTestimonials", "alumniDirectoryFilters", "alumniPrograms", "yearGroupPosts"] },
  { feature: "about", keys: ["visionMissionContent", "aboutNavItems", "aboutProgramsNav", "aboutSubNavLinks"] },
];
