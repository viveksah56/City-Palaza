/**
 * Development seed. Production seeding is disabled.
 */
import { config } from "dotenv";

config({ path: process.env.SEED_ENV_FILE ?? (process.env.NODE_ENV === "production" ? ".env.prod" : ".env") });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed in production.");
  process.exit(1);
}

async function bootstrap() {
  const [prismaModule, passwordModule, rbacModule, rolesModule, imeiModule, formatModule, settingsModule, inventoryModule, salesModule] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/auth/password"),
    import("@/lib/rbac/permission"),
    import("@/lib/constants/roles"),
    import("@/lib/imei"),
    import("@/lib/format"),
    import("@/server/settings.service"),
    import("@/server/inventory.service"),
    import("@/server/sales.service"),
  ]);
  const { createPrismaClient } = prismaModule;
  const { hashPassword } = passwordModule;
  const { PERMISSIONS, ROLE_PERMISSIONS } = rbacModule;
  const { ROLE, ROLE_LABELS, ROLE_VALUES } = rolesModule;
  const { imeiFromBody } = imeiModule;
  const { slugify } = formatModule;
  const { DEFAULT_SETTINGS } = settingsModule;
  const { addStock } = inventoryModule;
  const { createSale, voidSale } = salesModule;
  const prisma = createPrismaClient();

  let rng = 42;
  const rand = () => ((rng = (rng * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;

  const CATEGORIES = ["Smartphones", "Feature Phones", "Chargers", "Cables", "Earphones", "Headphones", "Power Banks", "Smart Watches", "Cases", "Screen Protectors", "Memory Cards", "Speakers", "Other"];
  const BRANDS = ["Apple", "Samsung", "Xiaomi", "OnePlus", "Realme", "Oppo", "Vivo", "Huawei", "Anker", "JBL", "Sony"];

  // sku, name, category, brand, cost, price, tracking, opening qty
  type P = [string, string, string, string | null, number, number, "QUANTITY" | "IMEI", number];
  const PRODUCTS: P[] = [
    ["IP15-128-BLK", "iPhone 15 128GB Black", "Smartphones", "Apple", 98000, 112000, "IMEI", 6],
    ["IP15P-256-NAT", "iPhone 15 Pro 256GB Natural", "Smartphones", "Apple", 142000, 159000, "IMEI", 4],
    ["SGS24-256-GRY", "Samsung Galaxy S24 256GB", "Smartphones", "Samsung", 96000, 109000, "IMEI", 5],
    ["SGA55-256-NVY", "Samsung Galaxy A55 8/256GB", "Smartphones", "Samsung", 54000, 62500, "IMEI", 8],
    ["SGA15-128-BLU", "Samsung Galaxy A15 4/128GB", "Smartphones", "Samsung", 21500, 25500, "IMEI", 10],
    ["XRN13-128-BLK", "Xiaomi Redmi Note 13 6/128GB", "Smartphones", "Xiaomi", 24500, 29000, "IMEI", 12],
    ["XRN13P-256-PRP", "Xiaomi Redmi Note 13 Pro 8/256GB", "Smartphones", "Xiaomi", 37500, 43500, "IMEI", 7],
    ["OP12R-256-BLU", "OnePlus 12R 8/256GB", "Smartphones", "OnePlus", 56000, 65000, "IMEI", 3],
    ["RM12P-256-GRN", "Realme 12 Pro 8/256GB", "Smartphones", "Realme", 38000, 44500, "IMEI", 6],
    ["OPPA3-128-BLK", "Oppo A3 6/128GB", "Smartphones", "Oppo", 19500, 23500, "IMEI", 9],
    ["VV30-256-GRN", "Vivo V30 12/256GB", "Smartphones", "Vivo", 49000, 57000, "IMEI", 4],
    ["NK105", "Nokia 105 Feature Phone", "Feature Phones", null, 2800, 3500, "QUANTITY", 25],
    ["SG-CH25W", "Samsung 25W Fast Charger", "Chargers", "Samsung", 1100, 1800, "QUANTITY", 40],
    ["AP-CH20W", "Apple 20W USB-C Charger", "Chargers", "Apple", 2400, 3500, "QUANTITY", 18],
    ["AN-CH30", "Anker 30W Nano Charger", "Chargers", "Anker", 1700, 2600, "QUANTITY", 22],
    ["AN-CBL-C2C", "Anker USB-C to USB-C Cable 1m", "Cables", "Anker", 650, 1200, "QUANTITY", 60],
    ["AP-CBL-LTN", "Apple Lightning Cable 1m", "Cables", "Apple", 1400, 2200, "QUANTITY", 5],
    ["SN-WH1000", "Sony WH-1000XM5 Headphones", "Headphones", "Sony", 38000, 46000, "QUANTITY", 4],
    ["JBL-T110", "JBL Tune 110 Wired Earphones", "Earphones", "JBL", 750, 1400, "QUANTITY", 30],
    ["XM-BUDS4", "Xiaomi Redmi Buds 4 Active", "Earphones", "Xiaomi", 1700, 2600, "QUANTITY", 20],
    ["AN-PB20K", "Anker 20,000mAh Power Bank", "Power Banks", "Anker", 4200, 6200, "QUANTITY", 12],
    ["XM-PB10K", "Xiaomi 10,000mAh Power Bank", "Power Banks", "Xiaomi", 2000, 3200, "QUANTITY", 3],
    ["XM-BAND8", "Xiaomi Smart Band 8", "Smart Watches", "Xiaomi", 4300, 6000, "QUANTITY", 10],
    ["SG-WATCH6", "Samsung Galaxy Watch6 44mm", "Smart Watches", "Samsung", 31000, 37500, "QUANTITY", 0],
    ["CS-IP15-CLR", "iPhone 15 Clear Case", "Cases", null, 450, 1100, "QUANTITY", 35],
    ["CS-SGA55-BLK", "Galaxy A55 Silicone Case", "Cases", null, 350, 900, "QUANTITY", 28],
    ["SP-UNIV-TG", "Tempered Glass Universal 6.5\"", "Screen Protectors", null, 120, 450, "QUANTITY", 90],
    ["SD-EVO-128", "Samsung EVO Plus 128GB microSD", "Memory Cards", "Samsung", 1500, 2300, "QUANTITY", 16],
    ["JBL-GO3", "JBL Go 3 Bluetooth Speaker", "Speakers", "JBL", 3800, 5200, "QUANTITY", 9],
    ["JBL-FLIP6", "JBL Flip 6 Bluetooth Speaker", "Speakers", "JBL", 10500, 13500, "QUANTITY", 6],
  ];

  const PAYMENTS = ["CASH", "CASH", "CASH", "ESEWA", "ESEWA", "KHALTI", "CARD", "BANK_TRANSFER"] as const;

  async function main() {
    // --- RBAC mirror tables ---
    for (const key of PERMISSIONS) await prisma.permission.upsert({ where: { key }, create: { key }, update: {} });
    for (const role of ROLE_VALUES) {
      await prisma.role.upsert({ where: { key: role }, create: { key: role, name: ROLE_LABELS[role] }, update: { name: ROLE_LABELS[role] } });
      await prisma.rolePermission.deleteMany({ where: { roleKey: role } });
      await prisma.rolePermission.createMany({ data: [...ROLE_PERMISSIONS[role]].map((permissionKey) => ({ roleKey: role, permissionKey })) });
    }

    // --- settings ---
    const settings = { ...DEFAULT_SETTINGS, taxRate: 13 };
    for (const [key, value] of Object.entries(settings)) {
      if (value === null) {
        await prisma.setting.deleteMany({ where: { key } });
        continue;
      }
      await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
    }

    // --- users ---
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@cityplaza.local";
    const adminPw = process.env.SEED_ADMIN_PASSWORD;
    const empPw = process.env.SEED_EMPLOYEE_PASSWORD;
    if (!adminPw || !empPw) throw new Error("Set SEED_ADMIN_PASSWORD and SEED_EMPLOYEE_PASSWORD in the local environment before seeding.");
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      create: { slug: "shop-admin", firstName: "Shop", lastName: "Admin", email: adminEmail, passwordHash: await hashPassword(adminPw), role: ROLE.ADMIN },
      update: { passwordHash: await hashPassword(adminPw) },
    });
    const staff = [];
    for (const [first, last] of [["Sita", "Sharma"], ["Ram", "Thapa"], ["Anita", "Gurung"]] as const) {
      staff.push(await prisma.user.upsert({
        where: { email: `${first.toLowerCase()}@cityplaza.local` },
        create: { slug: `${first.toLowerCase()}-${last.toLowerCase()}`, firstName: first, lastName: last, email: `${first.toLowerCase()}@cityplaza.local`, passwordHash: await hashPassword(empPw), role: ROLE.EMPLOYEE },
        update: { passwordHash: await hashPassword(empPw) },
      }));
    }

    // --- catalogue ---
    const catId: Record<string, string> = {};
    for (const name of CATEGORIES) catId[name] = (await prisma.category.upsert({ where: { name }, create: { name, slug: slugify(name) }, update: {} })).id;
    const brandId: Record<string, string> = {};
    for (const name of BRANDS) brandId[name] = (await prisma.brand.upsert({ where: { name }, create: { name, slug: slugify(name) }, update: {} })).id;

    if ((await prisma.product.count()) > 0) {
      console.log("Products already exist – skipping catalogue, stock and sales seed.");
    } else {
      let imeiSeq = 1;
      for (const [sku, name, cat, brand, cost, price, tracking, qty] of PRODUCTS) {
        const p = await prisma.product.create({
          data: { slug: `${slugify(name)}-${slugify(sku)}`, sku, name, categoryId: catId[cat]!, brandId: brand ? brandId[brand] : null, purchasePrice: cost, sellingPrice: price, trackingType: tracking, description: `${name} – CityPlaza demo item` },
        });
        if (qty > 0) {
          const serials = tracking === "IMEI" ? Array.from({ length: qty }, () => imeiFromBody(`35${String(imeiSeq++).padStart(12, "0")}`)) : undefined;
          await addStock({ id: admin.id, role: ROLE.ADMIN }, { productId: p.id, type: "INITIAL_STOCK", quantity: qty * 4, serials, reason: "Opening stock (seed)" });
          // QUANTITY items get 4× so demo sales don't empty them; IMEI items got exactly `qty` devices
        }
      }

      // --- customers ---
      const customers = [];
      for (const [name, phone] of [["Bikash Rai", "9841000001"], ["Mina Tamang", "9841000002"], ["Suresh KC", "9841000003"], ["Pooja Shrestha", "9841000004"], ["Dipesh Adhikari", "9841000005"], ["Nisha Karki", "9841000006"]] as const) {
        customers.push(await prisma.customer.create({ data: { slug: `${slugify(name)}-${phone}`, name, phone } }));
      }

      // --- historical sales (created through the real service, then backdated) ---
      const products = await prisma.product.findMany({ where: { quantity: { gt: 0 } } });
      const created: string[] = [];
      for (let day = 29; day >= 0; day--) {
        const perDay = 1 + Math.floor(rand() * 4);
        for (let n = 0; n < perDay; n++) {
          const actor = rand() < 0.15 ? { id: admin.id, role: ROLE.ADMIN } : { id: pick(staff).id, role: ROLE.EMPLOYEE };
          const items: { productId: string; quantity: number; serials?: string[] }[] = [];
          for (const p of Array.from({ length: 1 + Math.floor(rand() * 2) }, () => pick(products))) {
            if (items.some((i) => i.productId === p.id)) continue;
            if (p.trackingType === "IMEI") {
              const d = await prisma.productSerial.findFirst({ where: { productId: p.id, status: "IN_STOCK" } });
              if (d) items.push({ productId: p.id, quantity: 1, serials: [d.serial] });
            } else items.push({ productId: p.id, quantity: 1 + Math.floor(rand() * 2) });
          }
          if (!items.length) continue;
          try {
            const sale = await createSale(actor, {
              items, customerId: rand() < 0.4 ? pick(customers).id : null, paymentMethod: pick([...PAYMENTS]), paymentStatus: "PAID",
              discount: rand() < 0.2 ? { type: "PERCENT", value: pick([2, 3, 5]) } : null,
            });
            const when = new Date(Date.now() - day * 86_400_000 - Math.floor(rand() * 8) * 3_600_000);
            await prisma.sale.update({ where: { id: sale.id }, data: { createdAt: when } });
            await prisma.inventoryTransaction.updateMany({ where: { referenceId: sale.id }, data: { createdAt: when } });
            created.push(sale.id);
          } catch { /* ran out of stock for that product – skip */ }
        }
      }
      // a couple of voided sales for the demo
      for (const id of created.slice(3, 5)) await voidSale({ id: admin.id, role: ROLE.ADMIN }, { saleId: id, reason: "Customer changed their mind (seed)" });
      console.log(`Seeded ${PRODUCTS.length} products, ${customers.length} customers, ${created.length} sales.`);
    }

    console.log("\n✔ Seed complete.");
  }

  await main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
}

void bootstrap();
