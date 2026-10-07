import assert from 'node:assert/strict';
import { orderBranches } from '../server/branch-order.js';

const branches = [
  { id: 'ambai', code: 'AMBAI', name: 'AMBASAMUDRAM' },
  { id: 'empty', code: 'PAV', name: 'Pavoorchatram' },
  { id: 'working', code: 'PCM', name: 'Pavoorchatram' },
];
assert.equal(orderBranches(branches)[0].id, 'working');
assert.equal(orderBranches(branches.slice(0, 2))[0].id, 'empty', 'Legacy local PAV must default to Pavoorchatram when PCM does not exist');
assert.deepEqual(orderBranches([branches[0]]), [branches[0]], 'Staff access must not expand');
assert.equal(branches[0].id, 'ambai', 'Ordering must not mutate input');
assert.deepEqual(orderBranches([]), []);
console.log('Default branch selection checks passed.');
