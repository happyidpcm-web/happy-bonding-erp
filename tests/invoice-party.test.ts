import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findInvoiceParty, invoiceBelongsToParty } from '../src/utils/invoiceParty.ts';

const parties = [
  { id: 'other', name: '2.0 GUNA', phone: '9087761903' },
  { id: 'guna', name: '2.0 GUNA', phone: '6382946743' },
];

test('same-name contacts never override the linked party or mobile number', () => {
  assert.equal(findInvoiceParty(parties, { partyId: 'guna', partyPhone: '6382946743' })?.id, 'guna');
  assert.equal(findInvoiceParty(parties, { partyPhone: '+91 63829 46743' })?.id, 'guna');
  assert.equal(invoiceBelongsToParty({ partyId: 'guna' }, parties[0]), false);
});

test('missing linked contacts, empty phones and ambiguous phones are not guessed', () => {
  assert.equal(findInvoiceParty(parties, { partyId: 'missing', partyPhone: '6382946743' }), undefined);
  assert.equal(findInvoiceParty([{ id: 'empty', phone: '' }], {}), undefined);
  assert.equal(findInvoiceParty([...parties, { ...parties[1], id: 'duplicate' }], { partyPhone: '6382946743' }), undefined);
  assert.equal(findInvoiceParty(parties, { partyId: 'guna', partyPhone: '9087761903' })?.id, 'guna');
});
