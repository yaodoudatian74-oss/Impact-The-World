import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stick, padFamily, PAD_LABELS } from '../src/core/input.js';

test('stick dead zone: centre is zero, full deflection reaches 1, direction is kept', () => {
  assert.deepEqual(stick(0.05, -0.05), { x: 0, y: 0, m: 0 });
  const full = stick(1, 0);
  assert.ok(Math.abs(full.x - 1) < 1e-9 && full.m === 1);
  const half = stick(0, -0.6);
  assert.ok(half.y < 0 && Math.abs(half.x) < 1e-12, 'direction kept');
  assert.ok(half.m > 0 && half.m < 1);
});

test('gamepad family from device id, with matching face labels', () => {
  assert.equal(padFamily('Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'), 'xbox');
  assert.equal(padFamily('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'playstation');
  assert.equal(padFamily('Nintendo Switch Pro Controller'), 'nintendo');
  assert.equal(padFamily('Generic pad'), 'xbox');
  assert.equal(PAD_LABELS.playstation.bottom, '×');
  assert.equal(PAD_LABELS.nintendo.bottom, 'B');
});
