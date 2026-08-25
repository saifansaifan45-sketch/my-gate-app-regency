import { prisma } from '../prisma';
import { PollAudience, SpaceAccessType, Space, SpaceAccessRule, Role } from '@prisma/client';

export interface SpaceWithRules extends Space {
  accessRules: SpaceAccessRule[];
  _count?: {
    posts: number;
    polls: number;
    announcements: number;
    messages: number;
  };
}

export interface UserContext {
  id: string;
  role: Role | null;
  roles: Set<string>;
  hasOwnership: boolean;
  hasActiveResidency: boolean;
  hasOwnerHouseholdAccess: boolean;
  isCommunityMember: boolean;
}

export async function getUserContext(userId: string, targetCommunityId?: string): Promise<UserContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ownerships: { where: { status: 'ACTIVE' }, include: { unit: { select: { communityId: true } } } },
      residencies: { where: { status: 'ACTIVE' }, include: { unit: { select: { communityId: true } } } },
      memberships: { where: { status: 'APPROVED' } },
    },
  });

  if (!user) return null;

  const activeOwnerships = targetCommunityId
    ? user.ownerships.filter((ownership) => ownership.unit.communityId === targetCommunityId)
    : user.ownerships;
  const activeResidencies = targetCommunityId
    ? user.residencies.filter((residency) => residency.unit.communityId === targetCommunityId)
    : user.residencies;
  const relevantMemberships = targetCommunityId
    ? user.memberships.filter((membership) => membership.communityId === targetCommunityId)
    : user.memberships;

  const roles = new Set<string>();
  // A role must belong to this community when a specific space is evaluated.
  // This prevents a leadership role in one community granting access elsewhere.
  if (!targetCommunityId && user.role) roles.add(user.role);
  relevantMemberships.forEach((m) => {
    if (m.role) roles.add(m.role);
  });

  const isCommunityMember = targetCommunityId
    ? relevantMemberships.length > 0 ||
      activeOwnerships.length > 0 ||
      activeResidencies.length > 0
    : true;

  const familyResidencyUnitIds = activeResidencies
    .filter((residency) => residency.relationshipType === 'FAMILY_MEMBER')
    .map((residency) => residency.unitId);
  const ownerOccupancies = familyResidencyUnitIds.length
    ? await prisma.unitResidency.findMany({
        where: { unitId: { in: familyResidencyUnitIds }, status: 'ACTIVE', relationshipType: 'OWNER' },
        include: { user: { select: { ownerships: { where: { status: 'ACTIVE' }, select: { unitId: true } } } } },
      })
    : [];
  const hasFamilyWithResidentOwner = ownerOccupancies.some((occupancy) =>
    occupancy.user.ownerships.some((ownership) => ownership.unitId === occupancy.unitId)
  );

  return {
    id: user.id,
    role: user.role,
    roles,
    hasOwnership: activeOwnerships.length > 0,
    hasActiveResidency: activeResidencies.length > 0,
    hasOwnerHouseholdAccess: activeOwnerships.length > 0 || hasFamilyWithResidentOwner,
    isCommunityMember,
  };
}

export function evaluateSpaceAccess(space: { accessRules: SpaceAccessRule[] }, context: UserContext): boolean {
  // Universal access for Leadership
  if (context.roles.has(Role.LEADERSHIP)) {
    return true;
  }

  // If no specific rules exist, accessible to all community members
  if (!space.accessRules || space.accessRules.length === 0) {
    return context.isCommunityMember;
  }

  for (const rule of space.accessRules) {
    switch (rule.accessType) {
      case SpaceAccessType.ALL_COMMUNITY:
        if (context.isCommunityMember) return true;
        break;
      case SpaceAccessType.OWNERS:
        // An owner can always read owner notices. A linked family member may
        // read them only when that owner is an active resident in the same home.
        // Tenants never receive this access, including where the owner lives off-site.
        if (context.hasOwnerHouseholdAccess || context.roles.has(Role.MANAGER) || context.roles.has(Role.LEADERSHIP)) {
          return true;
        }
        break;
      case SpaceAccessType.ACTIVE_RESIDENTS:
        if (context.hasActiveResidency || context.roles.has(Role.MANAGER) || context.roles.has(Role.LEADERSHIP)) {
          return true;
        }
        break;
      case SpaceAccessType.MANAGERS:
        if (context.roles.has(Role.MANAGER) || context.roles.has(Role.LEADERSHIP)) {
          return true;
        }
        break;
      case SpaceAccessType.LEADERSHIP:
        if (context.roles.has(Role.LEADERSHIP)) {
          return true;
        }
        break;
      case SpaceAccessType.WORKFORCE:
        if (context.roles.has(Role.WORKFORCE) || context.roles.has(Role.MANAGER) || context.roles.has(Role.LEADERSHIP)) {
          return true;
        }
        break;
    }
  }

  return false;
}

export async function getUserAccessibleSpaces(userId: string, explicitCommunityId?: string): Promise<SpaceWithRules[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: true,
      ownerships: { include: { unit: true } },
      residencies: { include: { unit: true } },
    },
  });

  if (!user) return [];

  let communityId = explicitCommunityId;
  if (!communityId) {
    if (user.memberships[0]?.communityId) {
      communityId = user.memberships[0].communityId;
    } else if (user.ownerships[0]?.unit?.communityId) {
      communityId = user.ownerships[0].unit.communityId;
    } else if (user.residencies[0]?.unit?.communityId) {
      communityId = user.residencies[0].unit.communityId;
    } else {
      const defaultComm = await prisma.community.findFirst();
      communityId = defaultComm?.id;
    }
  }

  const context = await getUserContext(userId, communityId);
  if (!context) return [];

  const allSpaces = await prisma.space.findMany({
    where: communityId ? { communityId } : {},
    include: {
      accessRules: true,
      _count: {
        select: {
          posts: true,
          polls: true,
          announcements: true,
          messages: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return allSpaces.filter((space) => evaluateSpaceAccess(space, context));
}

export async function canUserAccessSpace(userId: string, spaceId: string): Promise<boolean> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    include: { accessRules: true },
  });

  if (!space) return false;

  const context = await getUserContext(userId, space.communityId);
  if (!context) return false;

  return evaluateSpaceAccess(space, context);
}

export async function canUserPostAnnouncement(userId: string, spaceId: string): Promise<boolean> {
  const space = await prisma.space.findUnique({ where: { id: spaceId }, select: { communityId: true, accessRules: true } });
  if (!space) return false;
  const context = await getUserContext(userId, space.communityId);
  if (!context) return false;
  if (!evaluateSpaceAccess(space, context)) return false;

  return context.roles.has(Role.LEADERSHIP) || context.roles.has(Role.MANAGER);
}

export async function canUserCreatePoll(
  userId: string,
  spaceId: string,
  audience: PollAudience,
  unitId?: string | null,
): Promise<boolean> {
  const space = await prisma.space.findUnique({
    where: { id: spaceId },
    select: { communityId: true, accessRules: true },
  });
  if (!space) return false;

  const context = await getUserContext(userId, space.communityId);
  if (!context || !evaluateSpaceAccess(space, context)) return false;

  const isManagement = context.roles.has(Role.LEADERSHIP) || context.roles.has(Role.MANAGER);
  if (isManagement) {
    return audience !== PollAudience.HOUSEHOLD && !unitId;
  }

  if (audience !== PollAudience.HOUSEHOLD || !unitId) return false;

  const [ownership, residency] = await Promise.all([
    prisma.unitOwnership.findFirst({ where: { userId, unitId, status: 'ACTIVE', unit: { communityId: space.communityId } } }),
    prisma.unitResidency.findFirst({ where: { userId, unitId, status: 'ACTIVE', unit: { communityId: space.communityId } } }),
  ]);

  return Boolean(ownership || residency);
}

export async function canUserAccessPoll(
  userId: string,
  poll: { authorId: string; audience: PollAudience; unitId: string | null; space: { communityId: string } },
): Promise<boolean> {
  if (poll.authorId === userId) return true;

  const context = await getUserContext(userId, poll.space.communityId);
  if (!context) return false;

  switch (poll.audience) {
    case PollAudience.LEADERSHIP:
      return context.roles.has(Role.LEADERSHIP);
    case PollAudience.OWNERS:
      return context.hasOwnership;
    case PollAudience.RESIDENTS:
      return context.hasActiveResidency;
    case PollAudience.HOUSEHOLD: {
      if (!poll.unitId) return false;
      const [ownership, residency] = await Promise.all([
        prisma.unitOwnership.findFirst({ where: { userId, unitId: poll.unitId, status: 'ACTIVE' } }),
        prisma.unitResidency.findFirst({ where: { userId, unitId: poll.unitId, status: 'ACTIVE' } }),
      ]);
      return Boolean(ownership || residency);
    }
    default:
      return false;
  }
}

export async function canUserManagePoll(userId: string, poll: { authorId: string; space: { communityId: string } }): Promise<boolean> {
  if (poll.authorId === userId) return true;
  const context = await getUserContext(userId, poll.space.communityId);
  return Boolean(context?.roles.has(Role.LEADERSHIP) || context?.roles.has(Role.MANAGER));
}
