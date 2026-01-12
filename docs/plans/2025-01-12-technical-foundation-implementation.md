# AthleticOS Technical Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a production-ready Fastify/React application with auth, multi-tenancy, and CRUD for core athletic entities.

**Architecture:** Fastify backend with Prisma ORM, JWT auth with role-based access, row-level multi-tenancy via school_id. React frontend with TanStack Query. Docker Compose for local dev, Render for prod.

**Tech Stack:** Node.js 20, Fastify, TypeScript, Prisma, Zod, Vitest, React 18, Vite, Tailwind, TanStack Query

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Backend Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.gitignore`

**Step 1: Create backend directory and package.json**

```bash
mkdir -p backend
cd backend
```

```json
// backend/package.json
{
  "name": "athleticos-api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@fastify/cors": "^9.0.1",
    "@fastify/jwt": "^8.0.0",
    "@fastify/swagger": "^8.14.0",
    "@fastify/swagger-ui": "^3.0.0",
    "@prisma/client": "^5.9.0",
    "bcryptjs": "^2.4.3",
    "fastify": "^4.26.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.11.0",
    "prisma": "^5.9.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Commit**

```bash
git add backend/
git commit -m "chore: initialize backend project structure"
```

---

### Task 2: Initialize Frontend Project

**Files:**
- Create: `frontend/` (via Vite scaffold)

**Step 1: Create frontend with Vite**

```bash
cd /Users/burke/projects/AthleticOS
npm create vite@latest frontend -- --template react-ts
```

**Step 2: Install additional dependencies**

```bash
cd frontend
npm install @tanstack/react-query react-router-dom axios
npm install -D tailwindcss postcss autoprefixer @types/react-router-dom
npx tailwindcss init -p
```

**Step 3: Configure Tailwind**

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Commit**

```bash
git add frontend/
git commit -m "chore: initialize frontend with Vite, React, Tailwind"
```

---

### Task 3: Create Docker Compose

**Files:**
- Create: `docker-compose.yml`

**Step 1: Write docker-compose.yml**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: athleticos
      POSTGRES_USER: athleticos
      POSTGRES_PASSWORD: athleticos
    ports:
      - "5434:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U athleticos"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://athleticos:athleticos@db:5432/athleticos
      JWT_SECRET: dev-secret-change-in-prod
      JWT_EXPIRES_IN: 15m
      JWT_REFRESH_EXPIRES_IN: 7d
      PORT: 8000
    ports:
      - "8003:8000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules
    command: npm run dev

  web:
    build: ./frontend
    environment:
      VITE_API_URL: http://localhost:8003
    ports:
      - "3005:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host

volumes:
  postgres_data:
```

**Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose for local development"
```

---

### Task 4: Create Backend Dockerfile

**Files:**
- Create: `backend/Dockerfile`

**Step 1: Write Dockerfile**

```dockerfile
# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 8000

CMD ["npm", "run", "dev"]
```

**Step 2: Commit**

```bash
git add backend/Dockerfile
git commit -m "chore: add backend Dockerfile"
```

---

### Task 5: Create Frontend Dockerfile

**Files:**
- Create: `frontend/Dockerfile`

**Step 1: Write Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
```

**Step 2: Commit**

```bash
git add frontend/Dockerfile
git commit -m "chore: add frontend Dockerfile"
```

---

## Phase 2: Database Schema

### Task 6: Create Prisma Schema

**Files:**
- Create: `backend/prisma/schema.prisma`

**Step 1: Write Prisma schema**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============ Auth & Users ============

model User {
  id           String       @id @default(cuid())
  email        String       @unique
  passwordHash String       @map("password_hash")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  schoolUsers  SchoolUser[]

  @@map("users")
}

model SchoolUser {
  id        String   @id @default(cuid())
  schoolId  String   @map("school_id")
  userId    String   @map("user_id")
  role      Role     @default(VIEWER)
  createdAt DateTime @default(now()) @map("created_at")

  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([schoolId, userId])
  @@map("school_users")
}

enum Role {
  ADMIN
  COACH
  VIEWER
}

// ============ Core Entities ============

model School {
  id        String   @id @default(cuid())
  name      String
  timezone  String   @default("America/New_York")
  settings  Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  schoolUsers SchoolUser[]
  teams       Team[]
  facilities  Facility[]

  @@map("schools")
}

model Team {
  id        String   @id @default(cuid())
  schoolId  String   @map("school_id")
  name      String
  sport     String
  level     TeamLevel @default(VARSITY)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  seasons   Season[]

  @@index([schoolId])
  @@map("teams")
}

enum TeamLevel {
  VARSITY
  JV
  FRESHMAN
}

model Season {
  id        String   @id @default(cuid())
  teamId    String   @map("team_id")
  name      String
  year      Int
  startDate DateTime @map("start_date")
  endDate   DateTime @map("end_date")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  games     Game[]
  practices Practice[]

  @@index([teamId])
  @@map("seasons")
}

model Facility {
  id        String       @id @default(cuid())
  schoolId  String       @map("school_id")
  name      String
  type      FacilityType @default(GYM)
  capacity  Int?
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  school    School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  timeSlots TimeSlot[]
  games     Game[]
  practices Practice[]

  @@index([schoolId])
  @@map("facilities")
}

enum FacilityType {
  GYM
  FIELD
  POOL
  COURT
  TRACK
  OTHER
}

model TimeSlot {
  id         String   @id @default(cuid())
  facilityId String   @map("facility_id")
  dayOfWeek  Int      @map("day_of_week") // 0=Sunday, 6=Saturday
  startTime  String   @map("start_time") // HH:MM format
  endTime    String   @map("end_time")   // HH:MM format
  createdAt  DateTime @default(now()) @map("created_at")

  facility   Facility @relation(fields: [facilityId], references: [id], onDelete: Cascade)

  @@index([facilityId])
  @@map("time_slots")
}

model Game {
  id         String     @id @default(cuid())
  seasonId   String     @map("season_id")
  facilityId String?    @map("facility_id")
  opponent   String
  datetime   DateTime
  homeAway   HomeAway   @default(HOME) @map("home_away")
  status     GameStatus @default(SCHEDULED)
  notes      String?
  createdAt  DateTime   @default(now()) @map("created_at")
  updatedAt  DateTime   @updatedAt @map("updated_at")

  season     Season     @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  facility   Facility?  @relation(fields: [facilityId], references: [id], onDelete: SetNull)

  @@index([seasonId])
  @@index([datetime])
  @@map("games")
}

enum HomeAway {
  HOME
  AWAY
  NEUTRAL
}

enum GameStatus {
  SCHEDULED
  CONFIRMED
  CANCELLED
  POSTPONED
  COMPLETED
}

model Practice {
  id              String    @id @default(cuid())
  seasonId        String    @map("season_id")
  facilityId      String?   @map("facility_id")
  datetime        DateTime
  durationMinutes Int       @default(90) @map("duration_minutes")
  notes           String?
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  season          Season    @relation(fields: [seasonId], references: [id], onDelete: Cascade)
  facility        Facility? @relation(fields: [facilityId], references: [id], onDelete: SetNull)

  @@index([seasonId])
  @@index([datetime])
  @@map("practices")
}
```

**Step 2: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add Prisma schema with all core entities"
```

---

## Phase 3: Backend Core

### Task 7: Create Server Entry Point

**Files:**
- Create: `backend/src/server.ts`
- Create: `backend/src/config.ts`

**Step 1: Create config**

```typescript
// backend/src/config.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const config = envSchema.parse(process.env);
```

**Step 2: Create server**

```typescript
// backend/src/server.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(swagger, {
  openapi: {
    info: {
      title: 'AthleticOS API',
      version: '0.1.0'
    }
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Start
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${config.PORT}`);
    console.log(`API docs at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 3: Commit**

```bash
git add backend/src/
git commit -m "feat: add Fastify server with config and health check"
```

---

### Task 8: Create Prisma Client Singleton

**Files:**
- Create: `backend/src/common/db.ts`

**Step 1: Write db client**

```typescript
// backend/src/common/db.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Step 2: Commit**

```bash
git add backend/src/common/
git commit -m "feat: add Prisma client singleton"
```

---

### Task 9: Create Error Handling

**Files:**
- Create: `backend/src/common/errors.ts`

**Step 1: Write error classes**

```typescript
// backend/src/common/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/common/errors.ts
git commit -m "feat: add custom error classes"
```

---

### Task 10: Create Auth Module - Schemas

**Files:**
- Create: `backend/src/modules/auth/schemas.ts`

**Step 1: Write Zod schemas**

```typescript
// backend/src/modules/auth/schemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
```

**Step 2: Commit**

```bash
mkdir -p backend/src/modules/auth
git add backend/src/modules/auth/
git commit -m "feat: add auth Zod schemas"
```

---

### Task 11: Create Auth Module - Service

**Files:**
- Create: `backend/src/modules/auth/service.ts`

**Step 1: Write auth service**

```typescript
// backend/src/modules/auth/service.ts
import bcrypt from 'bcryptjs';
import { prisma } from '../../common/db.js';
import { UnauthorizedError, ValidationError } from '../../common/errors.js';
import type { RegisterInput, LoginInput } from './schemas.js';

export const authService = {
  async register(input: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
      },
      select: { id: true, email: true, createdAt: true },
    });

    return user;
  },

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return { id: user.id, email: user.email };
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        schoolUsers: {
          select: {
            role: true,
            school: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      schools: user.schoolUsers.map(su => ({
        id: su.school.id,
        name: su.school.name,
        role: su.role,
      })),
    };
  },
};
```

**Step 2: Commit**

```bash
git add backend/src/modules/auth/service.ts
git commit -m "feat: add auth service with register, login, profile"
```

---

### Task 12: Create Auth Module - Routes

**Files:**
- Create: `backend/src/modules/auth/routes.ts`

**Step 1: Write auth routes**

```typescript
// backend/src/modules/auth/routes.ts
import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema } from './schemas.js';
import { authService } from './service.js';
import { config } from '../../config.js';

export async function authRoutes(app: FastifyInstance) {
  // Register
  app.post('/auth/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);

    const accessToken = app.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return reply.status(201).send({
      data: { user, accessToken, refreshToken },
    });
  });

  // Login
  app.post('/auth/login', async (request, reply) => {
    const input = loginSchema.parse(request.body);
    const user = await authService.login(input);

    const accessToken = app.jwt.sign(
      { userId: user.id },
      { expiresIn: config.JWT_EXPIRES_IN }
    );
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
    );

    return { data: { user, accessToken, refreshToken } };
  });

  // Refresh
  app.post('/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    try {
      const decoded = app.jwt.verify<{ userId: string; type: string }>(refreshToken);
      if (decoded.type !== 'refresh') {
        return reply.status(401).send({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
      }

      const accessToken = app.jwt.sign(
        { userId: decoded.userId },
        { expiresIn: config.JWT_EXPIRES_IN }
      );
      const newRefreshToken = app.jwt.sign(
        { userId: decoded.userId, type: 'refresh' },
        { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
      );

      return { data: { accessToken, refreshToken: newRefreshToken } };
    } catch {
      return reply.status(401).send({ error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
    }
  });

  // Me (protected)
  app.get('/auth/me', {
    preHandler: [async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
      }
    }],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const profile = await authService.getProfile(userId);
    return { data: profile };
  });
}
```

**Step 2: Commit**

```bash
git add backend/src/modules/auth/routes.ts
git commit -m "feat: add auth routes (register, login, refresh, me)"
```

---

### Task 13: Create Auth Middleware

**Files:**
- Create: `backend/src/common/middleware/auth.ts`

**Step 1: Write auth middleware**

```typescript
// backend/src/common/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import { ForbiddenError } from '../errors.js';
import { Role } from '@prisma/client';

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
  }
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const schoolId = (request.params as { schoolId?: string }).schoolId;
    if (!schoolId) return;

    const { userId } = request.user as { userId: string };

    const schoolUser = await prisma.schoolUser.findUnique({
      where: { schoolId_userId: { schoolId, userId } },
    });

    if (!schoolUser || !roles.includes(schoolUser.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    // Attach to request for downstream use
    (request as any).schoolUser = schoolUser;
  };
}
```

**Step 2: Commit**

```bash
mkdir -p backend/src/common/middleware
git add backend/src/common/middleware/
git commit -m "feat: add auth and role middleware"
```

---

### Task 14: Create Schools Module

**Files:**
- Create: `backend/src/modules/schools/schemas.ts`
- Create: `backend/src/modules/schools/service.ts`
- Create: `backend/src/modules/schools/routes.ts`

**Step 1: Write schemas**

```typescript
// backend/src/modules/schools/schemas.ts
import { z } from 'zod';

export const createSchoolSchema = z.object({
  name: z.string().min(1).max(255),
  timezone: z.string().default('America/New_York'),
  settings: z.record(z.unknown()).optional(),
});

export const updateSchoolSchema = createSchoolSchema.partial();

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;
export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;
```

**Step 2: Write service**

```typescript
// backend/src/modules/schools/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateSchoolInput, UpdateSchoolInput } from './schemas.js';

export const schoolsService = {
  async create(input: CreateSchoolInput, userId: string) {
    const school = await prisma.school.create({
      data: {
        ...input,
        schoolUsers: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });
    return school;
  },

  async findAll(userId: string) {
    const schools = await prisma.school.findMany({
      where: { schoolUsers: { some: { userId } } },
      orderBy: { name: 'asc' },
    });
    return schools;
  },

  async findById(id: string, userId: string) {
    const school = await prisma.school.findFirst({
      where: { id, schoolUsers: { some: { userId } } },
    });
    if (!school) throw new NotFoundError('School', id);
    return school;
  },

  async update(id: string, input: UpdateSchoolInput, userId: string) {
    await this.findById(id, userId); // Check access
    const school = await prisma.school.update({
      where: { id },
      data: input,
    });
    return school;
  },

  async delete(id: string, userId: string) {
    await this.findById(id, userId); // Check access
    await prisma.school.delete({ where: { id } });
  },
};
```

**Step 3: Write routes**

```typescript
// backend/src/modules/schools/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { createSchoolSchema, updateSchoolSchema } from './schemas.js';
import { schoolsService } from './service.js';

export async function schoolsRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authenticate);

  // List schools for current user
  app.get('/schools', async (request) => {
    const { userId } = request.user as { userId: string };
    const schools = await schoolsService.findAll(userId);
    return { data: schools };
  });

  // Create school
  app.post('/schools', async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const input = createSchoolSchema.parse(request.body);
    const school = await schoolsService.create(input, userId);
    return reply.status(201).send({ data: school });
  });

  // Get school by ID
  app.get('/schools/:id', async (request) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const school = await schoolsService.findById(id, userId);
    return { data: school };
  });

  // Update school
  app.patch('/schools/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const input = updateSchoolSchema.parse(request.body);
    const school = await schoolsService.update(id, input, userId);
    return { data: school };
  });

  // Delete school
  app.delete('/schools/:id', {
    preHandler: [requireRole('ADMIN')],
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    await schoolsService.delete(id, userId);
    return reply.status(204).send();
  });
}
```

**Step 4: Commit**

```bash
mkdir -p backend/src/modules/schools
git add backend/src/modules/schools/
git commit -m "feat: add schools module (CRUD)"
```

---

### Task 15: Create Teams Module

**Files:**
- Create: `backend/src/modules/teams/schemas.ts`
- Create: `backend/src/modules/teams/service.ts`
- Create: `backend/src/modules/teams/routes.ts`

**Step 1: Write schemas**

```typescript
// backend/src/modules/teams/schemas.ts
import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  sport: z.string().min(1).max(100),
  level: z.enum(['VARSITY', 'JV', 'FRESHMAN']).default('VARSITY'),
});

export const updateTeamSchema = createTeamSchema.partial();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
```

**Step 2: Write service**

```typescript
// backend/src/modules/teams/service.ts
import { prisma } from '../../common/db.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateTeamInput, UpdateTeamInput } from './schemas.js';

export const teamsService = {
  async create(schoolId: string, input: CreateTeamInput) {
    const team = await prisma.team.create({
      data: { ...input, schoolId },
    });
    return team;
  },

  async findBySchool(schoolId: string) {
    const teams = await prisma.team.findMany({
      where: { schoolId },
      orderBy: [{ sport: 'asc' }, { level: 'asc' }, { name: 'asc' }],
    });
    return teams;
  },

  async findById(id: string) {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) throw new NotFoundError('Team', id);
    return team;
  },

  async update(id: string, input: UpdateTeamInput) {
    await this.findById(id);
    const team = await prisma.team.update({ where: { id }, data: input });
    return team;
  },

  async delete(id: string) {
    await this.findById(id);
    await prisma.team.delete({ where: { id } });
  },
};
```

**Step 3: Write routes**

```typescript
// backend/src/modules/teams/routes.ts
import type { FastifyInstance } from 'fastify';
import { authenticate, requireRole } from '../../common/middleware/auth.js';
import { createTeamSchema, updateTeamSchema } from './schemas.js';
import { teamsService } from './service.js';

export async function teamsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // List teams for school
  app.get('/schools/:schoolId/teams', async (request) => {
    const { schoolId } = request.params as { schoolId: string };
    const teams = await teamsService.findBySchool(schoolId);
    return { data: teams };
  });

  // Create team
  app.post('/schools/:schoolId/teams', {
    preHandler: [requireRole('ADMIN', 'COACH')],
  }, async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const input = createTeamSchema.parse(request.body);
    const team = await teamsService.create(schoolId, input);
    return reply.status(201).send({ data: team });
  });

  // Get team by ID
  app.get('/teams/:id', async (request) => {
    const { id } = request.params as { id: string };
    const team = await teamsService.findById(id);
    return { data: team };
  });

  // Update team
  app.patch('/teams/:id', async (request) => {
    const { id } = request.params as { id: string };
    const input = updateTeamSchema.parse(request.body);
    const team = await teamsService.update(id, input);
    return { data: team };
  });

  // Delete team
  app.delete('/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await teamsService.delete(id);
    return reply.status(204).send();
  });
}
```

**Step 4: Commit**

```bash
mkdir -p backend/src/modules/teams
git add backend/src/modules/teams/
git commit -m "feat: add teams module (CRUD)"
```

---

### Task 16: Create Remaining Entity Modules

**Files:**
- Create: `backend/src/modules/seasons/` (schemas, service, routes)
- Create: `backend/src/modules/facilities/` (schemas, service, routes)
- Create: `backend/src/modules/games/` (schemas, service, routes)
- Create: `backend/src/modules/practices/` (schemas, service, routes)

Follow the same pattern as Teams. Each module has:
- `schemas.ts` - Zod validation
- `service.ts` - Business logic with Prisma
- `routes.ts` - Fastify routes

**Commit after each module:**

```bash
git commit -m "feat: add seasons module (CRUD)"
git commit -m "feat: add facilities module (CRUD)"
git commit -m "feat: add games module (CRUD)"
git commit -m "feat: add practices module (CRUD)"
```

---

### Task 17: Wire Up All Routes in Server

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Import and register all routes**

```typescript
// backend/src/server.ts (updated)
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { authRoutes } from './modules/auth/routes.js';
import { schoolsRoutes } from './modules/schools/routes.js';
import { teamsRoutes } from './modules/teams/routes.js';
import { seasonsRoutes } from './modules/seasons/routes.js';
import { facilitiesRoutes } from './modules/facilities/routes.js';
import { gamesRoutes } from './modules/games/routes.js';
import { practicesRoutes } from './modules/practices/routes.js';
import { AppError } from './common/errors.js';
import { ZodError } from 'zod';

const app = Fastify({
  logger: {
    level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: config.NODE_ENV !== 'production' ? {
      target: 'pino-pretty',
      options: { colorize: true }
    } : undefined
  }
});

// Error handler
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details }
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: error.flatten() }
    });
  }
  app.log.error(error);
  return reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error' }
  });
});

// Plugins
await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.JWT_SECRET });
await app.register(swagger, {
  openapi: { info: { title: 'AthleticOS API', version: '0.1.0' } }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

// Health check
app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// API routes
await app.register(async (api) => {
  await api.register(authRoutes);
  await api.register(schoolsRoutes);
  await api.register(teamsRoutes);
  await api.register(seasonsRoutes);
  await api.register(facilitiesRoutes);
  await api.register(gamesRoutes);
  await api.register(practicesRoutes);
}, { prefix: '/api/v1' });

// Start
const start = async () => {
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    console.log(`Server running at http://localhost:${config.PORT}`);
    console.log(`API docs at http://localhost:${config.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

**Step 2: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: wire up all routes with error handling"
```

---

## Phase 4: Frontend Shell

### Task 18: Set Up API Client

**Files:**
- Create: `frontend/src/api/client.ts`

**Step 1: Write API client**

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8003';

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api.request(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
```

**Step 2: Commit**

```bash
mkdir -p frontend/src/api
git add frontend/src/api/
git commit -m "feat: add API client with auth interceptors"
```

---

### Task 19: Create Auth Context

**Files:**
- Create: `frontend/src/hooks/useAuth.tsx`

**Step 1: Write auth hook**

```typescript
// frontend/src/hooks/useAuth.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api/client';

interface User {
  id: string;
  email: string;
  schools: { id: string; name: string; role: string }[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => setUser(data.data))
        .catch(() => {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
  };

  const register = async (email: string, password: string) => {
    const { data } = await api.post('/auth/register', { email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

**Step 2: Commit**

```bash
mkdir -p frontend/src/hooks
git add frontend/src/hooks/
git commit -m "feat: add auth context and useAuth hook"
```

---

### Task 20: Create Login Page

**Files:**
- Create: `frontend/src/pages/Login.tsx`

**Step 1: Write login page**

```typescript
// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">AthleticOS</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-100 text-red-700 rounded">{error}</div>}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account? <Link to="/register" className="text-blue-600">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
mkdir -p frontend/src/pages
git add frontend/src/pages/Login.tsx
git commit -m "feat: add login page"
```

---

### Task 21: Create Dashboard Page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

**Step 1: Write dashboard**

```typescript
// frontend/src/pages/Dashboard.tsx
import { useAuth } from '../hooks/useAuth';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">AthleticOS</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={logout} className="text-red-600 hover:underline">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
        {user?.schools.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-600 mb-4">You don't have any schools yet.</p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              Create School
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {user?.schools.map((school) => (
              <div key={school.id} className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-semibold text-lg">{school.name}</h3>
                <p className="text-sm text-gray-500 capitalize">{school.role.toLowerCase()}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add dashboard page with school cards"
```

---

### Task 22: Wire Up App Router

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Set up routing**

```typescript
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add router with protected routes"
```

---

## Phase 5: Project Configuration

### Task 23: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

**Step 1: Write project instructions**

```markdown
# AthleticOS - Claude Code Instructions

> Unified athletic operations platform for schools
> Last Updated: 2025-01-12

## Quick Start

```bash
docker compose up
```

- API: http://localhost:8003
- Frontend: http://localhost:3005
- API Docs: http://localhost:8003/docs

## Technology Stack

| Layer | Technology |
|-------|------------|
| Backend | Fastify + TypeScript, Prisma, Zod, Vitest |
| Frontend | React 18 + Vite, Tailwind, TanStack Query |
| Database | PostgreSQL 16 (Render - existing instance) |
| Infrastructure | Docker Compose (local), Render (prod) |

## Port Allocation

| Service | Internal | External |
|---------|----------|----------|
| Database | 5432 | 5434 |
| API | 8000 | 8003 |
| Frontend | 3000 | 3005 |

## Database

Uses existing Render PostgreSQL instance with new `athleticos` database.

```bash
# Local: Run migrations
cd backend && npm run db:migrate

# Generate Prisma client
npm run db:generate
```

## API Conventions

- All routes prefixed with `/api/v1`
- JWT auth via `Authorization: Bearer <token>`
- Response format: `{ data: {...} }` or `{ error: { code, message } }`
- Multi-tenancy: `school_id` on tenant-scoped tables

## Module Structure

```
backend/src/modules/<name>/
├── schemas.ts   # Zod validation
├── service.ts   # Business logic
└── routes.ts    # Fastify routes
```

## Commands

```bash
# Backend
cd backend
npm run dev          # Start dev server
npm run test         # Run tests
npm run db:migrate   # Run migrations

# Frontend
cd frontend
npm run dev          # Start dev server
npm run build        # Production build
```
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add project CLAUDE.md"
```

---

### Task 24: Create render.yaml

**Files:**
- Create: `render.yaml`

**Step 1: Write Render blueprint**

```yaml
# render.yaml
services:
  - type: web
    name: athleticos-api
    runtime: docker
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: athleticos-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 15m
      - key: JWT_REFRESH_EXPIRES_IN
        value: 7d
      - key: NODE_ENV
        value: production
    healthCheckPath: /health

  - type: web
    name: athleticos-web
    runtime: static
    buildCommand: cd frontend && npm ci && npm run build
    staticPublishPath: ./frontend/dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    envVars:
      - key: VITE_API_URL
        value: https://athleticos-api.onrender.com

databases:
  - name: athleticos-db
    plan: free
```

**Step 2: Commit**

```bash
git add render.yaml
git commit -m "chore: add render.yaml deployment blueprint"
```

---

### Task 25: Install Dependencies and Verify

**Step 1: Install backend dependencies**

```bash
cd backend && npm install
```

**Step 2: Install frontend dependencies**

```bash
cd frontend && npm install
```

**Step 3: Generate Prisma client**

```bash
cd backend && npx prisma generate
```

**Step 4: Start with Docker Compose**

```bash
docker compose up --build
```

**Step 5: Verify health endpoint**

```bash
curl http://localhost:8003/health
# Expected: {"status":"ok","timestamp":"..."}
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify setup and add lock files"
```

---

## Success Criteria Checklist

- [ ] `docker compose up` starts all services
- [ ] Health check returns 200 at `/health`
- [ ] Can register user via `POST /api/v1/auth/register`
- [ ] Can login via `POST /api/v1/auth/login`
- [ ] Can create school via `POST /api/v1/schools`
- [ ] Can create team via `POST /api/v1/schools/:id/teams`
- [ ] Frontend shows login page at http://localhost:3005
- [ ] Can login and see dashboard
- [ ] API docs available at http://localhost:8003/docs
