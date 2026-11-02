import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareItemReport } from '../src/utils/itemReport.ts';

const rows = [
  { Item: 'Shirt', 'Item Code': 'S', Size: 'M', Party: 'Alice', Quantity: 2, Amount: 200 },
  { Item: 'Pant', 'Item Code': 'P', Size: 'L', Party: 'Alice', Quantity: 10, Amount: 2000 },
  { Item: 'Shirt', 'Item Code': 'S', Size: 'M', Party: 'Bob', Quantity: 12, Amount: 1200 },
  { Item: 'Shirt', 'Item Code': 'S-L', Size: 'L', Party: 'Bob', Quantity: 1, Amount: 100 },
];
test('item ranking combines parties, keeps variants separate, and preserves totals', () => {
  const result = prepareItemReport(rows, '', true, 'quantity-desc');
  assert.deepEqual(result.map(r => r.Quantity), [14, 10, 1]);
  assert.equal(result[0].Amount, 1400);
  assert.equal(result.reduce((sum, r) => sum + Number(r.Quantity), 0), 25);
  assert.equal(result.reduce((sum, r) => sum + Number(r.Amount), 0), 3500);
  assert.equal(rows[0].Quantity, 2);
});
test('search filters before totals and sorting supports quantities and amounts', () => {
  assert.deepEqual(prepareItemReport(rows, ' Alice ', true, 'quantity-desc').map(r => r.Quantity), [10, 2]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'quantity-asc').map(r => r.Quantity), [1, 10, 14]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'amount-desc').map(r => r.Amount), [2000, 1400, 100]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'amount-asc').map(r => r.Amount), [100, 1400, 2000]);
  assert.deepEqual(prepareItemReport(rows, '', false, 'quantity-desc').map(r => r.Quantity), [12, 10, 2, 1]);
  assert.deepEqual(prepareItemReport(rows, 'missing', true, 'quantity-desc'), []);
});
