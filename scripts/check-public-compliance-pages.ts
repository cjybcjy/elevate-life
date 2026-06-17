import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const requiredFiles = [
  'src/app/privacy/page.tsx',
  'src/app/support/page.tsx',
  'src/app/account-deletion/page.tsx',
  'src/app/terms/page.tsx',
  'src/components/layout/AppShell.tsx',
];

for (const path of requiredFiles) {
  assert(existsSync(resolve(process.cwd(), path)), `${path} should exist for store compliance.`);
}

const privacySource = read('src/app/privacy/page.tsx');
const supportSource = read('src/app/support/page.tsx');
const deletionSource = read('src/app/account-deletion/page.tsx');
const termsSource = read('src/app/terms/page.tsx');
const shellSource = read('src/components/layout/AppShell.tsx');
const layoutSource = read('src/app/layout.tsx');
const proxySource = read('src/proxy.ts');
const metadataSource = read('docs/release/app-store-metadata.md');
const checklistSource = read('docs/release/store-publishing-checklist.md');

assert(
  privacySource.includes('隐私政策') &&
    privacySource.includes('家庭财务数据') &&
    privacySource.includes('账号信息') &&
    privacySource.includes('数据删除') &&
    privacySource.includes('联系我们'),
  'Privacy page should disclose finance data, account data, deletion, and contact channels.',
);

assert(
  supportSource.includes('支持与帮助') &&
    supportSource.includes('审核测试账号') &&
    supportSource.includes('隐私政策') &&
    supportSource.includes('/account-deletion'),
  'Support page should include review account notes and link to privacy/deletion pages.',
);

assert(
  deletionSource.includes('账号与数据删除') &&
    deletionSource.includes('删除范围') &&
    deletionSource.includes('处理时限') &&
    deletionSource.includes('审核备注'),
  'Account deletion page should explain deletion scope, timeline, and reviewer notes.',
);

assert(
  termsSource.includes('用户协议') &&
    termsSource.includes('服务条款') &&
    termsSource.includes('家庭财务数据') &&
    termsSource.includes('用户责任') &&
    termsSource.includes('隐私政策') &&
    termsSource.includes('/privacy') &&
    termsSource.includes('/support'),
  'Terms page should explain service terms, finance data scope, user responsibility, privacy, and support links.',
);

assert(
  shellSource.includes("'use client'") &&
    shellSource.includes('publicPaths') &&
    shellSource.includes('/privacy') &&
    shellSource.includes('/support') &&
    shellSource.includes('/account-deletion') &&
    shellSource.includes('/terms') &&
    shellSource.includes('showSidebar'),
  'App shell should hide the authenticated sidebar on public compliance pages.',
);

assert(
  layoutSource.includes("import AppShell from '@/components/layout/AppShell';") ||
    layoutSource.includes('import AppShell from "@/components/layout/AppShell";'),
  'Root layout should delegate app chrome to AppShell.',
);

assert(
  proxySource.includes('/privacy') &&
    proxySource.includes('/support') &&
    proxySource.includes('/account-deletion') &&
    proxySource.includes('/terms') &&
    proxySource.includes('privacy|support|account-deletion|terms'),
  'Proxy should allow public compliance routes without login and exclude them from the auth matcher.',
);

assert(
  metadataSource.includes('/privacy') &&
    metadataSource.includes('/support') &&
    metadataSource.includes('/account-deletion') &&
    metadataSource.includes('/terms') &&
    checklistSource.includes('/privacy') &&
    checklistSource.includes('/support') &&
    checklistSource.includes('/account-deletion') &&
    checklistSource.includes('/terms'),
  'Store metadata and checklist should reference public compliance URLs.',
);
