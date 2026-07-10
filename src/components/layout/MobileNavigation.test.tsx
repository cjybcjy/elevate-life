import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToString } from 'react-dom/server';
import { MobileNavigationView } from './MobileNavigation';

test('MobileNavigationView renders five primary actions and a closed more button', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/"
      menuOpen={false}
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.equal((markup.match(/data-mobile-primary-nav=/g) ?? []).length, 5);
  assert.match(markup, /href="\/management\/ledger\?focus=create"/);
  assert.match(markup, /aria-label="更多功能"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /role="dialog"/);
});

test('MobileNavigationView exposes all approved more-menu actions', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/management/ledger"
      menuOpen
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.match(markup, /role="dialog"/);
  assert.match(markup, /aria-label="更多功能菜单"/);
  assert.match(markup, /负债管理/);
  assert.match(markup, /目标管理/);
  assert.match(markup, /分类管理/);
  assert.match(markup, /修改密码/);
  assert.match(markup, /退出登录/);
});
