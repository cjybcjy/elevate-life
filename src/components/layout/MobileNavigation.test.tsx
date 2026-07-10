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

test('MobileNavigationView gives topbar controls 44px minimum touch targets', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/"
      menuOpen={false}
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.match(markup, /class="mobile-brand min-h-11"/);
  assert.match(markup, /class="mobile-icon-button min-h-11 min-w-11"/);
});

test('MobileNavigationView expands the actual theme button to a 44px target', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/"
      menuOpen
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  ).replaceAll('&amp;', '&');

  assert.match(
    markup,
    /class="\[&_button\]:min-h-11 \[&_button\]:min-w-11"><button[^>]*aria-label="切换主题"/,
  );
});

test('MobileNavigationView keeps only the More trigger pointer-active above the backdrop', () => {
  const markup = renderToString(
    <MobileNavigationView
      pathname="/"
      menuOpen
      onMenuToggle={() => {}}
      onMenuClose={() => {}}
      onLogout={() => {}}
    />,
  );

  assert.match(
    markup,
    /<header class="mobile-topbar" style="z-index:110;pointer-events:none">/,
  );
  assert.match(markup, /aria-label="更多功能"[^>]*style="pointer-events:auto"/);
});
