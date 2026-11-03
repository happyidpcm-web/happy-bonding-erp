type PartyIdentity = { id: string | number; phone?: string };
type InvoiceIdentity = { partyId?: string; partyPhone?: string };

function phoneKey(phone?: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function invoiceBelongsToParty(invoice: InvoiceIdentity, party: PartyIdentity): boolean {
  if (invoice.partyId) return String(party.id) === String(invoice.partyId);
  const phone = phoneKey(invoice.partyPhone);
  return Boolean(phone) && phone === phoneKey(party.phone);
}

export function findInvoiceParty<T extends PartyIdentity>(parties: T[], invoice: InvoiceIdentity): T | undefined {
  const matches = parties.filter(party => invoiceBelongsToParty(invoice, party));
  // Never guess between contacts sharing a phone number on a legacy invoice.
  return matches.length === 1 ? matches[0] : undefined;
}
