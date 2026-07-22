import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import BirdLogo from '../src/components/common/BirdLogo';

const sidebarSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'),
  'utf8',
);

const logoElement = BirdLogo({ size: 36 });

assert.equal(logoElement.type, 'span');
assert.equal(logoElement.props.role, 'img');
assert.equal(logoElement.props['aria-label'], '家庭账本 logo');

const logoChildren = Array.isArray(logoElement.props.children)
  ? logoElement.props.children
  : [logoElement.props.children];

assert.equal(logoChildren.length, 1);
assert.equal(logoChildren[0].props.src, '/logo-bird-a-light.png');
assert.equal(logoChildren[0].props.alt, '');
assert(readFileSync(resolve(process.cwd(), 'public/logo-bird-a-light.png')).length > 10_000);
assert(sidebarSource.includes("import BirdLogo from '@/components/common/BirdLogo';"));
assert(sidebarSource.includes('<BirdLogo'));
assert(!sidebarSource.includes('📊 家庭账本'));
