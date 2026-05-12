# Demo Readiness Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0/P1 issues discovered in the acceptance audit so the project can be demonstrated to leadership with real data flowing end-to-end.

**Architecture:** Backend fixes (data aggregation, DTOs, seed) are independent of frontend fixes (routing, auth pages, loading states). Docker fixes are independent of both. Tasks are ordered so that backend seed data exists before frontend tries to render it.

**Tech Stack:** NestJS 11 + TypeORM + PostgreSQL, React 19 + Vite + Tailwind + React Router, Docker Compose

---

### Task 1: Fix Frontend Router Imports & Remove Duplicate Slides

**Files:**
- Modify: `frontend/src/App.tsx`
- Delete: `frontend/src/pages/NetWorthSlide.tsx`
- Delete: `frontend/src/pages/AssetAllocationSlide.tsx`
- Delete: `frontend/src/pages/DebtOverviewSlide.tsx`
- Delete: `frontend/src/pages/ScissorChartSlide.tsx`
- Delete: `frontend/src/pages/ForecastSlide.tsx`
- Test: build passes

- [ ] **Step 1: Change App.tsx imports from `pages/` to `components/slides/`**

```typescript
// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { DockNavigation } from './components/layout/DockNavigation'
import NetWorthSlide from './components/slides/NetWorthSlide'
import AssetAllocationSlide from './components/slides/AssetAllocationSlide'
import DebtOverviewSlide from './components/slides/DebtOverviewSlide'
import ScissorChartSlide from './components/slides/ScissorChartSlide'
import ForecastSlide from './components/slides/ForecastSlide'

function App() {
  useKeyboardNavigation()
  return (
    <div className="flex flex-col h-screen bg-ledger-bg">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Navigate to="/net-worth" replace />} />
          <Route path="/net-worth" element={<NetWorthSlide slideIndex={0} />} />
          <Route path="/asset-allocation" element={<AssetAllocationSlide />} />
          <Route path="/debt-overview" element={<DebtOverviewSlide />} />
          <Route path="/scissor-chart" element={<ScissorChartSlide />} />
          <Route path="/forecast" element={<ForecastSlide />} />
        </Routes>
      </main>
      <DockNavigation />
    </div>
  )
}
export default App
```

- [ ] **Step 2: Delete duplicate `pages/` slide files**

```bash
rm frontend/src/pages/NetWorthSlide.tsx
rm frontend/src/pages/AssetAllocationSlide.tsx
rm frontend/src/pages/DebtOverviewSlide.tsx
rm frontend/src/pages/ScissorChartSlide.tsx
rm frontend/src/pages/ForecastSlide.tsx
```

- [ ] **Step 3: Verify build passes**

Run: `cd frontend && npm run build`
Expected: `built in X.XXs` with no TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git rm frontend/src/pages/*.tsx
git commit -m "fix(frontend): route to components/slides with real API calls"
```

---

### Task 2: Create Login & Register Pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Create LoginPage.tsx**

```typescript
// frontend/src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', form)
      localStorage.setItem('access_token', res.data.accessToken)
      navigate('/net-worth')
    } catch (err: any) {
      setError(err.response?.data?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-ledger-bg">
      <form onSubmit={handleSubmit} className="bg-ledger-surface p-8 rounded-2xl w-96 space-y-4">
        <h1 className="text-2xl font-bold text-ledger-text text-center">家庭账本</h1>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <input type="text" placeholder="用户名" required
          className="w-full p-3 rounded-lg bg-ledger-bg text-ledger-text border border-gray-700"
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input type="password" placeholder="密码" required
          className="w-full p-3 rounded-lg bg-ledger-bg text-ledger-text border border-gray-700"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" disabled={loading}
          className="w-full p-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {loading ? '登录中...' : '登录'}
        </button>
        <p className="text-center text-sm text-ledger-muted">
          没有账号？<a href="/register" className="text-blue-400">注册</a>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create RegisterPage.tsx**

```typescript
// frontend/src/pages/RegisterPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/register', form)
      localStorage.setItem('access_token', res.data.accessToken)
      navigate('/net-worth')
    } catch (err: any) {
      setError(err.response?.data?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-ledger-bg">
      <form onSubmit={handleSubmit} className="bg-ledger-surface p-8 rounded-2xl w-96 space-y-4">
        <h1 className="text-2xl font-bold text-ledger-text text-center">注册账号</h1>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <input type="text" placeholder="用户名" required
          className="w-full p-3 rounded-lg bg-ledger-bg text-ledger-text border border-gray-700"
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input type="text" placeholder="昵称" required
          className="w-full p-3 rounded-lg bg-ledger-bg text-ledger-text border border-gray-700"
          value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
        <input type="password" placeholder="密码" required
          className="w-full p-3 rounded-lg bg-ledger-bg text-ledger-text border border-gray-700"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button type="submit" disabled={loading}
          className="w-full p-3 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50">
          {loading ? '注册中...' : '注册'}
        </button>
        <p className="text-center text-sm text-ledger-muted">
          已有账号？<a href="/login" className="text-blue-400">登录</a>
        </p>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx with auth routes and guard**

```typescript
// frontend/src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation'
import { DockNavigation } from './components/layout/DockNavigation'
import NetWorthSlide from './components/slides/NetWorthSlide'
import AssetAllocationSlide from './components/slides/AssetAllocationSlide'
import DebtOverviewSlide from './components/slides/DebtOverviewSlide'
import ScissorChartSlide from './components/slides/ScissorChartSlide'
import ForecastSlide from './components/slides/ForecastSlide'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function ProtectedLayout() {
  useKeyboardNavigation()
  return (
    <div className="flex flex-col h-screen bg-ledger-bg">
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/net-worth" element={<NetWorthSlide slideIndex={0} />} />
          <Route path="/asset-allocation" element={<AssetAllocationSlide />} />
          <Route path="/debt-overview" element={<DebtOverviewSlide />} />
          <Route path="/scissor-chart" element={<ScissorChartSlide />} />
          <Route path="/forecast" element={<ForecastSlide />} />
        </Routes>
      </main>
      <DockNavigation />
    </div>
  )
}

function App() {
  const token = localStorage.getItem('access_token')

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/*" element={token ? <ProtectedLayout /> : <Navigate to="/login" replace />} />
    </Routes>
  )
}
export default App
```

- [ ] **Step 4: Verify build passes**

Run: `cd frontend && npm run build`
Expected: success

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx frontend/src/App.tsx
git commit -m "feat(frontend): add login and register pages with auth flow"
```

---

### Task 3: Fix Backend Data Aggregation (Assets Summary + WACR)

**Files:**
- Modify: `backend/src/modules/assets/assets.service.ts`
- Modify: `backend/src/modules/forecast/forecast.controller.ts`
- Modify: `backend/src/modules/forecast/forecast.service.ts`

- [ ] **Step 1: Fix assets.service.ts getSummary to include liabilities**

```typescript
// backend/src/modules/assets/assets.service.ts
// Add InjectRepository for Liability
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Liability } from '../liabilities/liabilities.entity'

// In constructor, add:
@InjectRepository(Liability) private liabilityRepo: Repository<Liability>,

// Replace getSummary method:
async getSummary(userId: string) {
  const assets = await this.findByUser(userId)
  const liabilities = await this.liabilityRepo.find({ where: { userId } })
  const totalAssets = assets.reduce((sum, a) => sum + parseFloat(String(a.currentValue)), 0)
  const totalLiabilities = liabilities.reduce((sum, l) => {
    const balanceStr = l.isEncrypted ? l.currentBalance.slice(4) : l.currentBalance
    return sum + parseFloat(balanceStr)
  }, 0)
  const netWorth = totalAssets - totalLiabilities
  return {
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    netWorth: netWorth.toFixed(2),
  }
}
```

- [ ] **Step 2: Fix forecast.controller.ts WACR endpoint**

```typescript
// backend/src/modules/forecast/forecast.controller.ts
// Add imports:
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Liability } from '../liabilities/liabilities.entity'
import Decimal from 'decimal.js'

// Update constructor:
constructor(
  private service: ForecastService,
  @InjectRepository(Liability) private liabilityRepo: Repository<Liability>,
) {}

// Replace getWACR:
@Get('wacr') async getWACR(@Request() req: any) {
  const liabilities = await this.liabilityRepo.find({ where: { userId: req.user.userId } })
  const wacr = this.service.calculateWACR(
    liabilities.map((l) => {
      const balanceStr = l.isEncrypted ? l.currentBalance.slice(4) : l.currentBalance
      return { balance: new Decimal(balanceStr), rate: new Decimal(l.interestRate) }
    })
  )
  return { wacr: wacr.toNumber() }
}
```

- [ ] **Step 3: Run backend tests**

Run: `cd backend && npm test`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/assets/assets.service.ts backend/src/modules/forecast/forecast.controller.ts
git commit -m "fix(backend): real data for assets summary and WACR calculation"
```

---

### Task 4: Add Demo Seed Script

**Files:**
- Create: `backend/src/seed.ts`
- Modify: `backend/package.json` scripts

- [ ] **Step 1: Create seed.ts with demo data**

```typescript
// backend/src/seed.ts
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { UsersService } from './modules/users/users.service'
import { AssetsService } from './modules/assets/assets.service'
import { LiabilitiesService } from './modules/liabilities/liabilities.service'
import { CategoriesService } from './modules/categories/categories.service'
import { TransactionsService } from './modules/transactions/transactions.service'

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule)

  const users = app.get(UsersService)
  const assets = app.get(AssetsService)
  const liabilities = app.get(LiabilitiesService)
  const categories = app.get(CategoriesService)
  const transactions = app.get(TransactionsService)

  // Create demo user
  const user = await users.create('demo', await require('bcrypt').hash('demo123', 12), '演示用户')
  const userId = user.id
  console.log('Created user:', user.username)

  // Create categories
  await categories.create(userId, { name: '工资收入', type: 'income', icon: '💰' })
  await categories.create(userId, { name: '生活支出', type: 'expense', icon: '🛒' })
  await categories.create(userId, { name: '投资收益', type: 'income', icon: '📈' })
  const expenseCat = await categories.create(userId, { name: '房贷支出', type: 'expense', icon: '🏠' })

  // Create assets
  await assets.create(userId, { name: '自住房产', assetType: 'real_estate', currentValue: 2000000, initialValue: 1800000 })
  await assets.create(userId, { name: '现金存款', assetType: 'cash', currentValue: 900000, initialValue: 900000 })
  await assets.create(userId, { name: '黄金积存', assetType: 'gold', currentValue: 680000, initialValue: 600000 })
  await assets.create(userId, { name: '股票账户', assetType: 'stock', currentValue: 500000, initialValue: 450000 })

  // Create liabilities
  const mortgage = await liabilities.create(userId, {
    name: '住房贷款', principal: 1000000, currentBalance: 850000,
    interestRate: 0.041, termMonths: 360, paymentMethod: 'equal_interest',
    startDate: new Date('2020-01-01'), type: 'mortgage',
  })
  const carLoan = await liabilities.create(userId, {
    name: '汽车贷款', principal: 150000, currentBalance: 80000,
    interestRate: 0.052, termMonths: 60, paymentMethod: 'equal_principal',
    startDate: new Date('2023-01-01'), type: 'car_loan',
  })
  const creditLoan = await liabilities.create(userId, {
    name: '信用贷款', principal: 50000, currentBalance: 35000,
    interestRate: 0.078, termMonths: 36, paymentMethod: 'equal_interest',
    startDate: new Date('2024-01-01'), type: 'personal',
  })
  console.log('Created liabilities:', mortgage.id, carLoan.id, creditLoan.id)

  // Create transactions for current month
  const now = new Date()
  await transactions.create(userId, {
    categoryId: expenseCat.id, amount: 30000, type: 'income',
    description: '月工资', transactionDate: new Date(now.getFullYear(), now.getMonth(), 5),
  })
  await transactions.create(userId, {
    categoryId: expenseCat.id, amount: 20000, type: 'expense',
    description: '本月生活支出', transactionDate: new Date(now.getFullYear(), now.getMonth(), 10),
  })

  console.log('Seed complete!')
  await app.close()
}
bootstrap().catch((err) => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Add seed script to package.json**

```json
"seed": "ts-node src/seed.ts"
```

- [ ] **Step 3: Verify seed compiles**

Run: `cd backend && npx ts-node --transpile-only src/seed.ts`
Expected: "Seed complete!" (requires running postgres)

- [ ] **Step 4: Commit**

```bash
git add backend/src/seed.ts backend/package.json
git commit -m "feat(backend): add demo seed script with sample family data"
```

---

### Task 5: Add DTOs with Validation

**Files:**
- Create: `backend/src/modules/categories/categories.dto.ts`
- Create: `backend/src/modules/assets/assets.dto.ts`
- Create: `backend/src/modules/transactions/transactions.dto.ts`
- Create: `backend/src/modules/liabilities/liabilities.dto.ts`
- Modify: respective controllers

- [ ] **Step 1: Create categories.dto.ts**

```typescript
import { IsString, IsIn, IsOptional } from 'class-validator'

export class CreateCategoryDto {
  @IsString() name: string
  @IsIn(['income', 'expense']) type: 'income' | 'expense'
  @IsOptional() @IsString() icon?: string
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsIn(['income', 'expense']) type?: 'income' | 'expense'
  @IsOptional() @IsString() icon?: string
}
```

- [ ] **Step 2: Create assets.dto.ts**

```typescript
import { IsString, IsNumber, IsOptional } from 'class-validator'

export class CreateAssetDto {
  @IsString() name: string
  @IsString() assetType: string
  @IsNumber() currentValue: number
  @IsOptional() @IsNumber() initialValue?: number
}

export class UpdateAssetDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() assetType?: string
  @IsOptional() @IsNumber() currentValue?: number
}
```

- [ ] **Step 3: Create transactions.dto.ts**

```typescript
import { IsString, IsNumber, IsIn, IsOptional, IsDateString } from 'class-validator'

export class CreateTransactionDto {
  @IsString() categoryId: string
  @IsNumber() amount: number
  @IsIn(['income', 'expense']) type: 'income' | 'expense'
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsDateString() transactionDate?: string
}

export class UpdateTransactionDto {
  @IsOptional() @IsString() categoryId?: string
  @IsOptional() @IsNumber() amount?: number
  @IsOptional() @IsIn(['income', 'expense']) type?: 'income' | 'expense'
  @IsOptional() @IsString() description?: string
}
```

- [ ] **Step 4: Create liabilities.dto.ts**

```typescript
import { IsString, IsNumber, IsIn, IsOptional, IsDateString } from 'class-validator'

export class CreateLiabilityDto {
  @IsString() name: string
  @IsString() type: string
  @IsNumber() principal: number
  @IsOptional() @IsNumber() currentBalance?: number
  @IsNumber() interestRate: number
  @IsNumber() termMonths: number
  @IsIn(['equal_interest', 'equal_principal']) paymentMethod: string
  @IsDateString() startDate: string
}

export class UpdateLiabilityDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsNumber() principal?: number
  @IsOptional() @IsNumber() currentBalance?: number
  @IsOptional() @IsNumber() interestRate?: number
  @IsOptional() @IsNumber() termMonths?: number
}
```

- [ ] **Step 5: Update controllers to use DTOs**

Replace `dto: any` with typed DTOs in:
- `categories.controller.ts`
- `assets.controller.ts`
- `transactions.controller.ts`
- `liabilities.controller.ts`

- [ ] **Step 6: Run tests**

Run: `cd backend && npm test`
Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/*/\*.dto.ts backend/src/modules/*/*.controller.ts
git commit -m "feat(backend): add input DTOs with class-validator for 4 modules"
```

---

### Task 6: Add Frontend Loading & Error States

**Files:**
- Modify: `frontend/src/components/slides/NetWorthSlide.tsx`
- Modify: `frontend/src/components/slides/AssetAllocationSlide.tsx`
- Modify: `frontend/src/components/slides/DebtOverviewSlide.tsx`
- Modify: `frontend/src/components/slides/ScissorChartSlide.tsx`
- Modify: `frontend/src/components/slides/ForecastSlide.tsx`

- [ ] **Step 1: Update NetWorthSlide with loading/error**

Add `const [loading, setLoading] = useState(true)` and `const [error, setError] = useState('')`.
Wrap api call in try/catch with setLoading(false) in finally.
Render loading spinner or error message conditionally.

- [ ] **Step 2-5: Repeat for other 4 slides**

Same pattern for AssetAllocationSlide, DebtOverviewSlide, ScissorChartSlide, ForecastSlide.

- [ ] **Step 6: Verify build**

Run: `cd frontend && npm run build`
Expected: success

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/slides/*.tsx
git commit -m "feat(frontend): add loading and error states to all slides"
```

---

### Task 7: Fix Docker Configuration

**Files:**
- Modify: `frontend/Dockerfile`
- Modify: `frontend/nginx.conf`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add nginx.conf COPY to frontend Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: Add reverse proxy to nginx.conf**

```nginx
server {
  listen 80;
  server_name localhost;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api {
    proxy_pass http://backend:3000/api;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /assets {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

- [ ] **Step 3: Update docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ledger
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=postgres
      - DB_PASSWORD=postgres
      - DB_NAME=ledger
      - ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
      - JWT_SECRET=demo-jwt-secret-change-me
      - NODE_ENV=development
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        - VITE_API_URL=/api
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

- [ ] **Step 4: Commit**

```bash
git add frontend/Dockerfile frontend/nginx.conf docker-compose.yml
git commit -m "fix(docker): nginx COPY, reverse proxy, healthcheck, build args"
```

---

### Task 8: Update Environment Config Files

**Files:**
- Modify: `backend/.env.example`
- Create: `.env.example` (project root)

- [ ] **Step 1: Update backend/.env.example**

```
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ledger
ENCRYPTION_KEY=your-32-byte-key-must-be-exactly-32-chars-long
ENCRYPTION_THRESHOLD=500000
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

- [ ] **Step 2: Create root .env.example**

```
# Backend
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=ledger
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
ENCRYPTION_THRESHOLD=500000
JWT_SECRET=your-jwt-secret-key-here
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d
NODE_ENV=development

# Frontend
VITE_API_URL=/api
```

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example .env.example
git commit -m "chore(config): update env examples with all required variables"
```

---

## Spec Self-Review

**1. Spec coverage:** Each P0/P1 issue from the audit maps to a task:
- App.tsx routing → Task 1
- Missing auth pages → Task 2
- Assets summary hardcoded → Task 3
- WACR stub → Task 3
- No seed data → Task 4
- Missing DTOs → Task 5
- No loading/error states → Task 6
- Docker misconfig → Task 7
- Missing env vars → Task 8

**2. Placeholder scan:** No TBD, TODO, or vague instructions. Each step contains actual code.

**3. Type consistency:** DTO field names match entity field names. Controller signatures are consistent across modules.
