import { Router } from 'express';
import { z } from 'zod';
import { db } from './db.js';
import { requireBranch } from './auth.js';
import { reportBounds, reportQuery, matchesReportTime, storeCalendarDate } from './report-data.js';

type Row = Record<string, string | number>;
const kinds = z.enum(['purchase-summary', 'expense-transactions', 'expense-category', 'cash-bank', 'stock-detail', 'item-party', 'party-item', 'category-sales', 'hsn-sales', 'gst-sales', 'gst-purchases', 'party-outstanding', 'party-ledger', 'audit-trail', 'sales-staff', 'daybook-staff', 'sales-returns', 'bill-profit', 'sales-summary', 'receivable-ageing']);
export const reportTablesRouter = Router();
reportTablesRouter.get('/:kind', async (req, res) => {
  const branchId = requireBranch(req, res); if (!branchId) return;
  const kind = kinds.parse(req.params.kind);
  const q = reportQuery.parse(req.query), bounds = reportBounds(q);
  // Balance reports use today as their snapshot date when all history is selected.
  const asOf = reportBounds(q.filter === 'All' ? { filter: 'Today' } : q);
  const scope = { organizationId: req.session!.organizationId, branchId };
  let rows: Row[] = [], columns: string[] = [], moneyColumns: string[] = [], note = '';
  const num = (value: unknown) => Number(value || 0);
  const date = (value: Date) => value.toISOString().slice(0, 10);
  const group = (source: Row[], keys: string[], sums: string[]) => {
    const grouped = new Map<string, Row>();
    for (const row of source) {
      const key = JSON.stringify(keys.map(k => row[k]));
      const target = grouped.get(key) || Object.fromEntries([...keys.map(k => [k, row[k]]), ...sums.map(k => [k, 0])]);
      for (const k of sums) target[k] = num(target[k]) + num(row[k]);
      grouped.set(key, target);
    }
    return [...grouped.values()];
  };
  if (kind === 'purchase-summary' || kind === 'gst-purchases') {
    const records = await db.voucher.findMany({ where: { ...scope, type: 'Purchase Invoice', date: bounds.where }, orderBy: { date: 'desc' } });
    const selected = records.filter(r => matchesReportTime(r.date, r.createdAt, q));
    if (kind === 'purchase-summary') {
      columns = ['Date', 'Invoice', 'Supplier', 'Amount', 'Paid', 'Balance']; moneyColumns = ['Amount', 'Paid', 'Balance'];
      rows = selected.map(r => { const details = r.details as { paidAmount?: number }; return { Date: date(r.date), Invoice: r.number, Supplier: r.party, Amount: num(r.amount), Paid: num(details.paidAmount), Balance: num(r.amount) - num(details.paidAmount) }; });
    } else {
      columns = ['Date', 'Invoice', 'Supplier', 'Item', 'HSN', 'Quantity', 'Tax Rate', 'Taxable', 'Tax', 'Amount']; moneyColumns = ['Taxable', 'Tax', 'Amount'];
      rows = selected.flatMap(r => (r.items as Array<{ name: string; hsn: string; qty: number; price: number; discount?: number; tax?: number; amount: number }>).map(l => {
        const taxable = Math.max(0, l.qty * l.price - num(l.discount));
        return { Date: date(r.date), Invoice: r.number, Supplier: r.party, Item: l.name, HSN: l.hsn, Quantity: l.qty, 'Tax Rate': num(l.tax), Taxable: taxable, Tax: l.amount - taxable, Amount: l.amount };
      }));
      note = 'Purchase line tax breakdown. Bill-level discounts and charges are excluded. This is not a GST filing or input-tax-credit eligibility calculation.';
    }
  } else if (kind.startsWith('expense-')) {
    const records = await db.expense.findMany({ where: { ...scope, expenseDate: bounds.where }, orderBy: { expenseDate: 'desc' } });
    rows = records.filter(r => matchesReportTime(r.expenseDate, r.createdAt, q)).map(r => ({ Date: date(r.expenseDate), Category: r.category, 'Paid To': r.paidTo || '', Mode: r.paymentMode, Notes: r.notes || '', Amount: num(r.amount) }));
    columns = ['Date', 'Category', 'Paid To', 'Mode', 'Notes', 'Amount']; moneyColumns = ['Amount'];
    if (kind === 'expense-category') { rows = group(rows, ['Category'], ['Amount']); columns = ['Category', 'Amount']; }
  } else if (kind === 'cash-bank') {
    const records = await db.payment.findMany({ where: { ...scope, paidAt: bounds.timestampWhere }, orderBy: { paidAt: 'desc' } });
    columns = ['Date', 'Mode', 'Reference', 'Received', 'Paid']; moneyColumns = ['Received', 'Paid'];
    rows = records.filter(r => matchesReportTime(storeCalendarDate(r.paidAt), r.paidAt, q)).map(r => ({ Date: date(storeCalendarDate(r.paidAt)), Mode: r.mode, Reference: r.reference?.startsWith('{') ? 'Payment receipt' : r.reference || '', Received: r.direction === 'IN' ? num(r.amount) : 0, Paid: r.direction === 'OUT' ? num(r.amount) : 0 }));
    note = 'Recorded payment transactions. Expenses are shown in the expense reports; this is not an account balance reconciliation.';
  } else if (kind === 'stock-detail') {
    const records = await db.stockMovement.findMany({ where: { branchId, branch: { organizationId: scope.organizationId }, occurredAt: bounds.timestampWhere }, include: { variant: { include: { product: true } } }, orderBy: { occurredAt: 'desc' } });
    const sales = await db.salesInvoice.findMany({ where: { ...scope, id: { in: records.filter(r => r.referenceType === 'SalesInvoice').map(r => r.referenceId) } }, select: { id: true, invoiceNumber: true } });
    const billNumbers = new Map(sales.map(i => [i.id, i.invoiceNumber]));
    columns = ['Date', 'Item', 'Item Code', 'Size', 'Movement', 'Stock In', 'Stock Out', 'Unit Cost', 'Reference']; moneyColumns = ['Unit Cost'];
    rows = records.filter(r => matchesReportTime(storeCalendarDate(r.occurredAt), r.occurredAt, q)).map(r => ({ Date: date(storeCalendarDate(r.occurredAt)), Item: r.variant.product.name, 'Item Code': r.variant.sku, Size: r.variant.size || '', Movement: r.type.replaceAll('_', ' '), 'Stock In': Math.max(0, num(r.quantity)), 'Stock Out': Math.max(0, -num(r.quantity)), 'Unit Cost': r.unitCost == null ? 'Not recorded' : num(r.unitCost), Reference: r.referenceType === 'SalesInvoice' ? billNumbers.get(r.referenceId) || r.referenceId : r.referenceId }));
    note = 'Stock In adds pieces; Stock Out removes pieces. These are movements in the selected period, not the current stock balance.';
  } else if (kind === 'sales-returns') {
    const records = await db.creditNote.findMany({ where: { ...scope, date: bounds.where }, include: { party: true, salesInvoice: true }, orderBy: { date: 'desc' } });
    columns = ['Date', 'Credit Note', 'Invoice', 'Party', 'Amount']; moneyColumns = ['Amount'];
    rows = records.filter(r => matchesReportTime(r.date, r.createdAt, q)).map(r => ({ Date: date(r.date), 'Credit Note': r.creditNoteNumber, Invoice: r.salesInvoice.invoiceNumber, Party: r.party.name, Amount: num(r.amount) }));
    note = 'Posted credit notes linked to sales invoices.';
  } else if (kind === 'party-outstanding' || kind === 'party-ledger' || kind === 'receivable-ageing') {
    const [parties, invoices, credits] = await db.$transaction([
      db.party.findMany({ where: scope }),
      db.salesInvoice.findMany({ where: { ...scope, status: 'POSTED', invoiceDate: { lt: kind === 'party-ledger' ? bounds.where.lt : asOf.where.lt } }, include: { payments: { include: { payment: true } } } }),
      db.creditNote.findMany({ where: { ...scope, date: { lt: kind === 'party-ledger' ? bounds.where.lt : asOf.where.lt } } }),
    ], { isolationLevel: 'RepeatableRead' });
    if (kind === 'receivable-ageing') {
      columns = ['Party', 'Invoice', 'Invoice Date', 'Due Date', 'Not Due', '1?30 Days', '31?60 Days', '61?90 Days', 'Over 90 Days']; moneyColumns = columns.slice(4);
      rows = invoices.filter(i => i.partyId && parties.some(p => p.id === i.partyId && p.name.trim())).map(i => {
        const party = parties.find(p => p.id === i.partyId);
        const due = new Date(i.invoiceDate); due.setUTCDate(due.getUTCDate() + (party?.creditPeriodDays ?? 30));
        const paid = i.payments.filter(a => a.payment.paidAt < asOf.timestampWhere.lt!).reduce((s, a) => s + num(a.amount), 0);
        const credited = credits.filter(c => c.salesInvoiceId === i.id).reduce((s, c) => s + num(c.amount), 0);
        const balance = Math.max(0, num(i.grandTotal) - paid - credited);
        const days = Math.floor((asOf.where.lt!.getTime() - 86400000 - due.getTime()) / 86400000);
        const bucket = days <= 0 ? 'Not Due' : days <= 30 ? '1?30 Days' : days <= 60 ? '31?60 Days' : days <= 90 ? '61?90 Days' : 'Over 90 Days';
        return { Party: party?.name || '', Invoice: i.invoiceNumber, 'Invoice Date': date(i.invoiceDate), 'Due Date': date(due), ...Object.fromEntries(moneyColumns.map(k => [k, k === bucket ? balance : 0])) };
      }).filter(r => moneyColumns.some(k => num((r as Row)[k]) > 0));
      note = 'Open customer invoices as of the end date, using the current party credit period. Invoices without an available customer are excluded. Opening balances are excluded because their due dates are not recorded.';
    } else if (kind === 'party-outstanding') {
      columns = ['Party', 'Opening Balance', 'Invoiced', 'Collected', 'Credit Notes', 'Outstanding']; moneyColumns = columns.slice(1);
      rows = parties.map(p => {
        const bills = invoices.filter(i => i.partyId === p.id);
        const invoiced = bills.reduce((s, i) => s + num(i.grandTotal), 0);
        const collected = bills.reduce((s, i) => s + i.payments.filter(a => a.payment.paidAt < asOf.timestampWhere.lt!).reduce((n, a) => n + num(a.amount), 0), 0);
        const credit = credits.filter(c => c.partyId === p.id).reduce((s, c) => s + num(c.amount), 0);
        const opening = num(p.openingBalance) * (p.openingBalanceType === 'TO_PAY' ? -1 : 1);
        return { Party: p.name, 'Opening Balance': opening, Invoiced: invoiced, Collected: collected, 'Credit Notes': credit, Outstanding: opening + invoiced - collected - credit };
      });
      note = `Customer receivables as of ${bounds.to}, including recorded opening balances. Start date does not apply to balances. Supplier purchases and unallocated receipts are not included.`;
    } else {
      columns = ['Date', 'Party', 'Reference', 'Type', 'Debit', 'Credit']; moneyColumns = ['Debit', 'Credit'];
      const names = new Map(parties.map(p => [p.id, p.name]));
      rows = invoices.filter(i => (!bounds.where.gte || i.invoiceDate >= bounds.where.gte) && matchesReportTime(i.invoiceDate, i.createdAt, q)).map(i => ({ Date: date(i.invoiceDate), Party: names.get(i.partyId || '') || 'Cash Sale', Reference: i.invoiceNumber, Type: 'Sales Invoice', Debit: num(i.grandTotal), Credit: 0 }));
      rows.push(...invoices.flatMap(i => i.payments.filter(a => (!bounds.timestampWhere.gte || a.payment.paidAt >= bounds.timestampWhere.gte) && (!bounds.timestampWhere.lt || a.payment.paidAt < bounds.timestampWhere.lt) && matchesReportTime(storeCalendarDate(a.payment.paidAt), a.payment.paidAt, q)).map(a => ({ Date: date(storeCalendarDate(a.payment.paidAt)), Party: names.get(i.partyId || '') || 'Cash Sale', Reference: i.invoiceNumber, Type: 'Payment Allocation', Debit: 0, Credit: num(a.amount) }))));
      rows.push(...credits.filter(c => (!bounds.where.gte || c.date >= bounds.where.gte) && matchesReportTime(c.date, c.createdAt, q)).map(c => ({ Date: date(c.date), Party: names.get(c.partyId) || '', Reference: c.creditNoteNumber, Type: 'Credit Note', Debit: 0, Credit: num(c.amount) })));
      rows.sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
      note = 'Customer sales, allocated receipts and credit notes within this period. This transaction statement excludes opening balances and supplier transactions.';
    }
  } else if (kind === 'audit-trail') {
    // Only events explicitly scoped to this branch or its sales invoices are included.
    const invoiceIds = await db.salesInvoice.findMany({ where: scope, select: { id: true } });
    const records = await db.auditEvent.findMany({ where: { organizationId: scope.organizationId, occurredAt: bounds.timestampWhere, OR: [{ metadata: { path: ['branchId'], equals: branchId } }, { entityType: 'SalesInvoice', entityId: { in: invoiceIds.map(i => i.id) } }] }, include: { actor: { select: { name: true } } }, orderBy: { occurredAt: 'desc' } });
    columns = ['Date', 'Staff', 'Action', 'Entity', 'Reference'];
    rows = records.filter(r => matchesReportTime(storeCalendarDate(r.occurredAt), r.occurredAt, q)).map(r => ({ Date: date(storeCalendarDate(r.occurredAt)), Staff: r.actor?.name || 'System', Action: r.action, Entity: r.entityType, Reference: r.entityId }));
    note = 'Events with a verified branch reference, including sales invoice events.';
  } else {
    const invoices = await db.salesInvoice.findMany({ where: { ...scope, status: 'POSTED', invoiceDate: bounds.where }, include: { party: true, lines: { include: { variant: { include: { product: true } } } } }, orderBy: { invoiceDate: 'desc' } });
    const selected = invoices.filter(i => matchesReportTime(i.invoiceDate, i.createdAt, q));
    if (kind === 'bill-profit') {
      columns = ['Date', 'Invoice', 'Party', 'Sales Excluding Tax', 'Recorded Cost', 'Gross Profit']; moneyColumns = columns.slice(3);
      rows = selected.map(i => {
        const revenue = num(i.grandTotal) - num(i.cgstTotal) - num(i.sgstTotal) - num(i.igstTotal);
        const complete = i.lines.every(l => l.totalCostAtSale != null);
        const cost = i.lines.reduce((s, l) => s + num(l.totalCostAtSale), 0);
        return { Date: date(i.invoiceDate), Invoice: i.invoiceNumber, Party: i.party?.name || 'Cash Sale', 'Sales Excluding Tax': revenue, 'Recorded Cost': complete ? cost : 'Not recorded', 'Gross Profit': complete ? revenue - cost : 'Not available' };
      });
      note = 'Gross profit before returns and operating expenses, using cost recorded at sale. Bills without a complete cost snapshot are excluded from cost/profit totals.';
    } else if (kind === 'sales-summary') {
      columns = ['Date', 'Invoice', 'Party', 'Amount', 'Paid', 'Balance']; moneyColumns = ['Amount', 'Paid', 'Balance'];
      rows = selected.map(i => ({ Date: date(i.invoiceDate), Invoice: i.invoiceNumber, Party: i.party?.name || 'Cash Sale', Amount: num(i.grandTotal), Paid: num(i.paidAmount), Balance: num(i.grandTotal) - num(i.paidAmount) }));
      note = 'Posted sales in the selected period. Paid and balance reflect current invoice state.';
    } else if (kind === 'sales-staff' || kind === 'daybook-staff') {
      const events = await db.auditEvent.findMany({ where: { organizationId: scope.organizationId, entityType: 'SalesInvoice', entityId: { in: selected.map(i => i.id) }, action: 'sales.posted' }, include: { actor: { select: { name: true } } } });
      const staff = new Map(events.map(e => [e.entityId, e.actor?.name || 'Unassigned']));
      rows = selected.map(i => ({ Date: date(i.invoiceDate), Staff: staff.get(i.id) || 'Unassigned', Invoice: i.invoiceNumber, Party: i.party?.name || 'Cash Sale', Amount: num(i.grandTotal), Paid: num(i.paidAmount), Balance: num(i.grandTotal) - num(i.paidAmount) }));
      columns = ['Date', 'Staff', 'Invoice', 'Party', 'Amount', 'Paid', 'Balance']; moneyColumns = ['Amount', 'Paid', 'Balance'];
      if (kind === 'sales-staff') { rows = group(rows, ['Staff'], moneyColumns); columns = ['Staff', ...moneyColumns]; }
      note = 'Posted sales attributed to the original posting staff member. Paid and balance reflect the current invoice state.';
    } else {
      rows = selected.flatMap(i => i.lines.map(l => ({ Date: date(i.invoiceDate), Invoice: i.invoiceNumber, Party: i.party?.name || 'Cash Sale', 'Product ID': l.variant.productId, 'Product Name': l.variant.product.name, Item: l.itemName, 'Item Code': l.sku, Size: l.variant.size || '', Category: l.variant.product.category, HSN: l.hsnCode, Quantity: num(l.quantity), 'Tax Rate': num(l.taxRate), Taxable: num(l.taxableAmount), CGST: num(l.cgst), SGST: num(l.sgst), IGST: num(l.igst), Amount: num(l.total) })));
      const sums = ['Quantity', 'Taxable', 'CGST', 'SGST', 'IGST', 'Amount']; moneyColumns = sums.slice(1);
      if (kind === 'category-sales') { rows = group(rows, ['Category'], sums); columns = ['Category', ...sums]; }
      else if (kind === 'hsn-sales') { rows = group(rows, ['HSN', 'Tax Rate'], sums); columns = ['HSN', 'Tax Rate', ...sums]; }
      else if (kind === 'item-party' || kind === 'party-item') {
        const keys = kind === 'item-party' ? ['Item', 'Item Code', 'Size', 'Party'] : ['Party', 'Item', 'Item Code', 'Size'];
        rows = group(rows, kind === 'item-party' ? [...keys, 'Product ID', 'Product Name'] : keys, sums); columns = [...keys, ...sums];
        if (kind === 'item-party') rows.sort((a, b) => num(b.Quantity) - num(a.Quantity) || String(a.Item).localeCompare(String(b.Item)));
      } else columns = ['Date', 'Invoice', 'Party', 'Item', 'HSN', 'Tax Rate', ...sums];
      note = 'Posted sales line totals before returns; bill-level adjustments are excluded. Tax breakdown is not a GST filing.';
    }
  }
  rows = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? Number(value.toFixed(moneyColumns.includes(key) ? 2 : 3)) : value])));
  res.json({ rows, columns, moneyColumns, note, from: bounds.from, to: bounds.to });
});
