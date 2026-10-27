# Regency Salma / Zobay Neighbourhood
## Complete Technical Architecture, Stack Breakdown & Domain Hierarchy Specification

**Document Version:** 1.0.0  
**Baseline Commit:** `origin/main@5976a96` (`v0.0.1`)  
**Scope:** Architecture, Roles & Hierarchy, Tech Stack, 34-Table Relational Schema & Security Invariants  
**PDF Location:** [`Regency_Salma_Comprehensive_Architecture_Document.pdf`](file:///C:/Users/FTC/.gemini/antigravity-ide/scratch/my-gate-app-regency/Regency_Salma_Comprehensive_Architecture_Document.pdf)

---

## 1. Executive Summary & Vision

**Regency Salma** (commercialized as **Zobay Neighbourhood**) is an enterprise residential community operating system. Unlike legacy gated community management tools that treat flat ownership and user accounts as simple strings or single-role entries, Regency Salma was engineered around a core architectural axiom:

> **Core Architectural Axiom: Identity ≠ Authorization**  
> A single real-world human being (`User`) can simultaneously be an **Owner** of Unit 9A, a **Tenant/Resident** of Unit 4B, and an elected member of the **Leadership Council**. Every permission, pass, gate access check, and chat privilege is dynamically derived from verified multi-table relationships rather than a static role flag.

The project was recovered from a legacy prototype into a mathematically strict, deterministic architecture featuring **34 relational database tables**, zero un-migrated schema mutations (strict `migrate deploy`, no `db push`), strict token-versioning security, full offline/online state reconciliation, and multi-role workflow support across mobile and web interfaces.

---

## 2. Complete Technology Stack & Purpose Matrix

Every library and technology in Regency Salma was selected to enforce determinism, security, and low-latency mobile/web responsiveness:

| Technology | Category | Exact Role & Architectural Purpose in Project |
| :--- | :--- | :--- |
| **Expo Router 57** | Mobile / Web Framework | File-based routing for universal apps. Powers simultaneous native deployment (iOS/Android) and zero-config Web application execution via `metro-bundler`. |
| **React Native 0.86 & React 19** | Frontend Core | Cross-platform mobile UI runtime delivering 60fps animations, native haptic integration, safe-area boundary management, and responsive layouts across phones, tablets, and desktop browsers. |
| **Node.js 20+ & Express 5** | Backend API | High-throughput RESTful routing and middleware pipeline with async error handling, custom security cascades, rate limiting, and structured JSON responses. |
| **Prisma ORM 7.9+ / 7.10** | Data Access Layer | Type-safe database ORM managing relational constraints, atomic transactions (`$transaction`), and strictly tracked SQL migrations (`prisma/migrations`). |
| **PostgreSQL 16** | Relational Database | ACID-compliant primary datastore with 34 relational tables, multi-column uniqueness indexes, foreign keys, and audit logging for security gate passes. |
| **JWT & TokenVersion** | Authentication | Dual-token auth (Access + Refresh). Includes database-backed `tokenVersion` to allow instant global session revocation when credentials or roles change. |
| **TanStack React Query 5** | State Management | Server-state caching, background revalidation, optimistic mutations, and automated cache invalidation upon gate check-ins or visitor approvals. |
| **Zod 4** | Validation | Runtime schema enforcement on API payloads (e.g., verifying mandatory `purpose` on visitor requests and 6-digit numeric OTP formatting). |
| **WebSockets & Polling** | Real-Time Communications | Bi-directional real-time chat, security gate alerts, and instant resident notification for arriving guests and courier deliveries. |
| **Docker Containerization** | Infrastructure | Isolated, reproducible execution of PostgreSQL with volume persistence and environmental portability across dev, staging, and production. |

---

## 3. Architectural Layers & Data Flow

```text
               Expo Router 57 (Web & Mobile)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Resident App       Manager Portal      Workforce / Gate
   - Home Dashboard    - Ticket Dispatch   - OTP Gate Scanner
   - Visitor Passes    - Personnel Rosters - PermanentPass Check-in
   - Unit Chat         - Announcements     - Visitor Checkout Log
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
               Express 5 REST API (backend)
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
     Auth Guard          Household           Gate & Visitor
   - JWT + Refresh     - 28-day Passes     - OTP 6-Digit Lock
   - tokenVersion      - Pause/Revoke Sync - Party Size Lock
   - Rate Limiters     - Renewal Guards    - Reconciliation (60s)
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                     Prisma Client 7.10
                            │
               PostgreSQL 16 (34 Core Tables)
```

- **Layer 1: Client Presentation (Expo & React Native Web)**:
  - *Resident App*: Home Dashboard, QuickActions Radial, Household Members, Visitor Pass Creation, Community Spaces, Help-Desk Tickets.
  - *Workforce / Guard Portal*: Gate scanner, OTP verification, `PermanentPass` fast-track check-in, Visitor Departure log.
  - *Management & Leadership*: Tenancy approvals, Personnel attendance, Community broadcast announcements, Role approvals.
- **Layer 2: Network & Reconciliation Layer**:
  - REST API endpoints over HTTPS with strict `Authorization: Bearer <token>` headers.
  - Token refresh rotation & active session reconciliation every 60 seconds.
  - Express Rate Limiters guarding authentication endpoints against credential stuffing and brute force.
- **Layer 3: Business Domain & Controllers (Express 5)**:
  - *Auth Controller*: Strict registration flow (Public manager registration requires Leadership sign-off).
  - *Household Controller*: 28-day validity lifecycle, cascade pause/revocation transactions.
  - *Visitor Controller*: Concurrency locks on party sizes, gate arrival validation, 6-digit cryptographic OTP generation.
- **Layer 4: Persistence & Access Control (Prisma & PostgreSQL 16)**:
  - 34 Relational Tables with foreign key enforcement.
  - Atomic transactions preventing race conditions during physical admission at community gates.

---

## 4. Comprehensive Domain Hierarchy & Stakeholder Model

The system separates **Legal Ownership**, **Physical Residency**, **Administrative Authority**, and **Operational Gate Access**:

| Entity / Role | Relationship / Scope | Privileges & Concrete Operational Capabilities |
| :--- | :--- | :--- |
| **LEADERSHIP**<br/>*(Council / RWA / Board)* | Community-wide Authority | • Supreme administrative authority over the entire community.<br/>• Reviews and approves/rejects new **Manager** and **Security Staff** appointments.<br/>• Publishes community-wide Broadcast Announcements (`URGENT` / `NORMAL`).<br/>• Strict database guard (`requireLeadership`); cannot be spoofed by manager or resident accounts. |
| **PROPERTY OWNER / BUYER**<br/>*(`UnitOwnership`)* | Unit-level Legal Ownership | • Holds registered deed / ownership record (`UnitOwnership ACTIVE`) for one or more physical units.<br/>• Can reside in the flat (`Residency OWNER ACTIVE`) or be an absentee/non-resident landlord.<br/>• Approves or rejects incoming **Tenants** attempting to register for their unit.<br/>• Retains legal control over permanent access grants assigned to the property. |
| **TENANT**<br/>*(`UnitResidency: TENANT`)* | Unit-level Leased Residency | • Rents a unit from an Owner. Initial registration creates a `PENDING` residency.<br/>• Once approved by the Owner or Community Manager, gains active residential rights.<br/>• Can generate Guest/Delivery OTPs, register personal vehicles, and book community amenities.<br/>• Does **not** have rights to approve other tenants or transfer unit ownership. |
| **RESIDENT / FAMILY MEMBER**<br/>*(`HouseholdMember`)* | Unit-level Occupant | • Family members, co-residents living within an active owner or tenant household.<br/>• Can request visitor passes, view gate notifications, and engage in unit/community chat.<br/>• Can have their access state dynamically set to `ACTIVE`, `PAUSED`, or `REVOKED`. |
| **COMMUNITY MANAGER**<br/>*(Manager)* | Operational Oversight | • Dispatches and oversees help-desk maintenance tickets (Plumbing, Electrical, Infrastructure).<br/>• Assigns tasks to maintenance personnel and verifies completion.<br/>• Manages staff rosters, duty schedules, and vendor registrations. |
| **WORKFORCE & SECURITY**<br/>*(Watchman / Guard)* | Perimeter & Gate Checkpoint | • Stationed at physical entrance gates.<br/>• Validates 6-digit visitor OTPs and checks in pre-approved delivery/cab drivers.<br/>• Scans `PermanentPass` QR codes for recurring household staff (maids, cooks, drivers).<br/>• Immediate rejection if household member is `PAUSED` or `REVOKED`. |
| **VISITORS & DELIVERY**<br/>*(`Visitor`)* | Transient / Timed Access | • **Guests:** Receive a 6-digit OTP; locked after 5 failed attempts.<br/>• **Deliveries / Cabs:** Pre-approved by resident; direct gate clearance without OTP.<br/>• **Unannounced Visitors:** Guard enters details $\rightarrow$ push notification to resident $\rightarrow$ resident one-tap approve/reject. |

---

## 5. Critical Security Invariants & Audit Proofs

1. **Cascade Revocation & Pausing Invariant**:  
   When an Owner or Resident marks a `HouseholdMember` (e.g., domestic maid or driver) as `PAUSED` or `REVOKED`, an atomic Prisma transaction immediately updates all linked `PermanentPass` records to `PAUSED`/`REVOKED`. If that individual attempts gate check-in, the gate API returns an immediate `400 Bad Request` error. Access cannot leak due to caching.
2. **Renewal Guard Invariant**:  
   A `PermanentPass` can only be renewed for an additional 28-day window if its associated parent `HouseholdMember` is currently `ACTIVE`. Any attempt to renew a pass for a `PAUSED` or `REVOKED` member triggers a strict rejection.
3. **Strict Leadership Isolation**:  
   Administrative community endpoints are protected by `requireLeadership`. Even a valid Community Manager or Owner receives a `403 Forbidden` on leadership-only routes.
4. **Public Registration Trapdoor**:  
   Users attempting to register publicly with the role of `MANAGER` are placed in a quarantined `PENDING` status. They have zero managerial privileges until an active Leadership member executes a formal approval.
5. **Mandatory Purpose Enforcement**:  
   All visitor creation requests must supply a validated, non-empty `purpose` string (validated via Zod). Anonymous visitor passes are rejected at the schema level.
6. **Cross-Community Invisibility (`404` Invariant)**:  
   To prevent information leakage across multi-society deployments, queries across community boundaries do not return `403 Forbidden`; they return `404 Not Found`, keeping foreign resources completely invisible.

---

## 6. Visitor Lifecycle State Machine

```text
       CREATED (Resident creates in app with purpose & 6-digit OTP)
          │
          ▼
       PENDING (Unannounced visitor arrives; guard enters details)
          │
          ▼
       APPROVED (Resident approves in app)
          │
          ▼
  PARTIALLY_ADMITTED (For partySize > 1, transactional count lock)
          │
          ▼
      CHECKED_IN (Guard validates OTP or Pass; timestamp recorded)
          │
          ▼
     CHECKED_OUT (Guard logs departure through gate)
```

*Terminal States:*
- `EXPIRED`: Time-to-live expired without admission.
- `REVOKED`: Resident or guard cancelled the pass prior to or during visit.

---

## 7. Relational Database Architecture (34 Core Tables)

The PostgreSQL database managed by Prisma contains 34 core tables organized into logical domains:

1. **Identity & Membership Core**: `User`, `Membership`, `RefreshToken`, `AuditLog`
2. **Community & Property Topology**: `Community`, `Block`, `Unit`, `UnitOwnership`, `UnitResidency`
3. **Household & Access Management**: `HouseholdMember`, `PermanentPass`, `HouseholdVehicle`, `HouseholdPet`, `HouseholdHelp`
4. **Visitor & Gate Operations**: `Visitor`, `VisitorLog`, `GateCheckIn`, `GatePassAudit`
5. **Workforce, Operations & Help-Desk**: `Personnel`, `Department`, `Attendance`, `Ticket`, `Task`
6. **Social, Communication & Amenities**: `Channel`, `ChannelMember`, `Message`, `Space`, `SpaceMessage`, `Announcement`, `Poll`, `PollOption`, `PollVote`

---

## 8. Quick Start & Execution Runbook

- **PostgreSQL Database (Docker)**:
  ```powershell
  docker run --name regency-salma-test-db -e POSTGRES_USER=regency_test -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=regency_salma_test -p 5435:5432 -d postgres:16
  ```
- **Backend Migrations & Seeding**:
  ```powershell
  cd backend
  npx prisma migrate deploy
  npx ts-node src/seed.ts
  npm run dev
  ```
- **Frontend Web & Mobile App**:
  ```powershell
  cd frontend
  npx expo start --web
  ```

---

### Pre-Seeded Test Credentials

| Role | Email | Password | Assigned Unit |
| :--- | :--- | :--- | :--- |
| **Leadership** | `leadership@regency.com` | `password123` | Unit 9A |
| **Owner / Resident** | `resident@regency.com` | `password123` | Unit 9B |
| **Family Member** | `family@regency.com` | `password123` | Unit 9B |
| **Co-Owner** | `coowner@regency.com` | `password123` | Unit 9B |
| **Manager** | `manager@regency.com` | `password123` | — |
| **Security Guard** | `watchman@regency.com` | `password123` | Main Gate Checkpoint |
