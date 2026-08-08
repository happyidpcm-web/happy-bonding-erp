import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await hash("HappyBonding@2026", 12);
  const organization = await db.organization.upsert({
    where: { id: "happy-bonding" },
    update: {},
    create: { id: "happy-bonding", name: "Happy Bonding Men's Wear", phone: "7708030903", gstin: "33CWZPS9715D1ZU", pan: "CWZPS9715D", stateCode: "33" },
  });
  const branch = await db.branch.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: "PAV" } }, update: {},
    create: { organizationId: organization.id, code: "PAV", name: "Pavoorchatram", address: "No. 10/901, West Bus Stand, Near Railway Gate, Pavoorchatram - 627808" },
  });
  const role = await db.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "Owner" } },
    update: { permissions: ["*"] }, create: { organizationId: organization.id, name: "Owner", permissions: ["*"] },
  });
  const user = await db.user.upsert({
    where: { email: "admin@happybonding.in" }, update: { passwordHash, roleId: role.id },
    create: { organizationId: organization.id, roleId: role.id, name: "Saravana", email: "admin@happybonding.in", phone: "7708030903", passwordHash },
  });
  await db.userBranch.upsert({ where: { userId_branchId: { userId: user.id, branchId: branch.id } }, update: {}, create: { userId: user.id, branchId: branch.id } });
  const tax = await db.taxRate.upsert({ where: { organizationId_rate: { organizationId: organization.id, rate: 5 } }, update: {}, create: { organizationId: organization.id, name: "GST 5%", rate: 5 } });
  const productCount = await db.product.count({ where: { organizationId: organization.id } });
  if (!productCount) {
    const samples = [
      ["Classic Oxford Shirt", "Shirts", "6105", "HB-SH-OXF-BLU-40", "40", "Blue", 420, 799, 999, 18],
      ["Slim Fit Chino", "Trousers", "6203", "HB-TR-CHI-BLK-32", "32", "Black", 610, 1199, 1499, 7],
      ["Premium Polo T-Shirt", "T-Shirts", "6109", "HB-TS-POLO-MRN-L", "L", "Maroon", 330, 699, 899, 24],
    ] as const;
    for (const s of samples) {
      const product = await db.product.create({ data: { organizationId: organization.id, name: s[0], category: s[1], hsnCode: s[2], taxRateId: tax.id, variants: { create: { sku: s[3], barcode: s[3], size: s[4], color: s[5], purchasePrice: s[6], sellingPrice: s[7], mrp: s[8] } } }, include: { variants: true } });
      await db.stockBalance.create({ data: { branchId: branch.id, variantId: product.variants[0].id, quantity: s[9] } });
      await db.stockMovement.create({ data: { branchId: branch.id, variantId: product.variants[0].id, type: "OPENING", quantity: s[9], unitCost: s[6], referenceType: "Seed", referenceId: product.id } });
    }
  }
  console.log(`Seeded ${organization.name}. Branch ID: ${branch.id}`);
  console.log("Login: admin@happybonding.in / HappyBonding@2026 (change immediately)");
}

main().finally(() => db.$disconnect());
