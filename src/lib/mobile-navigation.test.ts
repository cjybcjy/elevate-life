import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
  isMobileNavItemActive,
} from './mobile-navigation';

test('mobile navigation keeps five primary actions in the approved order', () => {
  assert.deepEqual(
    MOBILE_PRIMARY_NAV_ITEMS.map((item) => [item.id, item.href]),
    [
      ['home', '/'],
      ['assets', '/management/assets'],
      ['quick-entry', '/management/ledger?focus=create'],
      ['budget', '/management/budget'],
      ['me', '/me'],
    ],
  );
});

test('mobile more menu preserves every low-frequency route', () => {
  assert.deepEqual(
    MOBILE_MORE_NAV_ITEMS.map((item) => item.href),
    [
      '/management/recurring',
      '/management/liabilities',
      '/management/goals',
      '/management/categories',
      '/account/password',
    ],
  );
});

test('mobile active state marks page tabs', () => {
  assert.equal(isMobileNavItemActive('/', 'home'), true);
  assert.equal(isMobileNavItemActive('/management/assets', 'assets'), true);
  assert.equal(isMobileNavItemActive('/management/budget/history', 'budget'), true);
  assert.equal(isMobileNavItemActive('/me', 'me'), true);
  assert.equal(isMobileNavItemActive('/possessions', 'me'), true);
  assert.equal(isMobileNavItemActive('/investment-cost', 'me'), true);
  assert.equal(isMobileNavItemActive('/management/recurring', 'me'), true);
});

test('focus=create selects only quick-entry while normal ledger belongs to My', () => {
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry', 'create'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'me', 'create'), false);
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry', null), false);
  assert.equal(isMobileNavItemActive('/management/ledger', 'me', null), true);
});
