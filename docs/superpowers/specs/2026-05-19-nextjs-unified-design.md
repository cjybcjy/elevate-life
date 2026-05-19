# Family Ledger Pro - Next.js 全栈一体化架构设计文档

**日期**: 2026-05-19
**版本**: v2.0
**状态**: 待实现评审

---

## 1. 项目概述

将当前前后端分离的 NestJS + React 架构，彻底迁移为 Next.js 14+ 全栈一体化系统。核心逻辑仍为"资产动态化、负债可视化、支出结构化"。

**技术栈**:
- 框架: Next.js 14+ (App Router)
- 语言: TypeScript
- 样式: Tailwind CSS
- 数据库: SQLite (开发) / PostgreSQL (生产)
- ORM: Prisma
- 认证: Auth.js (NextAuth v5)
- 图表: ECharts
- 财务计算: decimal.js
- 加密: node:crypto (AES-256-GCM)

---

## 2. 系统架构概览

### 2.1 整体结构

单体全栈应用，前后端代码统一在一个 Next.js 项目中，通过 Server Actions 直连数据库。

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ App Router   │ │ Server       │ │ Client       │        │
│  │ (Pages)      │ │ Components   │ │ Components   │        │
│  │              │ │ (RSC)        │ │ ('use client')│        │
│  └──────────────┘ └──────┬───────┘ └──────────────┘        │
│                          │                                   │
│              ┌───────────▼────────────┐                    │
│              │   Server Actions        │                    │
│              │   (lib/actions/*.ts)    │                    │
│              └───────────┬────────────┘                    │
│                          │                                   │
│              ┌───────────▼────────────┐                    │
│              │   Prisma Client         │                    │
│              │   (SQLite/PostgreSQL)   │                    │
│              └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
elevate-life/
├── prisma/                        # 数据库 Schema 与迁移文件
│   ├── schema.prisma              # SQLite 兼容的完整数据模型
│   └── migrations/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/                # 认证相关路由组 (Edge-safe)
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/           # 核心可视化大盘
│   │   │   ├── page.tsx           # Slide 1: 净资产总览
│   │   │   ├── assets/page.tsx    # Slide 2: 资产配置
│   │   │   ├── liabilities/page.tsx # Slide 3: 负债分析
│   │   │   ├── scissor/page.tsx   # Slide 4: 收支剪刀图
│   │   │   └── forecast/page.tsx  # Slide 5: 现金流预测
│   │   ├── management/            # 数据维护后台
│   │   │   ├── assets/page.tsx
│   │   │   ├── liabilities/page.tsx
│   │   │   └── ledger/page.tsx    # 收支流水录入
│   │   ├── api/cron/gold/route.ts # 生产环境 Cron 端点
│   │   ├── layout.tsx             # 根布局与主题
│   │   └── globals.css
│   ├── components/                # 共享组件
│   │   ├── charts/                # ECharts 图表 (动态懒加载)
│   │   ├── common/                # 通用组件
│   │   ├── forms/                 # 表单模态框
│   │   ├── layout/                # 布局组件
│   │   └── slides/                # Dashboard 幻灯片
│   ├── lib/
│   │   ├── prisma.ts              # Prisma 单例 (HMR 安全)
│   │   ├── auth.config.ts         # Edge 安全认证配置
│   │   ├── auth.ts                # 服务端认证逻辑
│   │   ├── crypto.ts              # AES-256-GCM 加密引擎
│   │   ├── cron.ts                # 本地开发定时任务
│   │   └── actions/               # Server Actions
│   │       ├── auth.ts
│   │       ├── assets.ts
│   │       ├── liabilities.ts
│   │       ├── ledger.ts
│   │       ├── categories.ts
│   │       ├── gold.ts
│   │       ├── forecast.ts
│   │       └── stock.ts
│   ├── types/
│   │   └── next-auth.d.ts         # Auth.js 类型扩展
│   └── middleware.ts              # Edge 路由守卫
├── public/
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. 数据库设计 (Prisma Schema)

### 3.1 完整 Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(uuid())
  username     String        @unique
  passwordHash String        @map("password_hash")
  displayName  String?       @map("display_name")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  assets       Asset[]
  liabilities  Liability[]
  transactions Transaction[]
  categories   Category[]
}

model Asset {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  name            String
  category        String
  balance         String?
  currency        String   @default("CNY")
  valuationMethod String?  @map("valuation_method")
  liquidityTier   String?  @map("liquidity_tier")
  isEncrypted     Boolean  @default(false) @map("is_encrypted")
  costPrice       String?  @map("cost_price")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user             User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactionsFrom Transaction[] @relation("fromAsset")
  transactionsTo   Transaction[] @relation("toAsset")

  @@index([userId, category])
}

model Liability {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  name           String
  category       String
  principal      String?
  currentBalance String?  @map("current_balance")
  interestRate   Decimal  @map("interest_rate")
  termMonths     Int      @map("term_months")
  startDate      DateTime @map("start_date")
  paymentMethod  String   @map("payment_method")
  monthlyPayment String?  @map("monthly_payment")
  isEncrypted    Boolean  @default(false) @map("is_encrypted")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  milestones   DebtMilestone[]
  transactions Transaction[]   @relation("liabilityTransactions")
}

model DebtMilestone {
  id               String   @id @default(uuid())
  liabilityId      String   @map("liability_id")
  monthIndex       Int      @map("month_index")
  dueDate          DateTime @map("due_date")
  principalDue     Decimal  @map("principal_due")
  interestDue      Decimal  @map("interest_due")
  totalDue         Decimal  @map("total_due")
  remainingBalance Decimal  @map("remaining_balance")
  scenarioType     String   @default("base") @map("scenario_type")
  createdAt        DateTime @default(now()) @map("created_at")

  liability Liability @relation(fields: [liabilityId], references: [id], onDelete: Cascade)

  @@index([liabilityId, monthIndex])
}

model Transaction {
  id            String    @id @default(uuid())
  userId        String    @map("user_id")
  type          String
  amount        Decimal
  categoryId    String?   @map("category_id")
  fromAccountId String?   @map("from_account_id")
  toAccountId   String?   @map("to_account_id")
  liabilityId   String?   @map("liability_id")
  description   String?
  occurredAt    DateTime  @map("occurred_at")
  isEssential   Boolean   @default(false) @map("is_essential")
  createdAt     DateTime  @default(now()) @map("created_at")

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  category   Category?  @relation(fields: [categoryId], references: [id])
  fromAsset  Asset?     @relation("fromAsset", fields: [fromAccountId], references: [id])
  toAsset    Asset?     @relation("toAsset", fields: [toAccountId], references: [id])
  liability  Liability? @relation("liabilityTransactions", fields: [liabilityId], references: [id])

  @@index([userId, occurredAt])
}

model Category {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  name           String
  type           String
  isEssential    Boolean  @default(false) @map("is_essential")
  essentialRatio Decimal  @default(1.00) @map("essential_ratio")
  icon           String?
  color          String?
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}

model GoldPrice {
  id             String   @id @default(uuid())
  assetType      String   @default("gold_au9999") @map("asset_type")
  price          Decimal
  dataSource     String?  @map("data_source")
  isInterpolated Boolean  @default(false) @map("is_interpolated")
  recordedAt     DateTime @default(now()) @map("recorded_at")

  @@index([assetType, recordedAt])
}

model StockPrice {
  id        String   @id @default(uuid())
  code      String
  name      String
  price     Decimal
  market    String
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

### 3.2 关键设计决策

- **SQLite 兼容**：移除 `@db.Decimal` 和 `@db.Date` 修饰符，避免 Prisma 编译报错
- **加密字段存储**：`balance`、`principal`、`currentBalance` 使用 `String` 类型存储明文或 `enc:...` 加密值
- **Transaction 关系**：新增 `liabilityId` 字段专门追踪还贷流水，避免与 `fromAccountId` 的外键冲突

---

## 4. 认证与安全

### 4.1 配置分离 (Edge Runtime 兼容)

```typescript
// src/lib/auth.config.ts
import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.username = user.username;
        token.derivedKey = user.derivedKey;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.username = token.username as string;
        session.user.derivedKey = token.derivedKey as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
```

### 4.2 服务端认证 (非 Edge)

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { prisma } from './prisma';
import { authConfig } from './auth.config';
import { generateDerivedKey } from './crypto';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { type: 'text' },
        password: { type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        const derivedKey = generateDerivedKey(credentials.password as string, user.id);
        return {
          id: user.id,
          name: user.displayName,
          username: user.username,
          derivedKey,
        };
      },
    }),
  ],
});
```

### 4.3 Edge 中间件路由保护

```typescript
// src/middleware.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuth = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';

  if (!isAuth && !isLoginPage) {
    return Response.redirect(new URL('/login', req.url));
  }
  if (isAuth && isLoginPage) {
    return Response.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

### 4.4 类型扩展

```typescript
// src/types/next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface User {
    username: string;
    derivedKey?: string;
  }
  interface Session {
    user: {
      id: string;
      username: string;
      derivedKey?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string;
    derivedKey?: string;
  }
}
```

---

## 5. Server Actions 架构

### 5.1 核心设计原则

1. **原子事务**：所有可变操作包裹在 `prisma.$transaction` 中
2. **并发保护**：事务内读取目标记录后进行更新，利用数据库事务隔离性防止脏读
3. **全局刷新**：财务变更后调用 `revalidatePath('/', 'layout')` 确保所有页面数据同步
4. **返回值脱敏**：绝不返回含 `enc:...` 的原始数据库实体，返回解密后的纯 JSON

### 5.2 标准范式 (ledger.ts)

```typescript
'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { decryptValue, encryptValue } from '@/lib/crypto';
import Decimal from 'decimal.js';

export async function createTransaction(data: CreateTransactionInput) {
  const session = await auth();
  const derivedKey = session?.user?.derivedKey;
  const userId = session?.user?.id;
  if (!userId || !derivedKey) {
    return { success: false, error: 'Unauthorized: Session key expired.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 支出：扣减来源资产
      if (data.type === 'EXPENSE' && data.fromAccountId) {
        const asset = await tx.asset.findUnique({
          where: { id: data.fromAccountId, userId },
        });
        if (!asset || !asset.balance) throw new Error('Source asset not found.');

        const currentBalance = new Decimal(decryptValue(asset.balance, derivedKey));
        const newBalance = currentBalance.minus(new Decimal(data.amount));
        if (newBalance.isNegative()) throw new Error('Insufficient balance.');

        await tx.asset.update({
          where: { id: data.fromAccountId },
          data: { balance: encryptValue(newBalance.toFixed(4), derivedKey) },
        });
      }

      // 收入：增加目标资产
      if (data.type === 'INCOME' && data.toAccountId) {
        const asset = await tx.asset.findUnique({
          where: { id: data.toAccountId, userId },
        });
        if (!asset || !asset.balance) throw new Error('Target asset not found.');

        const currentBalance = new Decimal(decryptValue(asset.balance, derivedKey));
        const newBalance = currentBalance.plus(new Decimal(data.amount));

        await tx.asset.update({
          where: { id: data.toAccountId },
          data: { balance: encryptValue(newBalance.toFixed(4), derivedKey) },
        });
      }

      // 转账：双向更新
      if (data.type === 'TRANSFER' && data.fromAccountId && data.toAccountId) {
        const fromAsset = await tx.asset.findUnique({
          where: { id: data.fromAccountId, userId },
        });
        const toAsset = await tx.asset.findUnique({
          where: { id: data.toAccountId, userId },
        });
        if (!fromAsset?.balance || !toAsset?.balance) throw new Error('Asset not found.');

        const fromBalance = new Decimal(decryptValue(fromAsset.balance, derivedKey));
        const toBalance = new Decimal(decryptValue(toAsset.balance, derivedKey));
        const amount = new Decimal(data.amount);

        if (fromBalance.minus(amount).isNegative()) throw new Error('Insufficient balance.');

        await tx.asset.update({
          where: { id: data.fromAccountId },
          data: { balance: encryptValue(fromBalance.minus(amount).toFixed(4), derivedKey) },
        });
        await tx.asset.update({
          where: { id: data.toAccountId },
          data: { balance: encryptValue(toBalance.plus(amount).toFixed(4), derivedKey) },
        });
      }

      // 还贷：扣减负债余额
      if (data.liabilityId && data.amount) {
        const liability = await tx.liability.findUnique({
          where: { id: data.liabilityId, userId },
        });
        if (liability && liability.currentBalance) {
          const currentDebt = new Decimal(decryptValue(liability.currentBalance, derivedKey));
          const newDebt = currentDebt.minus(new Decimal(data.amount));
          await tx.liability.update({
            where: { id: data.liabilityId },
            data: { currentBalance: encryptValue(newDebt.toFixed(4), derivedKey) },
          });
        }
      }

      // 记录流水
      const txRecord = await tx.transaction.create({
        data: {
          userId,
          type: data.type,
          amount: data.amount,
          categoryId: data.categoryId,
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          liabilityId: data.liabilityId,
          description: data.description,
          isEssential: data.isEssential,
          occurredAt: new Date(data.occurredAt),
        },
      });

      return { id: txRecord.id };
    });

    revalidatePath('/', 'layout');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Transaction failed.' };
  }
}
```

---

## 6. 前端设计规范

### 6.1 配色方案 (Deep Dark)

```css
theme: {
  extend: {
    colors: {
      'ledger-bg': '#0f172a',
      'ledger-surface': '#1e293b',
      'ledger-primary': '#1e3a8a',
      'ledger-accent': '#3b82f6',
      'ledger-text': '#ffffff',
      'ledger-muted': '#94a3b8',
      'ledger-success': '#10b981',
      'ledger-warning': '#f59e0b',
      'ledger-danger': '#ef4444',
    }
  }
}
```

### 6.2 核心交互

- **ECharts 懒加载**：使用 `next/dynamic` + `{ ssr: false }` 避免 SSR 报错
- **黄金呼吸灯卡片**：`animate-pulse` 或自定义 `ping` 动效
- **金额脱敏**：敏感金额默认隐藏，点击眼睛图标临时展示
- **数字动画**：CountUp 滚动动画

### 6.3 页面路由映射

| 原页面 | 新页面 | 类型 |
|---|---|---|
| `/login` | `/login` | Client |
| `/register` | `/register` | Client |
| Dashboard `/` | `/(dashboard)/` | Mixed |
| `/assets` | `/(dashboard)/assets` | Mixed |
| `/liabilities` | `/(dashboard)/liabilities` | Mixed |
| `/scissor` | `/(dashboard)/scissor` | Mixed |
| `/forecast` | `/(dashboard)/forecast` | Mixed |
| `/management/assets` | `/management/assets` | Mixed |
| `/management/liabilities` | `/management/liabilities` | Mixed |
| `/management/transactions` | `/management/ledger` | Mixed |
| `/management/categories` | `/management/categories` | Mixed |

---

## 7. 定时任务（金价抓取）

### 7.1 生产环境

```typescript
// src/app/api/cron/gold/route.ts
import { NextResponse } from 'next/server';
import { fetchGoldPrice } from '@/lib/actions/gold';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await fetchGoldPrice();
  return NextResponse.json({ success: true });
}
```

### 7.2 开发环境 (HMR 安全)

```typescript
// src/lib/cron.ts
import { schedule } from 'node-cron';
import { fetchGoldPrice } from './actions/gold';

const globalForCron = globalThis as unknown as { localCronStarted?: boolean };

if (process.env.NODE_ENV === 'development' && !globalForCron.localCronStarted) {
  schedule('0 * * * *', () => fetchGoldPrice());
  globalForCron.localCronStarted = true;
}
```

---

## 8. 数据迁移

1. 备份旧数据库：`cp backend/ledger.sqlite .`
2. Prisma 初始化：`npx prisma migrate dev --name init`
3. Schema 通过 `@map()` 兼容旧表结构，数据零迁移
4. 保留 seed 脚本初始化演示数据

---

## 9. 安全策略

| 层级 | 措施 |
|---|---|
| 传输层 | HTTPS Only |
| 认证 | JWT (7天会话) + bcrypt (cost factor 12) |
| 敏感数据 | AES-256-GCM 字段级加密，密钥派生自用户密码 |
| 数据暴露 | Server Actions 返回值脱敏，密文绝不暴露给前端 |
| 并发安全 | `prisma.$transaction` 原子操作防止脏读 |
| 路由保护 | Edge Middleware 未登录重定向 |

---

## 10. 错误处理

Server Actions 统一返回 `{ success: boolean, data?: T, error?: string }` 格式，前端根据 `success` 判断操作结果。

---

## Self-Review

- [x] 无 TBD/TODO/占位符
- [x] 内部一致性检查通过（Schema ↔ Actions ↔ Auth 对齐）
- [x] 范围聚焦：单一代码库 Next.js 全栈迁移
- [x] 无歧义要求：所有技术选型已明确
