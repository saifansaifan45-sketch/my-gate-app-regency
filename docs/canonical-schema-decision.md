# Canonical Schema Decision

Status: Proposed
Product: Zobay Neighbourhood
Origin: Regency Salma community OS
Date: 2026-09-12

## Purpose

Define the canonical domain model before extracting changes from
`feat/chat-and-community`.

PR #8 is treated as a source of capabilities, not as a merge unit.

---

# 1. Visitor Lifecycle

## Decision

Use explicit gate-audit states rather than inheriting the enum from either
`main` or `feat/chat-and-community`.

Canonical lifecycle:

CREATED
  ↓
PENDING
  ↓
APPROVED
  ↓
PARTIALLY_ADMITTED (only when partySize > admittedCount)
  ↓
CHECKED_IN
  ↓
CHECKED_OUT

Terminal / exceptional states:

EXPIRED
REVOKED

### Rationale

The system needs to preserve explicit gate lifecycle semantics.

`CHECKED_IN` and `CHECKED_OUT` are retained because gate operations and
audit history need to distinguish:

- approval
- physical admission
- physical departure

`COMPLETED` is therefore not used as a replacement for `CHECKED_OUT`.

### Party admission

For a visitor with:

partySize = N

the invariant is:

0 <= admittedCount <= partySize

Example:

partySize = 3

admit #1 → admittedCount = 1
admit #2 → admittedCount = 2
admit #3 → admittedCount = 3
admit #4 → reject

Concurrent admissions must be serialized transactionally.

The application must never rely on:

read admittedCount
→ compare
→ update

as two independent operations.

---

# 2. Visitor Fields

The canonical visitor model may incorporate the useful fields from
`feat/chat-and-community`, including:

- partySize
- admittedCount
- otpExpiresAt
- visitor purpose
- lifecycle timestamps
- gate admission/check-out information

Exact field names and migration operations are implementation details and
must follow the canonical Prisma schema.

No enum rename is accepted merely because it exists in a branch.

---

# 3. PermanentPass vs AccessGrant

## Existing model

`PermanentPass`

- household-member scoped
- associated with unit/community
- currently time-bounded to 28 days
- supports household visitor/access workflows
- may carry vehicle-related information

## Branch model

`AccessGrant`

- user → unit relationship
- startsAt / endsAt
- supports broader access semantics
- introduces additional ownership/access concepts

## Decision

Do NOT merge the two models until the domain relationship is explicitly
defined.

### Target direction

`AccessGrant` should become the generalized access primitive only if it can
represent all required household access semantics.

Required capabilities include:

- user-based access
- household-member access
- unit scope
- start/end validity
- revocation
- vehicle association where required
- parking-slot association where required
- community authorization

If these capabilities cannot be represented cleanly, the models remain
complementary rather than forcing a premature replacement.

---

# 4. Revocation Invariant

Revoking a household member must revoke all access grants/passes derived
from that membership.

Invariant:

REVOKED household member
        ↓
active associated access revoked
        ↓
gate authorization
        ↓
ACCESS DENIED

This must be enforced transactionally.

A regression test must exercise the actual gate authorization path.

Database state alone is insufficient.

---

# 5. Authorization Model

The canonical authorization model preserves the distinction between:

LEADERSHIP
MANAGER
WATCHMAN / SECURITY
WORKFORCE
OWNER
RESIDENT

A role name must not implicitly grant operational privileges.

Examples:

- Manager operations require MANAGER authorization.
- Gate operations require the appropriate security/workforce authorization.
- Resident operations require verified residence/membership.
- Leadership does not automatically imply Manager.
- Workforce does not automatically imply Security.

Authorization must be derived from community membership and applicable
permissions, not only from global user identity.

---

# 6. Migration Principle

Do not merge divergent Prisma migration histories using `ours` or `theirs`.

Before implementing schema changes:

1. establish canonical Prisma schema
2. create migration from canonical schema
3. apply to a fresh database
4. run application tests
5. validate migration deployment
6. only then integrate extracted feature PRs

Existing migration files from competing branches are historical inputs,
not automatically canonical migrations.

---

# 7. PR #8 Treatment

PR #8 is superseded as a merge unit.

Useful capabilities will be extracted into independent PRs:

- Visitor lifecycle hardening
- Authorization hardening
- Household/access hardening
- Chat backend
- Chat frontend
- Notifications

No wholesale merge.

---

# 8. Acceptance Criteria

The canonical model is not considered validated until:

- backend typecheck passes
- frontend typecheck passes
- visitor tests pass
- gate approval tests pass
- revocation regression test passes
- concurrent admission test passes
- fresh Prisma migration applies successfully
- gate authorization rejects revoked/expired access

Until these checks pass, Zobay Neighbourhood remains:

"functionally present, productizable after hardening"
