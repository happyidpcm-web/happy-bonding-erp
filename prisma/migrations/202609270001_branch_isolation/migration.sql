BEGIN;
ALTER TABLE "Branch" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Party" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Product" ADD COLUMN "branchId" TEXT;
ALTER TABLE "InvoiceSetting" ADD COLUMN "branchId" TEXT;

-- Keep the empty legacy PAV entry for history, but do not offer it as a store.
UPDATE "Branch" b SET active=false WHERE b.code='PAV'
 AND EXISTS (SELECT 1 FROM "Branch" p WHERE p."organizationId"=b."organizationId" AND p.code='PCM')
 AND NOT EXISTS (SELECT 1 FROM "SalesInvoice" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "StockBalance" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "StockMovement" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "Payment" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "Voucher" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "Expense" i WHERE i."branchId"=b.id)
 AND NOT EXISTS (SELECT 1 FROM "CreditNote" i WHERE i."branchId"=b.id);

CREATE TEMP TABLE default_branch AS
 SELECT DISTINCT ON ("organizationId") "organizationId", id FROM "Branch"
 WHERE active ORDER BY "organizationId", CASE code WHEN 'PCM' THEN 0 WHEN 'PAV' THEN 1 ELSE 2 END, id;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "Organization" o WHERE NOT EXISTS(SELECT 1 FROM default_branch d WHERE d."organizationId"=o.id)) THEN
  RAISE EXCEPTION 'Every organization requires an active branch before isolation';
 END IF;
END $$;

CREATE TEMP TABLE party_branch AS
 SELECT DISTINCT "partyId" AS original, "branchId" FROM "SalesInvoice" WHERE "partyId" IS NOT NULL
 UNION SELECT "partyId", "branchId" FROM "CreditNote"
 UNION SELECT p.id,v."branchId" FROM "Party" p JOIN "Voucher" v ON v."organizationId"=p."organizationId" AND v.party=p.name;
INSERT INTO party_branch SELECT p.id,d.id FROM "Party" p JOIN default_branch d USING("organizationId")
 WHERE NOT EXISTS(SELECT 1 FROM party_branch m WHERE m.original=p.id);
CREATE TEMP TABLE party_map AS
 SELECT original,"branchId",CASE WHEN row_number() OVER(PARTITION BY original ORDER BY CASE WHEN "branchId"=d.id THEN 0 ELSE 1 END,"branchId")=1
 THEN original ELSE 'bp_'||md5(original||':'||"branchId") END AS target
 FROM party_branch m JOIN "Party" p ON p.id=m.original JOIN default_branch d ON d."organizationId"=p."organizationId";
UPDATE "Party" p SET "branchId"=m."branchId" FROM party_map m WHERE m.original=m.target AND p.id=m.original;
INSERT INTO "Party" SELECT (json_populate_record(NULL::"Party",row_to_json(p)::jsonb || jsonb_build_object('id',m.target,'branchId',m."branchId",'openingBalance',0))).*
 FROM party_map m JOIN "Party" p ON p.id=m.original WHERE m.target<>m.original;
UPDATE "SalesInvoice" i SET "partyId"=m.target FROM party_map m WHERE i."partyId"=m.original AND i."branchId"=m."branchId";
UPDATE "CreditNote" i SET "partyId"=m.target FROM party_map m WHERE i."partyId"=m.original AND i."branchId"=m."branchId";

CREATE TEMP TABLE product_branch AS
 SELECT DISTINCT v."productId" AS original,b."branchId" FROM "ProductVariant" v JOIN "StockBalance" b ON b."variantId"=v.id
 UNION SELECT v."productId",b."branchId" FROM "ProductVariant" v JOIN "StockMovement" b ON b."variantId"=v.id
 UNION SELECT v."productId",i."branchId" FROM "ProductVariant" v JOIN "SalesInvoiceLine" l ON l."variantId"=v.id JOIN "SalesInvoice" i ON i.id=l."salesInvoiceId"
 UNION SELECT v."productId",i."branchId" FROM "ProductVariant" v JOIN "CreditNoteLine" l ON l."variantId"=v.id JOIN "CreditNote" i ON i.id=l."creditNoteId"
 UNION SELECT v."productId",q."branchId" FROM "Voucher" q CROSS JOIN LATERAL jsonb_array_elements(q.items::jsonb) item JOIN "ProductVariant" v ON v.id=item->>'variantId';
INSERT INTO product_branch SELECT p.id,d.id FROM "Product" p JOIN default_branch d USING("organizationId")
 WHERE NOT EXISTS(SELECT 1 FROM product_branch m WHERE m.original=p.id);
CREATE TEMP TABLE product_map AS
 SELECT original,"branchId",CASE WHEN row_number() OVER(PARTITION BY original ORDER BY CASE WHEN "branchId"=d.id THEN 0 ELSE 1 END,"branchId")=1
 THEN original ELSE 'bi_'||md5(original||':'||"branchId") END AS target
 FROM product_branch m JOIN "Product" p ON p.id=m.original JOIN default_branch d ON d."organizationId"=p."organizationId";
UPDATE "Product" p SET "branchId"=m."branchId" FROM product_map m WHERE m.original=m.target AND p.id=m.original;
INSERT INTO "Product" SELECT (json_populate_record(NULL::"Product",row_to_json(p)::jsonb || jsonb_build_object('id',m.target,'branchId',m."branchId"))).*
 FROM product_map m JOIN "Product" p ON p.id=m.original WHERE m.target<>m.original;
CREATE TEMP TABLE variant_map AS SELECT v.id AS original,m."branchId",m.target AS product,
 CASE WHEN m.original=m.target THEN v.id ELSE 'bv_'||md5(v.id||':'||m."branchId") END AS target
 FROM "ProductVariant" v JOIN product_map m ON m.original=v."productId";
INSERT INTO "ProductVariant" SELECT (json_populate_record(NULL::"ProductVariant",row_to_json(v)::jsonb || jsonb_build_object('id',m.target,'productId',m.product))).*
 FROM variant_map m JOIN "ProductVariant" v ON v.id=m.original WHERE m.original<>m.target;
UPDATE "StockBalance" b SET "variantId"=m.target FROM variant_map m WHERE b."variantId"=m.original AND b."branchId"=m."branchId";
UPDATE "StockMovement" b SET "variantId"=m.target FROM variant_map m WHERE b."variantId"=m.original AND b."branchId"=m."branchId";
UPDATE "SalesInvoiceLine" l SET "variantId"=m.target FROM variant_map m,"SalesInvoice" i WHERE l."variantId"=m.original AND i.id=l."salesInvoiceId" AND i."branchId"=m."branchId";
UPDATE "CreditNoteLine" l SET "variantId"=m.target FROM variant_map m,"CreditNote" i WHERE l."variantId"=m.original AND i.id=l."creditNoteId" AND i."branchId"=m."branchId";
UPDATE "Voucher" q SET items=(SELECT COALESCE(jsonb_agg(CASE WHEN m.target IS NULL THEN item ELSE item||jsonb_build_object('variantId',m.target) END ORDER BY n),'[]'::jsonb)
 FROM jsonb_array_elements(q.items::jsonb) WITH ORDINALITY a(item,n) LEFT JOIN variant_map m ON m.original=item->>'variantId' AND m."branchId"=q."branchId");

DROP INDEX "InvoiceSetting_organizationId_key";
UPDATE "InvoiceSetting" s SET "branchId"=d.id FROM default_branch d WHERE d."organizationId"=s."organizationId";
INSERT INTO "InvoiceSetting" SELECT (json_populate_record(NULL::"InvoiceSetting",row_to_json(s)::jsonb || jsonb_build_object('id','bs_'||md5(s.id||':'||b.id),'branchId',b.id))).*
 FROM "InvoiceSetting" s JOIN "Branch" b ON b."organizationId"=s."organizationId" AND b.id<>s."branchId" AND b.active;
ALTER TABLE "Party" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "InvoiceSetting" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "Party" ADD CONSTRAINT "Party_branchId_fkey" FOREIGN KEY("branchId") REFERENCES "Branch"(id);
ALTER TABLE "Product" ADD CONSTRAINT "Product_branchId_fkey" FOREIGN KEY("branchId") REFERENCES "Branch"(id);
ALTER TABLE "InvoiceSetting" ADD CONSTRAINT "InvoiceSetting_branchId_fkey" FOREIGN KEY("branchId") REFERENCES "Branch"(id);
CREATE UNIQUE INDEX "InvoiceSetting_organizationId_branchId_key" ON "InvoiceSetting"("organizationId","branchId");
DROP INDEX "SalesInvoice_organizationId_invoiceNumber_key";
DROP INDEX "SalesInvoice_organizationId_idempotencyKey_key";
CREATE UNIQUE INDEX "SalesInvoice_organizationId_branchId_invoiceNumber_key" ON "SalesInvoice"("organizationId","branchId","invoiceNumber");
CREATE UNIQUE INDEX "SalesInvoice_organizationId_branchId_idempotencyKey_key" ON "SalesInvoice"("organizationId","branchId","idempotencyKey");
DROP INDEX "CreditNote_organizationId_creditNoteNumber_key";
CREATE UNIQUE INDEX "CreditNote_organizationId_branchId_creditNoteNumber_key" ON "CreditNote"("organizationId","branchId","creditNoteNumber");
CREATE INDEX "Party_branchId_idx" ON "Party"("branchId");
CREATE INDEX "Product_branchId_idx" ON "Product"("branchId");
-- Existing tokens must be replaced after access changes.
UPDATE "User" SET "tokenVersion"="tokenVersion"+1;
COMMIT;
