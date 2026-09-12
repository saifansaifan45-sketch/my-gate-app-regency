import { prisma } from '../prisma';
import { Role } from '@prisma/client';

export async function canUserAccessChannel(userId: string, channelId: string): Promise<{ authorized: boolean; communityId?: string; unitId?: string }> {
  if (!channelId || typeof channelId !== 'string') return { authorized: false };

  // UNIT channel: unit:<unitId> — check active residency/ownership or membership for that unit/community
  if (channelId.startsWith('unit:')) {
    const unitId = channelId.replace('unit:', '').trim();
    if (!unitId) return { authorized: false };
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true, communityId: true } });
    if (!unit) return { authorized: false };

    const activeResidency = await prisma.unitResidency.findFirst({ where: { userId, unitId, status: 'ACTIVE' } });
    if (activeResidency) return { authorized: true, communityId: unit.communityId, unitId: unit.id };

    const activeOwnership = await prisma.unitOwnership.findFirst({ where: { userId, unitId, status: 'ACTIVE' } });
    if (activeOwnership) return { authorized: true, communityId: unit.communityId, unitId: unit.id };

    const unitMembership = await prisma.membership.findFirst({ where: { userId, unitId, status: 'APPROVED' } });
    if (unitMembership) return { authorized: true, communityId: unit.communityId, unitId: unit.id };

    const leadershipOrManager = await prisma.membership.findFirst({ where: { userId, communityId: unit.communityId, role: { in: [Role.LEADERSHIP, Role.MANAGER] }, status: 'APPROVED' } });
    if (leadershipOrManager) return { authorized: true, communityId: unit.communityId, unitId: unit.id };

    return { authorized: false };
  }

  // OWNERS channel: channel:owners:<communityId> — check OWNER/LEADERSHIP in community
  if (channelId.startsWith('channel:owners')) {
    const parts = channelId.split(':');
    const targetCommunityId = parts.length === 3 ? parts[2] : undefined;
    if (targetCommunityId) {
      const community = await prisma.community.findUnique({ where: { id: targetCommunityId } });
      if (!community) return { authorized: false };
      const owner = await prisma.membership.findFirst({ where: { userId, communityId: targetCommunityId, role: { in: [Role.OWNER, Role.LEADERSHIP] }, status: 'APPROVED' } });
      if (owner) return { authorized: true, communityId: targetCommunityId };
      const ownership = await prisma.unitOwnership.findFirst({ where: { userId, status: 'ACTIVE' }, include: { unit: true } });
      if (ownership && ownership.unit.communityId === targetCommunityId) return { authorized: true, communityId: targetCommunityId };
      return { authorized: false };
    }
    // Generic owners channel without community — check any OWNER membership
    const anyOwner = await prisma.membership.findFirst({ where: { userId, role: { in: [Role.OWNER, Role.LEADERSHIP] }, status: 'APPROVED' } });
    if (anyOwner) return { authorized: true, communityId: anyOwner.communityId };
    return { authorized: false };
  }

  // GENERAL community channel: community:<communityId> — check any APPROVED membership in community
  if (channelId.startsWith('community:')) {
    const communityId = channelId.replace('community:', '').trim();
    if (!communityId) return { authorized: false };
    const membership = await prisma.membership.findFirst({ where: { userId, communityId, status: 'APPROVED' } });
    if (!membership) return { authorized: false };
    // PAUSED/REVOKED membership already filtered by status APPROVED, so denied
    return { authorized: true, communityId };
  }

  return { authorized: false };
}
