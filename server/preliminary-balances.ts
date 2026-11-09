type Amount = number | string | { toString(): string };
export function preliminaryBalances(input: {
  stock: Array<{ quantity: Amount; variant: { purchasePrice: Amount } }>;
  invoices: Array<{ grandTotal: Amount; paidAmount: Amount; creditNotes: Array<{ amount: Amount }> }>;
  parties: Array<{ openingBalance: Amount; openingBalanceType: string }>;
  purchases: Array<{ amount: Amount; details: unknown }>;
  payments: Array<{ direction: string; amount: Amount }>;
}) {
  const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  let invoiceDue = 0, invoiceCredit = 0;
  for (const i of input.invoices) {
    const balance = Number(i.grandTotal) - Number(i.paidAmount) - i.creditNotes.reduce((s, c) => s + Number(c.amount), 0);
    invoiceDue += Math.max(0, balance);
    invoiceCredit += Math.max(0, -balance);
  }
  let purchaseDue = 0, missingPurchasePayments = 0;
  for (const p of input.purchases) {
    const paid = (p.details as { paidAmount?: unknown } | null)?.paidAmount;
    if (typeof paid !== 'number' || !Number.isFinite(paid) || paid < 0 || paid > Number(p.amount)) { missingPurchasePayments++; continue; }
    purchaseDue += Number(p.amount) - paid;
  }
  const received = input.payments.filter(p => p.direction === 'IN').reduce((s, p) => s + Number(p.amount), 0);
  const paid = input.payments.filter(p => p.direction === 'OUT').reduce((s, p) => s + Number(p.amount), 0);
  return {
    stockValue: round(input.stock.reduce((s, r) => s + Number(r.quantity) * Number(r.variant.purchasePrice), 0)),
    negativeStockItems: input.stock.filter(r => Number(r.quantity) < 0).length,
    invoiceDue: round(invoiceDue), invoiceCredit: round(invoiceCredit),
    openingReceivable: round(input.parties.filter(p => p.openingBalanceType === 'TO_COLLECT').reduce((s, p) => s + Number(p.openingBalance), 0)),
    openingPayable: round(input.parties.filter(p => p.openingBalanceType === 'TO_PAY').reduce((s, p) => s + Number(p.openingBalance), 0)),
    purchaseDue: round(purchaseDue), missingPurchasePayments,
    received: round(received), paid: round(paid), netMovement: round(received - paid),
  };
}
