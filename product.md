# Product — Zobay Neighbourhood V0.0.1

> **Regency Salma → Zobay Neighbourhood** — community OS, not MyGate clone. `origin/main@5976a96` (`v0.0.1` at `758a563` + `5976a96` chat contract), `34 tables`, `42/42`.

## Vision

Premium gated community platform — **security, household, community, workforce, chat** — where `Identity ≠ Authorization`. One `User` can be `OWNER` in `Unit A`, `TENANT` in `Unit B`, `FAMILY_MEMBER` in `Unit C` (`User → Membership → UnitResidency → HouseholdMember → PermanentPass → Visitor`).

## Roles (canonical, not flattened)

- **LEADERSHIP** — community-wide, `requireLeadership` strict (`LEADERSHIP + APPROVED` only, `middleware/auth.ts:104` fallback removed).
- **MANAGER** — `MANAGER + APPROVED` (public `POST /auth/register {role:MANAGER}` → `PENDING` until leadership approves, `auth.ts:246`).
- **OWNER** — owns `UnitOwnership ACTIVE`, auto `Residency OWNER ACTIVE`.
- **RESIDENT / FAMILY_MEMBER** — lives via `UnitResidency ACTIVE`.
- **TENANT** — `Residency PENDING` until `OWNER/MANAGER` approves.
- **WORKFORCE — SECURITY** — `PersonnelCategory SECURITY` + `Department SECURITY`, `requireWorkforce` checks `Personnel.employmentStatus !== TERMINATED`.

## V0.0.1 Capabilities (shipped)

**Resident:**
- Home dashboard, `QuickActions` radial (centered `QuickActionsRadial:92`), `CommunityUpdates`, `GateStatusCard`, `MyRequests`, `TimeBasedBackground`.
- Household: `HouseholdMember` `ACTIVE/PAUSED/REVOKED` → `PermanentPass` `ACTIVE/PAUSED/REVOKED` (28d, `validUntil` + `status` indexes), `HouseholdVehicle` unique `unitId+registrationNumber`, `HouseholdPet`, `HouseholdHelp`.
- Visitor: `POST /visitors` `purpose` required (`min 1`), `GUEST` → OTP `6-digit` (5-attempt lock `429`), `CAB/DELIVERY/SERVICE` → `isPreApproved` no OTP, `unannounced` → resident alert → `approve` → `check-in` (OTP or `permanent-pass` one-tap), `reconcileVisitorLifecycle` 60s.
- Help-desk: `Ticket` `OPEN→ASSIGNED→COMPLETED_BY_WORKER→CLOSED` + `Task` `ASSIGNED→VERIFIED`, `Manager` assignment.

**Gate/Security:**
- `GET /visitors/gate` (filters `ACTIVE`), `POST /visitors/:id/check-in` (OTP + `reconcile` + `updateMany where APPROVED` → `409` concurrency), `POST /visitors/permanent-pass/:passId/check-in` (`ACTIVE` + `validUntil` + `community` + `header` auth, `PAUSED/REVOKED` → `400`, cross-community → `404`).

**Community:**
- `Space` (`LEADERSHIP/OWNER/RESIDENT`), `CommunityPost`, `Poll` (`ACTIVE`), `Announcement` (`NORMAL/IMPORTANT/URGENT`), `SpaceMessage`.
- **Chat P1:** `GET /chat/channels` (unit/community/owners), `GET/POST /chat/channels/:channelId/messages` — header `Authorization: Bearer` (never `?token=`), `canUserAccessChannel` checks `ACTIVE`/`APPROVED`, `PAUSED/REVOKED` → `404`, `replace` mock push.

**Workforce/Manager/Leadership:**
- `Personnel` `ACTIVE/SUSPENDED/TERMINATED`, `Attendance`, `Task` assignment, `Leadership` announcements, `Manager` approvals.

## Intentionally unavailable (V0.0.1)

- **Lost & Found** — no `LostAndFoundItem` route yet.
- **Calendar** — no event storage.

## Authorization Invariants (proven)

```text
REVOKED/PAUSED member → ACTIVE passes → REVOKED/PAUSED (transaction, household.ts:257)
→ POST /permanent-pass/:passId/check-in → 400 DENY (household-revoke/paused.test.ts)
REVOKED/PAUSED member → POST /household/permanent-passes/:id/renew → 400 (household-renew.test.ts)
LEADERSHIP strict → MANAGER/WORKFORCE/RESIDENT/OWNER → 403 (leadership-auth.test.ts)
MANAGER via public register → PENDING → 403 on /manager/roles/assign-manager (register-authz.test.ts)
purpose required → POST /visitors without purpose → 400 (visitor-purpose.test.ts)
chat PAUSED/REVOKED → 404, cross-community → 404 (chat.test.ts)
```

## Roadmap (beyond V0.0.1)

**V0.0.2:** `concurrent admission` (`partySize` → `admittedCount` transactional `WHERE admittedCount < partySize`), `register` captcha/Redis, `AccessGrant` vs `PermanentPass` decision.

**V1:** Multi-community `Zobay Neighbourhood` genericization, `Maya` integration, `NoBrokerHood/MyGate` gap.

**V0.0.1 is `5976a96`** — `v0.0.1` tag `758a563` + `5976a96` chat contract fix.
