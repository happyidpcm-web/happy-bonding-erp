import { db } from "./server/db.js";

async function run() {
  try {
    const org = await db.organization.findFirst();
    const branch = await db.branch.findFirst();
    const party = await db.party.findFirst();
    const variant = await db.productVariant.findFirst();

    if (!org || !branch || !party || !variant) {
      console.log("Missing test data");
      process.exit(1);
    }

    const calculated = [
      {
        v: { id: variant.id, product: { name: "Test" }, sku: "TEST", purchasePrice: variant.purchasePrice },
        input: { quantity: 1, unitPrice: 100, discount: 0 },
        taxable: 100,
        rate: 5,
        cgst: 2.5,
        sgst: 2.5,
        igst: 0,
        total: 105
      }
    ];

    const invoice = await db.salesInvoice.create({
      data: {
        organizationId: org.id,
        branchId: branch.id,
        partyId: party.id,
        invoiceNumber: "TEST-" + Date.now(),
        invoiceDate: new Date(),
        status: "POSTED",
        paymentStatus: "UNPAID",
        placeOfSupply: "TN",
        subtotal: 100,
        discountTotal: 0,
        invoiceDiscount: 0,
        additionalCharges: 0,
        taxableTotal: 100,
        cgstTotal: 2.5,
        sgstTotal: 2.5,
        igstTotal: 0,
        grandTotal: 105,
        paidAmount: 0,
        notes: "",
        idempotencyKey: "test-" + Date.now(),
        postedAt: new Date(),
        lines: {
          create: calculated.map(x => ({
            variantId: x.v.id,
            itemName: x.v.product.name,
            sku: x.v.sku,
            hsnCode: "",
            quantity: x.input.quantity,
            unitPrice: x.input.unitPrice,
            purchasePriceAtSale: x.v.purchasePrice,
            totalCostAtSale: Number(x.v.purchasePrice) * x.input.quantity,
            discount: x.input.discount,
            taxableAmount: x.taxable,
            taxRate: x.rate,
            cgst: x.cgst,
            sgst: x.sgst,
            igst: x.igst,
            total: x.total
          }))
        }
      }
    });
    console.log("SUCCESS:", invoice.id);
  } catch (e) {
    console.error("ERROR:", e);
  } finally {
    await db.$disconnect();
  }
}
run();
