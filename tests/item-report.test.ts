import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareItemReport } from '../src/utils/itemReport.ts';

const rows = [
  { Item: 'Shirt', 'Item Code': 'S', Size: 'M', Party: 'Alice', Quantity: 2, Amount: 200 },
  { Item: 'Pant', 'Item Code': 'P', Size: 'L', Party: 'Alice', Quantity: 10, Amount: 2000 },
  { Item: 'Shirt', 'Item Code': 'S', Size: 'M', Party: 'Bob', Quantity: 12, Amount: 1200 },
  { Item: 'Shirt', 'Item Code': 'S-L', Size: 'L', Party: 'Bob', Quantity: 1, Amount: 100 },
];

test('report search matches reordered terms across visible fields', () => {
  assert.deepEqual(prepareItemReport(rows, 'Bob Shirt', false, 'quantity-desc').map(r => r.Quantity), [12, 1]);
  assert.deepEqual(prepareItemReport(rows, 'L Shirt', true, 'quantity-desc').map(r => r.Quantity), [15]);
  assert.deepEqual(prepareItemReport(rows, 'Bob missing', false, 'quantity-desc'), []);
});
test('item ranking combines parties, combines sizes, and preserves totals', () => {
  const result = prepareItemReport(rows, '', true, 'quantity-desc');
  assert.deepEqual(result.map(r => r.Quantity), [15, 10]);
  assert.equal(result[0].Amount, 1500);
  assert.equal(result.reduce((sum, r) => sum + Number(r.Quantity), 0), 25);
  assert.equal(result.reduce((sum, r) => sum + Number(r.Amount), 0), 3500);
  assert.equal(rows[0].Quantity, 2);
});
test('item search retains complete product totals and sorting supports quantities and amounts', () => {
  assert.deepEqual(prepareItemReport(rows, ' Shirt ', true, 'quantity-desc').map(r => r.Quantity), [15]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'quantity-asc').map(r => r.Quantity), [10, 15]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'amount-desc').map(r => r.Amount), [2000, 1500]);
  assert.deepEqual(prepareItemReport(rows, '', true, 'amount-asc').map(r => r.Amount), [1500, 2000]);
  assert.deepEqual(prepareItemReport(rows, '', false, 'quantity-desc').map(r => r.Quantity), [12, 10, 2, 1]);
  assert.deepEqual(prepareItemReport(rows, 'missing', true, 'quantity-desc'), []);
});

test('product identity combines renamed variants without merging distinct products', () => {
  const source = [
    { 'Product ID': 'one', 'Product Name': 'Shirt', Item: 'Old shirt M', 'Item Code': 'M', Quantity: 2, Amount: 200 },
    { 'Product ID': 'one', 'Product Name': 'Shirt', Item: 'Shirt L', 'Item Code': 'L', Quantity: 3, Amount: 300 },
    { 'Product ID': 'two', 'Product Name': 'Shirt', Item: 'Shirt', 'Item Code': 'OTHER', Quantity: 1, Amount: 90 },
  ];
  const result = prepareItemReport(source, '', true, 'quantity-desc');
  assert.deepEqual(result.map(r => r.Quantity), [5, 1]);
  assert.equal(result[0].Amount, 500);
  assert.equal(result[0].Item, 'Shirt');
  assert.equal(prepareItemReport(source, 'Old shirt', true, 'quantity-desc')[0].Quantity, 5);
});
