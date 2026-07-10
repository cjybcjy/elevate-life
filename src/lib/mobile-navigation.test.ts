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
      ['ledger', '/management/ledger'],
      ['budget', '/management/budget'],
    ],
  );
});

test('mobile more menu preserves every low-frequency route', () => {
  assert.deepEqual(
    MOBILE_MORE_NAV_ITEMS.map((item) => item.href),
    [
      '/management/liabilities',
      '/management/goals',
      '/management/categories',
      '/account/password',
    ],
  );
});

test('mobile active state marks page tabs but not the quick-entry action', () => {
  assert.equal(isMobileNavItemActive('/', 'home'), true);
  assert.equal(isMobileNavItemActive('/management/assets', 'assets'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'ledger'), true);
  assert.equal(isMobileNavItemActive('/management/ledger', 'quick-entry'), false);
  assert.equal(isMobileNavItemActive('/management/budget/history', 'budget'), true);
});
