# Collaborative Real-Time Workflow & Kanban Suite

> A production-grade, multi-tenant project management and dynamic workflow automation engine built with **React 19, Next.js (App Router), shadcn/ui, Node.js, Socket.io, PostgreSQL, Prisma, and BullMQ**.

---

## Project Overview

The **Collaborative Real-Time Workflow & Kanban Suite** is a full-stack, enterprise-ready developer and workspace utility platform. It combines real-time multi-user collaboration (live cursors, active board presence, optimistic updates) with a high-performance Kanban board, an interactive data grid view, custom metadata field builders, and a visual workflow automation engine (node canvas).

Designed for teams requiring high-concurrency event processing, multi-tenant workspace isolation, and zero-downtime drag-and-drop state updates, this project demonstrates advanced frontend state management, real-time networking protocols, fractional indexing algorithms (Lexorank), and asynchronous job queue processing.

---

## Key Features

### Multi-Tenant Workspaces & RBAC

- **Workspace Isolation:** Dynamic workspace switching with decoupled resources, boards, custom fields, and member management.
- **Granular RBAC:** Role-Based Access Control enforcing permissions across `Owner`, `Admin`, `Member`, and `Viewer` tiers.
- **Audit Logging:** Immutable workspace-wide event stream tracking user mutations, role changes, and card movements.

### Advanced Drag-and-Drop Kanban Board

- **Optimistic Drag-and-Drop:** Smooth column reordering and cross-column card relocation powered by `@dnd-kit/core` and `@dnd-kit/sortable`.
- **Lexorank Positioning:** Fractional string indexing (`0|i00001:`) preventing database re-indexing overhead on single card insertions/moves.
- **Rollback Resilience:** Automatic client-side optimistic UI rollback using TanStack Query when backend socket or REST persistence encounters errors.

### Dynamic Data Table & Grid Views

- **Multi-View Toggle:** Seamlessly switch between visual Kanban board view and detailed spreadsheet-style table view.
- **TanStack Table Engine:** Column visibility toggles, multi-column sorting, multi-facet tag/assignee filtering, dynamic pagination, and CSV export.
- **Inline Cell Editing:** Edit card titles, assignees, due dates, priority tags, and custom fields directly from table cells.

### Real-Time Collaboration & Active Presence

- **Room Subscriptions:** Dedicated WebSocket room routing segmented by `workspaceId` and `boardId`.
- **Live Presence & Cursors:** Real-time user avatars indicating online workspace members and live card focus locks.
- **Field-Level Edit Locks:** Visual cues highlighting fields currently being modified by concurrent team members to prevent race conditions.
- **Distributed Pub/Sub:** Redis-backed Socket.io adapter enabling horizontal scaling across multiple Node.js backend instances.

### Custom Metadata & Card Detail Sheets

- **Flexible Schemas:** Dynamic custom field generator supporting Text, Number, Select Dropdowns, Multi-Select Chips, Dates, Checklists, and User References.
- **Rich Card Modals:** Slide-over `Sheet` / `Dialog` UI featuring activity comment threads, attachment uploads, checklist progress bars, and metadata inspection.

### Visual Automation Engine (Node Canvas)

- **Node-Based Canvas:** Visual trigger/action builder powered by **React Flow**.
- **Rule Construction:** Create dynamic rules (e.g., *Trigger: Card moved to "In Review"* → *Action: Reassign to QA Lead + Send Webhook Notification*).
- **Asynchronous Queue Engine:** Event-driven rule evaluation using **BullMQ** and **Redis** to execute background triggers without blocking user interaction threads.

### Universal Command Palette & Accessibility

- **Command Palette (`cmdk` / shadcn Command):** Universal `Cmd+K` keyboard shortcut interface for searching boards, jumping to cards, switching workspaces, or running bulk actions.
- **Full Keyboard Navigation:** Accessible ARIA attributes and focus management across modals, drag handles, and table grids.

---

## System Architecture

```
                               ┌─────────────────────────────────────────┐
                               │       React 19 + shadcn/ui App          │
                               │    (Next.js App Router / Tailwind)      │
                               └────────────────────┬────────────────────┘
                                                    │
                             ┌──────────────────────┴──────────────────────┐
                             │                                             │
                       HTTP / REST API                               WebSockets / WSS
                             │                                             │
                             ▼                                             ▼
               ┌───────────────────────────┐                 ┌───────────────────────────┐
               │   Node.js API Service     │                 │    Real-Time WS Server    │
               │   (Express / Fastify)     │                 │   (Socket.io Gateway)     │
               └─────────────┬─────────────┘                 └─────────────┬─────────────┘
                             │                                             │
                             ├──────────────────────┬──────────────────────┤
                             ▼                      ▼                      ▼
                   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
                   │ PostgreSQL (Data) │  │  Redis (Pub/Sub)  │  │  BullMQ (Queue)   │
                   └───────────────────┘  └───────────────────┘  └───────────────────┘
```

---

## Tech Stack

### Frontend

- **Framework:** React 19 + Next.js (App Router)
- **UI & Styling:** shadcn/ui, Radix UI Primitives, Tailwind CSS, Lucide React
- **Drag & Drop:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Data Grid & Charts:** TanStack Table (v8), Recharts
- **Node Canvas:** React Flow
- **State & Data Fetching:** TanStack Query (React Query v5), Zustand
- **Forms & Validation:** React Hook Form, Zod
- **Command Palette:** `cmdk`

### Backend & Real-Time

- **Runtime:** Node.js (v20+)
- **API Framework:** Fastify or Express
- **Real-Time Layer:** Socket.io (with `@socket.io/redis-adapter`)
- **Job Processing:** BullMQ
- **ORM & Database:** Prisma ORM, PostgreSQL (v15+)
- **In-Memory Cache & Pub/Sub:** Redis (v7+)
- **Lexical Ranks:** Lexorank / custom fractional indexing utilities

---

## Database Schema Overview

The core PostgreSQL schema managed by Prisma includes the following entity structures:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum CustomFieldType {
  TEXT
  NUMBER
  SELECT
  MULTI_SELECT
  DATE
  CHECKBOX
  USER
}

model User {
  id            String            @id @default(cuid())
  email         String            @unique
  name          String
  avatarUrl     String?
  memberships   WorkspaceMember[]
  assignedCards Card[]            @relation("AssignedUser")
  comments      Comment[]
  createdCards  Card[]            @relation("CreatedUser")
  attachments   Attachment[]
  activityLogs  ActivityLog[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}

model Workspace {
  id          String            @id @default(cuid())
  name        String
  slug        String            @unique
  members     WorkspaceMember[]
  boards      Board[]
  automations AutomationRule[]
  customFields CustomField[]
  tags        Tag[]
  logs        ActivityLog[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

model WorkspaceMember {
  id          String    @id @default(cuid())
  role        Role      @default(MEMBER)
  userId      String
  workspaceId String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
}

model Board {
  id          String    @id @default(cuid())
  title       String
  position    String    // Lexorank
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  columns     Column[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Column {
  id        String   @id @default(cuid())
  title     String
  position  String   // Lexorank
  boardId   String
  board     Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  cards     Card[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Card {
  id            String            @id @default(cuid())
  title         String
  description   String?
  position      String            // Lexorank
  priority      Priority          @default(MEDIUM)
  dueDate       DateTime?
  columnId      String
  column        Column            @relation(fields: [columnId], references: [id], onDelete: Cascade)
  assigneeId    String?
  assignee      User?             @relation("AssignedUser", fields: [assigneeId], references: [id])
  creatorId     String
  creator       User              @relation("CreatedUser", fields: [creatorId], references: [id])
  comments      Comment[]
  fieldValues   CustomFieldValue[]
  checklists    Checklist[]
  attachments   Attachment[]
  tags          TagOnCard[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
}

model CustomField {
  id          String             @id @default(cuid())
  name        String
  fieldType   CustomFieldType
  options     String[]           // For SELECT / MULTI_SELECT types
  workspaceId String
  workspace   Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  values      CustomFieldValue[]
}

model CustomFieldValue {
  id            String      @id @default(cuid())
  value         Json        // Shape depends on fieldType (e.g., string[] for MULTI_SELECT)
  cardId        String
  card          Card        @relation(fields: [cardId], references: [id], onDelete: Cascade)
  customFieldId String
  customField   CustomField @relation(fields: [customFieldId], references: [id], onDelete: Cascade)

  @@unique([cardId, customFieldId])
}

model AutomationRule {
  id          String    @id @default(cuid())
  name        String
  triggerType String    // e.g., CARD_MOVED, CARD_CREATED, DUE_DATE_APPROACHING
  triggerConfig Json
  actionType  String    // e.g., REASSIGN, SEND_WEBHOOK, CHANGE_PRIORITY
  actionConfig  Json
  isActive    Boolean   @default(true)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model Checklist {
  id        String          @id @default(cuid())
  title     String
  cardId    String
  card      Card            @relation(fields: [cardId], references: [id], onDelete: Cascade)
  items     ChecklistItem[]
}

model ChecklistItem {
  id          String    @id @default(cuid())
  content     String
  isCompleted Boolean   @default(false)
  checklistId String
  checklist   Checklist @relation(fields: [checklistId], references: [id], onDelete: Cascade)
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  cardId    String
  card      Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Attachment {
  id         String   @id @default(cuid())
  fileName   String
  fileUrl    String
  mimeType   String
  sizeBytes  Int
  cardId     String
  card       Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  uploaderId String
  uploader   User     @relation(fields: [uploaderId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
}

model Tag {
  id          String      @id @default(cuid())
  name        String
  color       String
  workspaceId String
  workspace   Workspace   @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  cards       TagOnCard[]

  @@unique([workspaceId, name])
}

model TagOnCard {
  cardId String
  tagId  String
  card   Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([cardId, tagId])
}

model ActivityLog {
  id          String    @id @default(cuid())
  action      String
  entityType  String
  entityId    String
  details     Json?
  actorId     String?   // Null when the user is deleted or the action is system-generated
  actor       User?     @relation(fields: [actorId], references: [id], onDelete: SetNull)
  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())

  @@index([workspaceId, createdAt])
}
```

---

## WebSocket Protocol Specifications

All real-time communication flows over Socket.io namespaces and rooms.

### Event Channels & Actions

| Event Name | Direction | Payload | Description |
| --- | --- | --- | --- |
| `room:join` | Client → Server | `{ workspaceId, boardId }` | Subscribe socket connection to board & workspace channels. |
| `presence:update` | Server → Client | `{ userId, status, cursorPosition, activeCardId }` | Broadcast live user activity across board members. |
| `card:move` | Client → Server | `{ cardId, targetColumnId, newPosition }` | Dispatch card move event (uses Lexorank index). |
| `card:updated` | Server → Client | `{ cardId, updatedFields, mutatedBy }` | Broadcast optimistic card updates to other clients. |
| `field:lock` | Client → Server | `{ cardId, fieldName, isLocked }` | Claim/release visual lock on a specific field during editing. |
| `automation:triggered` | Server → Client | `{ ruleId, cardId, actionSummary }` | Notify active subscribers when a queue job updates state. |

---

## Repository Directory Structure

```
.
├── apps/
│   ├── web/                         # Next.js App Router (React 19)
│   │   ├── app/                     # Route Handlers & Layouts
│   │   │   ├── (auth)/              # Login, Register, Invite routes
│   │   │   ├── (dashboard)/         # Protected workspace dashboard
│   │   │   │   └── [workspaceSlug]/
│   │   │   │       ├── boards/      # Board views (Kanban & Table)
│   │   │   │       ├── automations/ # React Flow Canvas builder
│   │   │   │       └── settings/    # Workspace & Custom Field management
│   │   │   └── api/                 # Next.js API Routes (BFF layer)
│   │   ├── components/              # React components
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── kanban/              # Drag-and-drop board & card components
│   │   │   ├── datatable/           # TanStack Table components
│   │   │   ├── canvas/              # React Flow node canvas nodes & controls
│   │   │   └── real-time/           # Live presence indicators & cursor canvases
│   │   ├── hooks/                   # Custom hooks (useSocket, useKanban, usePresence)
│   │   ├── lib/                     # Client utilities, TanStack Query setup, Lexorank
│   │   └── stores/                  # Zustand global UI state stores
│   │
│   └── api-server/                  # Dedicated Node.js Backend Server
│       ├── src/
│       │   ├── controllers/         # REST API Controllers
│       │   ├── websockets/          # Socket.io gateways & room managers
│       │   ├── queues/              # BullMQ queue processors & job handlers
│       │   ├── services/            # Business logic & automation evaluators
│       │   ├── middlewares/         # Auth & RBAC verification
│       │   └── index.ts             # Server entry point
│       └── package.json
│
├── packages/
│   ├── database/                    # Prisma ORM schema & database migrations
│   │   ├── prisma/
│   │   └── src/                     # Shared Prisma client exports
│   └── shared-types/                # Shared TypeScript DTOs & Socket event types
│
├── docker-compose.yml               # Local infrastructure (Postgres + Redis)
├── turbo.json                       # Turborepo build pipeline
└── package.json
```

---

## Installation & Local Setup

### Prerequisites

- **Node.js:** `v20.0.0` or higher
- **pnpm:** `v8.0.0` or higher
- **Docker Desktop:** For running local PostgreSQL and Redis containers

### 1. Clone Repository & Install Dependencies

```bash
git clone https://github.com/asadw1/kanban-workflow-suite.git
cd kanban-workflow-suite
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` in both `apps/web` and `apps/api-server`:

```bash
# Workspace Environment Variables (.env)
DATABASE_URL="postgresql://prisma:prisma@localhost:5432/kanban_db?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
NEXT_PUBLIC_SOCKET_URL="http://localhost:4000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

### 3. Spin Up Local Infrastructure

Start PostgreSQL and Redis containers via Docker Compose:

```bash
docker-compose up -d
```

### 4. Run Prisma Migrations & Seed Data

```bash
pnpm --filter database db:push
pnpm --filter database db:seed
```

### 5. Start Development Servers

Run frontend, Node.js API server, and queue worker concurrently:

```bash
pnpm dev
```

The applications will be accessible at:

- **Next.js Frontend:** `http://localhost:3000`
- **Node.js API & WebSockets:** `http://localhost:4000`
- **BullMQ Queue Dashboard:** `http://localhost:4000/queues`

---

## 6-Week Development Roadmap

```
[Week 1] Data Architecture & Authentication
  ├── Prisma Schema & Migrations
  ├── JWT Auth Middleware & RBAC
  └── Workspace Layout Shell & Command Palette

[Week 2] Kanban & Data Table Engines
  ├── @dnd-kit Card/Column DND Integration
  ├── Lexorank Fractional Indexing Algorithm
  └── TanStack Table View with Filtering & Inline Edits

[Week 3] Real-Time Layer & Presence
  ├── Socket.io Room Gateway Setup
  ├── Redis Pub/Sub Scaling Adapter
  └── Live Cursors & Active Member Presence Indicators

[Week 4] Card Detail Sheets & Custom Fields Engine
  ├── Dynamic Custom Field Builder UI
  ├── Slide-Over Card Modal with Checklist & Activity
  └── Optimistic UI State Handling via TanStack Query

[Week 5] Visual Automation Builder & Queue Processor
  ├── React Flow Node Canvas UI
  ├── BullMQ Job Worker Processing
  └── Event Trigger Engine (Card Moves, Assignment Rules)

[Week 6] Accessibility, Performance & Deployment
  ├── Keyboard Accessibility Pass (ARIA & Cmd+K)
  ├── E2E Concurrent Sync Testing
  └── CI/CD Setup, Docker Containerization, and Documentation
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.