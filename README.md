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

The platform is a Next.js frontend backed by a dedicated Node.js API and Socket.io gateway, with PostgreSQL for persistence and Redis for pub/sub and BullMQ job queues. The full design, including component views, data flows, security, scalability, and deployment, is in the [Technical Architecture Document](docs/technical-architecture.md).

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

The PostgreSQL schema is managed by Prisma. See the [Database Design Document](docs/database-design.md) for the entity model, relationships, indexing, and data-integrity rules. The canonical schema lives in [`packages/database/prisma/schema.prisma`](packages/database/prisma/schema.prisma).

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
├── docs/                            # Technical Architecture & Database Design documents
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

```mermaid
timeline
    title 6-Week Development Roadmap
    Week 1 - Data Architecture and Authentication : Prisma Schema and Migrations : JWT Auth Middleware and RBAC : Workspace Layout Shell and Command Palette
    Week 2 - Kanban and Data Table Engines : dnd-kit Card and Column DND Integration : Lexorank Fractional Indexing Algorithm : TanStack Table View with Filtering and Inline Edits
    Week 3 - Real-Time Layer and Presence : Socket.io Room Gateway Setup : Redis Pub/Sub Scaling Adapter : Live Cursors and Active Member Presence Indicators
    Week 4 - Card Detail Sheets and Custom Fields Engine : Dynamic Custom Field Builder UI : Slide-Over Card Modal with Checklist and Activity : Optimistic UI State Handling via TanStack Query
    Week 5 - Visual Automation Builder and Queue Processor : React Flow Node Canvas UI : BullMQ Job Worker Processing : Event Trigger Engine for Card Moves and Assignment Rules
    Week 6 - Accessibility and Deployment : Keyboard Accessibility Pass with ARIA and Cmd+K : E2E Concurrent Sync Testing : CI/CD Setup and Docker Containerization and Documentation
```

---

## License

Distributed under the MIT License. See `LICENSE` for more information.