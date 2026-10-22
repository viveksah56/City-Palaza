export const TAXONOMY_KIND = {
  CATEGORY: "category",
  BRAND: "brand",
} as const;

export type TaxonomyKind = (typeof TAXONOMY_KIND)[keyof typeof TAXONOMY_KIND];

export const TAXONOMY_CACHE_TAG = {
  [TAXONOMY_KIND.CATEGORY]: "categories",
  [TAXONOMY_KIND.BRAND]: "brands",
} as const;

export const PRODUCT_CATEGORY_SELECTION = {
  CUSTOM: "__custom_category__",
} as const;
