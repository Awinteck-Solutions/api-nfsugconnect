import FeatureRecord from "../schema/feature-record.schema";
import { configSources, itemSources } from "../feature.registry";

function slugify(value: string) {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

function itemSlug(item: any, index: number, slugKeys: string[] = []) {
  if (Array.isArray(item)) return slugify(item[0] || `item-${index + 1}`);
  for (const key of slugKeys) {
    if (item && item[key]) return slugify(item[key]);
  }
  return slugify(item?.title || item?.name || item?.label || `item-${index + 1}`);
}

function normalizeItem(feature: string, item: any) {
  if (feature === "jobs" && Array.isArray(item)) {
    return {
      title: item[0],
      company: item[1],
      category: item[2],
      location: item[3],
      type: item[4],
      salary: item[5],
    };
  }
  if (feature === "companies" && Array.isArray(item)) {
    return { name: item[0], rating: item[1] };
  }
  return item;
}

export async function syncFeatureRecords(catalog: any) {
  const operations: any[] = [];
  const seen = new Set<string>();

  itemSources.forEach((source) => {
    const list = catalog[source.list];
    if (!Array.isArray(list)) return;
    const used = new Set<string>();
    list.forEach((item, index) => {
      let slug = itemSlug(item, index, source.slugKeys || ["slug", "id"]);
      if (used.has(slug)) slug = `${slug}-${index + 1}`;
      used.add(slug);
      seen.add(`${source.feature}:item:${slug}`);
      operations.push({
        updateOne: {
          filter: { feature: source.feature, kind: "item", slug },
          update: { $set: { data: normalizeItem(source.feature, item) } },
          upsert: true,
        },
      });
    });
  });

  const programs = catalog.programTracks || {};
  Object.values(programs).forEach((program: any, index) => {
    const slug = slugify(program.slug || program.title || `program-${index + 1}`);
    seen.add(`programs:item:${slug}`);
    operations.push({
      updateOne: {
        filter: { feature: "programs", kind: "item", slug },
        update: { $set: { data: program } },
        upsert: true,
      },
    });
  });

  configSources.forEach((source) => {
    const data = {};
    source.keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(catalog, key)) data[key] = catalog[key];
    });
    seen.add(`${source.feature}:config:main`);
    operations.push({
      updateOne: {
        filter: { feature: source.feature, kind: "config", slug: "main" },
        update: { $set: { data } },
        upsert: true,
      },
    });
  });

  if (operations.length) {
    await FeatureRecord.bulkWrite(operations);
  }

  return { records: operations.length, features: seen.size };
}
