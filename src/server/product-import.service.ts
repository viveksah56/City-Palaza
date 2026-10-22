import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import { Prisma, type TrackingType } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { toDb, money } from "@/lib/money";
import { slugify } from "@/lib/format";
import { normalizeSerials } from "@/lib/imei";
import { productSchema } from "@/validations/product";
import { addStockTx, type Actor } from "./inventory.service";
import { writeAudit } from "@/lib/audit";
import { timeServerOperation } from "./timing";

const MAX_ROWS = 250;
const MAX_CSV_CHARS = 1_000_000;
const REQUIRED_HEADERS = ["sku", "name", "category", "purchasePrice", "sellingPrice", "quantity", "trackingType"];
const HEADER_ALIASES: Record<string, string> = {
  product: "name", productname: "name", variant: "variantLabel", variantlabel: "variantLabel", cost: "purchasePrice", purchaseprice: "purchasePrice",
  price: "sellingPrice", sellingprice: "sellingPrice", discount: "discountPercent", discountpercent: "discountPercent", openingstock: "quantity",
  stock: "quantity", quantity: "quantity", minstock: "minStock", trackingtype: "trackingType", serialnumbers: "serials",
};

export type ImportIssue = { row: number; sku?: string; message: string };

type ParsedProduct = {
  row: number;
  sku: string;
  categoryName: string;
  brandName?: string;
  trackingType: TrackingType;
  serials: string[];
  quantity: number;
  value: z.infer<typeof productSchema>;
};

function parseCsv(source: string): string[][] {
  if (source.length > MAX_CSV_CHARS) throw new DomainError("VALIDATION", "CSV file is too large. Maximum size is 1 MB.");
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new DomainError("VALIDATION", "CSV contains an unclosed quoted field.");
  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  if (rows.length < 2) throw new DomainError("VALIDATION", "Add a header row and at least one product row.");
  if (rows.length - 1 > MAX_ROWS) throw new DomainError("VALIDATION", `A batch can contain at most ${MAX_ROWS} products.`);
  return rows;
}

function headerKey(value: string) {
  const normalized = value.trim().replace(/^\uFEFF/, "").replace(/\s+/g, "").toLowerCase();
  return HEADER_ALIASES[normalized] ?? normalized;
}

function parseRows(source: string): { products: ParsedProduct[]; issues: ImportIssue[] } {
  const [headerRow, ...dataRows] = parseCsv(source);
  const headers = headerRow!.map(headerKey);
  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length) throw new DomainError("VALIDATION", `Missing required CSV columns: ${missing.join(", ")}.`);
  if (new Set(headers).size !== headers.length) throw new DomainError("VALIDATION", "CSV has duplicate column headers.");

  const products: ParsedProduct[] = [];
  const issues: ImportIssue[] = [];
  const skus = new Set<string>();
  const barcodes = new Set<string>();
  const serialOwners = new Map<string, number>();

  for (const [index, cells] of dataRows.entries()) {
    const rowNumber = index + 2;
    if (cells.length > headers.length) {
      issues.push({ row: rowNumber, message: `Found ${cells.length} columns but the header has ${headers.length}.` });
      continue;
    }
    const record = Object.fromEntries(headers.map((header, column) => [header, (cells[column] ?? "").trim()]));
    const sku = String(record.sku ?? "").trim().toUpperCase();
    const categoryName = String(record.category ?? "").trim();
    const brandName = String(record.brand ?? "").trim() || undefined;
    const trackingRaw = String(record.trackingType ?? "QUANTITY").trim().toUpperCase();
    const trackingType = trackingRaw as TrackingType;
    const serialsRaw = String(record.serials ?? "");
    const serials = serialsRaw.split(/[|;\n]/).map((serial) => serial.trim()).filter(Boolean);
    const quantityRaw = String(record.quantity ?? "").trim();
    const quantity = quantityRaw ? Number(quantityRaw) : trackingType === "QUANTITY" ? 0 : serials.length;
    if (!Number.isSafeInteger(quantity) || quantity < 0) issues.push({ row: rowNumber, sku, message: "Quantity must be a non-negative whole number." });

    if (sku && skus.has(sku)) issues.push({ row: rowNumber, sku, message: "SKU is repeated in this file." });
    if (sku) skus.add(sku);
    const barcode = String(record.barcode ?? "").trim();
    if (barcode && barcodes.has(barcode)) issues.push({ row: rowNumber, sku, message: "Barcode is repeated in this file." });
    if (barcode) barcodes.add(barcode);
    if (!categoryName) issues.push({ row: rowNumber, sku, message: "Category is required." });

    const value = productSchema.safeParse({
      sku,
      barcode: barcode || undefined,
      name: record.name,
      variantLabel: record.variantLabel || undefined,
      description: record.description || undefined,
      categoryId: "bulk-import-category",
      brandId: undefined,
      purchasePrice: Number(record.purchasePrice),
      sellingPrice: Number(record.sellingPrice),
      discountPercent: record.discountPercent ? Number(record.discountPercent) : 0,
      minStock: record.minStock ? Number(record.minStock) : 5,
      trackingType,
      status: record.status ? String(record.status).toUpperCase() : "ACTIVE",
      initialQuantity: quantity,
      initialSerials: serials.join("\n"),
    });
    if (!value.success) {
      for (const issue of value.error.issues) issues.push({ row: rowNumber, sku, message: issue.message });
      continue;
    }
    if (trackingType !== "QUANTITY" && quantity !== serials.length) {
      issues.push({ row: rowNumber, sku, message: `Quantity must match the ${serials.length} serial number(s) provided.` });
      continue;
    }
    if (trackingType === "QUANTITY" && serials.length) {
      issues.push({ row: rowNumber, sku, message: "Quantity tracked products must leave the serials column empty." });
      continue;
    }
    try {
      const normalized = normalizeSerials(serials, trackingType);
      for (const serial of normalized) {
        const owner = serialOwners.get(serial);
        if (owner) issues.push({ row: rowNumber, sku, message: `Serial ${serial} is duplicated in rows ${owner} and ${rowNumber}.` });
        else serialOwners.set(serial, rowNumber);
      }
    } catch (error) {
      issues.push({ row: rowNumber, sku, message: error instanceof Error ? error.message : "Invalid serial number." });
    }
    products.push({ row: rowNumber, sku, categoryName, brandName, trackingType, serials, quantity, value: value.data });
  }
  return { products, issues };
}

async function resolveCategories(tx: Prisma.TransactionClient, names: string[]) {
  const uniqueNames = [...new Map(names.map((name) => [name.toLocaleLowerCase("en"), name.trim()])).values()];
  const existing = await tx.category.findMany({ where: { name: { in: uniqueNames, mode: "insensitive" } }, select: { id: true, name: true } });
  const byName = new Map(existing.map((category) => [category.name.toLocaleLowerCase("en"), category]));
  const missing = uniqueNames.filter((name) => !byName.has(name.toLocaleLowerCase("en"))).map((name) => {
    const slug = slugify(name);
    if (!slug) throw new DomainError("VALIDATION", `Category “${name}” needs a letter or number.`);
    return { name, slug, isActive: true };
  });
  if (missing.length) {
    const collisions = await tx.category.findMany({ where: { slug: { in: missing.map((category) => category.slug) } }, select: { name: true, slug: true } });
    const collisionSlugs = new Set(collisions.map((category) => category.slug));
    const collision = missing.find((category) => collisionSlugs.has(category.slug));
    if (collision) throw new DomainError("CONFLICT", `Category name “${collision.name}” conflicts with an existing category.`);
    const created = await tx.category.createManyAndReturn({ data: missing, select: { id: true, name: true } });
    for (const category of created) byName.set(category.name.toLocaleLowerCase("en"), category);
  }
  return byName;
}

async function resolveBrands(tx: Prisma.TransactionClient, names: string[]) {
  const uniqueNames = [...new Map(names.map((name) => [name.toLocaleLowerCase("en"), name.trim()])).values()];
  if (!uniqueNames.length) return new Map<string, { id: string; name: string }>();
  const existing = await tx.brand.findMany({ where: { name: { in: uniqueNames, mode: "insensitive" } }, select: { id: true, name: true } });
  const byName = new Map(existing.map((brand) => [brand.name.toLocaleLowerCase("en"), brand]));
  const missing = uniqueNames.filter((name) => !byName.has(name.toLocaleLowerCase("en"))).map((name) => {
    const slug = slugify(name);
    if (!slug) throw new DomainError("VALIDATION", `Brand “${name}” needs a letter or number.`);
    return { name, slug, isActive: true };
  });
  if (missing.length) {
    const collisions = await tx.brand.findMany({ where: { slug: { in: missing.map((brand) => brand.slug) } }, select: { name: true, slug: true } });
    const collisionSlugs = new Set(collisions.map((brand) => brand.slug));
    const collision = missing.find((brand) => collisionSlugs.has(brand.slug));
    if (collision) throw new DomainError("CONFLICT", `Brand name “${collision.name}” conflicts with an existing brand.`);
    const created = await tx.brand.createManyAndReturn({ data: missing, select: { id: true, name: true } });
    for (const brand of created) byName.set(brand.name.toLocaleLowerCase("en"), brand);
  }
  return byName;
}

export async function importProductsCsv(actor: Actor, csv: string) {
  return timeServerOperation("products.bulk-import", async () => {
  assertRolePermission(actor.role, PERMISSION.PRODUCT_CREATE);
  const parsed = parseRows(csv);
  if (parsed.issues.length) return { imported: 0, issues: parsed.issues };

  const result = await prisma.$transaction(async (tx) => {
    const skus = parsed.products.map((product) => product.sku);
    const barcodes = parsed.products.map((product) => product.value.barcode).filter((barcode): barcode is string => !!barcode);
    const [existingSkus, existingBarcodes] = await Promise.all([
      tx.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }),
      barcodes.length ? tx.product.findMany({ where: { barcode: { in: barcodes } }, select: { barcode: true } }) : [],
    ]);
    const issues: ImportIssue[] = [];
    const rowBySku = new Map(parsed.products.map((product) => [product.sku, product.row]));
    for (const product of existingSkus) issues.push({ row: rowBySku.get(product.sku) ?? 0, sku: product.sku, message: "SKU already exists. Existing products are not overwritten." });
    const rowByBarcode = new Map(parsed.products.filter((product) => product.value.barcode).map((product) => [product.value.barcode!, product.row]));
    for (const product of existingBarcodes) if (product.barcode) issues.push({ row: rowByBarcode.get(product.barcode) ?? 0, message: `Barcode ${product.barcode} already exists.` });
    if (issues.length) return { imported: 0, issues };

    const [categories, brands] = await Promise.all([
      resolveCategories(tx, parsed.products.map((product) => product.categoryName)),
      resolveBrands(tx, parsed.products.flatMap((product) => product.brandName ? [product.brandName] : [])),
    ]);
    for (const product of parsed.products) {
      const category = categories.get(product.categoryName.toLocaleLowerCase("en"));
      const brand = product.brandName ? brands.get(product.brandName.toLocaleLowerCase("en")) : null;
      if (!category) throw new DomainError("CONFLICT", `Could not resolve category “${product.categoryName}”.`);
      const value = product.value;
      const created = await tx.product.create({
        data: {
          sku: product.sku,
          barcode: value.barcode?.trim() || null,
          name: value.name.trim(),
          variantLabel: value.variantLabel?.trim() || null,
          description: value.description?.trim() || null,
          categoryId: category.id,
          brandId: brand?.id ?? null,
          purchasePrice: toDb(value.purchasePrice),
          sellingPrice: toDb(value.sellingPrice),
          discountPercent: money(value.discountPercent).toFixed(2),
          minStock: value.minStock,
          trackingType: value.trackingType,
          status: value.status,
        },
      });
      if (product.trackingType === "QUANTITY" && product.quantity > 0) {
        await addStockTx(tx, actor, { productId: created.id, type: "INITIAL_STOCK", quantity: product.quantity, reason: "Opening stock · CSV import" });
      } else if (product.trackingType !== "QUANTITY" && product.serials.length > 0) {
        await addStockTx(tx, actor, { productId: created.id, type: "INITIAL_STOCK", serials: product.serials, reason: "Opening stock · CSV import" });
      }
      await writeAudit(tx, {
        actorId: actor.id,
        action: PERMISSION.PRODUCT_CREATE,
        entityType: "Product",
        entityId: created.id,
        description: `Imported product ${created.name} (${created.sku}) from CSV`,
      });
    }
    return { imported: parsed.products.length, issues: [] as ImportIssue[] };
  }, { timeout: 30_000 });

  return result;
  });
}
