import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const admin = new PrismaClient();
const name = 'hb_verify_' + Date.now();
await admin.$executeRawUnsafe('CREATE DATABASE "' + name + '"');
await admin.$disconnect();
const url = new URL(process.env.DATABASE_URL); url.pathname = '/' + name;
const env = {...process.env, DATABASE_URL:url.toString(), API_PORT:'4001', PORT:'4001',AUTO_SETUP_DATABASE:'false'};
execFileSync(process.execPath,['node_modules/prisma/build/index.js','db','push','--skip-generate'],{env,stdio:'pipe'});
execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','prisma/seed.ts'],{env,stdio:'pipe'});
const db = new PrismaClient({datasources:{db:{url:url.toString()}}});
const child=spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','server/index.ts'],{env,stdio:'inherit'});
const base='http://127.0.0.1:4001/api';
let token,branch;
async function request(path,body,method=body?'POST':'GET') {
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token,'x-branch-id':branch}:{})},body:body?JSON.stringify(body):undefined});
 const b=await r.json();assert.ok(r.ok, path+': '+JSON.stringify(b));return b;
}
try {
 for(let i=0;i<120;i++){try{await fetch(base+'/health');break;}catch{await new Promise(r=>setTimeout(r,250));}}
 const login=await request('/auth/login',{email:'admin@happybonding.in',password:'HappyBonding@2026'});token=login.token;branch=login.branchIds[0];
 await request('/auth/login',{email:'pcm@happybonding.in',password:'Pcm@123'});
 const products=await request('/products');const p=products[0];
 const before=Number((await db.stockBalance.findUnique({where:{branchId_variantId:{branchId:branch,variantId:p.id}}})).quantity);
 const bill=await request('/sales',{idempotencyKey:'verification-sale-1',invoiceDate:new Date().toISOString(),placeOfSupply:'33',paidAmount:25,lines:[{variantId:p.id,quantity:1,unitPrice:100,taxRate:0}]});
 assert.equal(Number(bill.grandTotal),100);
 await request('/payments/in',{amount:75,mode:'Cash',paymentNumber:'VERIFY-1',allocations:[{salesInvoiceId:bill.id,amount:75}]});
 const saved=await request('/sales/'+bill.id);assert.equal(Number(saved.paidAmount),100);assert.equal(saved.paymentStatus,'PAID');assert.equal(saved.payments.length,2);
 const edited = await request('/sales/'+bill.id,{idempotencyKey:'verification-edit',invoiceDate:'2026-09-25',placeOfSupply:'33',paidAmount:100,lines:[{variantId:p.id,quantity:1,unitPrice:450,mrp:700,taxRate:0}]},'PUT');
 const reopened=await request('/sales/'+bill.id);assert.equal(Number(reopened.lines[0].unitPrice),450);assert.equal(Number(reopened.lines[0].mrp),700);assert.equal(reopened.invoiceNumber,bill.invoiceNumber);assert.equal(reopened.invoiceDate.slice(0,10),'2026-09-25');assert.equal(Number(edited.find(i=>i.id===bill.id).grandTotal),450);console.log('PASS invoice edit snapshot: price, MRP, total, number, date');
 const purchase={id:crypto.randomUUID(),type:'Purchase Invoice',number:'VERIFY-PUR-1',date:new Date().toISOString(),party:'Verification supplier',amount:50,items:[{variantId:p.id,name:p.product.name,hsn:'6205',qty:1,price:50,amount:50}]};
 await request('/vouchers',purchase);await request('/vouchers',purchase);
 assert.equal((await request('/vouchers?type=Purchase%20Invoice')).length,1);
 assert.equal(Number((await db.stockBalance.findUnique({where:{branchId_variantId:{branchId:branch,variantId:p.id}}})).quantity),before);
 await request('/vouchers/'+purchase.id,undefined,'DELETE');
 assert.equal(Number((await db.stockBalance.findUnique({where:{branchId_variantId:{branchId:branch,variantId:p.id}}})).quantity),before-1);
 console.log(JSON.stringify({staffLogin:'PASS',saleSave:'PASS',paymentAllocation:'PASS',purchasePersistence:'PASS',purchaseRetryNoDuplicateStock:'PASS',purchaseReversal:'PASS',isolatedDatabase:name}));
}finally{ child.kill();await db.$disconnect(); }
