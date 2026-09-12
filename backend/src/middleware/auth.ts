import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { prisma } from '../prisma';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    role?: Role;
  };
}

export async function getApprovedCommunityIds(userId: string, roles: Role[] = [Role.MANAGER, Role.LEADERSHIP]) {
  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      role: { in: roles },
      status: 'APPROVED',
    },
    select: { communityId: true },
  });

  return [...new Set(memberships.map((membership) => membership.communityId))];
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });

    if (!user) {
      return res.status(401).json({ error: { message: 'User not found' } });
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: { message: 'Session expired. Please log in again.' } });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role || Role.RESIDENT,
    };
    next();
  } catch (_err) {
    return res.status(401).json({ error: { message: 'Invalid or expired token' } });
  }
};

export const requireManager = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }


  // Strict database check: must have active APPROVED membership for MANAGER or LEADERSHIP
  const managerMembership = await prisma.membership.findFirst({
    where: {
      userId: req.user.userId,
      role: { in: [Role.MANAGER, Role.LEADERSHIP] },
      status: 'APPROVED',
    },
  });

  if (managerMembership) {
    return next();
  }

  return res.status(403).json({ error: { message: 'Access denied: Active Manager or Leadership membership required' } });
};

export const requireLeadership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  // Strict database check: must have active APPROVED membership for LEADERSHIP
  const leadershipMembership = await prisma.membership.findFirst({
    where: {
      userId: req.user.userId,
      role: Role.LEADERSHIP,
      status: 'APPROVED',
    },
  });

  if (leadershipMembership) {
    return next();
  }

  return res.status(403).json({ error: { message: 'Access denied: Active Leadership membership required' } });
};

export const requireWorkforce = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  // Strict database check: must have active APPROVED membership
  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.user.userId,
      role: { in: [Role.WORKFORCE, Role.MANAGER, Role.LEADERSHIP] },
      status: 'APPROVED',
    },
  });

  if (!membership) {
    return res.status(403).json({ error: { message: 'Access denied: Active Workforce membership required' } });
  }

  // If workforce role, verify employment status is not TERMINATED
  if (membership.role === Role.WORKFORCE) {
    const personnel = await prisma.personnel.findUnique({
      where: { userId: req.user.userId },
    });
    if (personnel && personnel.employmentStatus === 'TERMINATED') {
      return res.status(403).json({ error: { message: 'Access denied: Employment has been terminated' } });
    }
  }

  return next();
};

export const requireSecurityOrLeadership = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.user.userId,
      role: { in: [Role.LEADERSHIP, Role.WORKFORCE] },
      status: 'APPROVED',
    },
  });

  if (!membership) {
    return res.status(403).json({ error: { message: 'Access denied: Security or Leadership membership required' } });
  }

  if (membership.role === Role.WORKFORCE) {
    const personnel = await prisma.personnel.findUnique({
      where: { userId: req.user.userId },
    });
    if (!personnel || personnel.category !== 'SECURITY' || personnel.employmentStatus === 'TERMINATED') {
      return res.status(403).json({ error: { message: 'Access denied: Only Security personnel are authorized' } });
    }
  }

  return next();
};

export const requireWorkforceOrManager = requireWorkforce;

export const requireVerifiedResidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Authentication required.',
      },
    });
  }

  const userId = req.user.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      residencies: {
        where: { status: 'ACTIVE' },
        select: { id: true, unitId: true, status: true },
      },
      ownerships: {
        where: { status: 'ACTIVE' },
        select: { id: true, unitId: true, status: true },
      },
      memberships: {
        where: { status: 'APPROVED' },
        select: { id: true, role: true, status: true, unitId: true, communityId: true },
      },
    },
  });

  if (!user) {
    return res.status(401).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User account not found.',
      },
    });
  }

  const hasActiveResidency = user.residencies.length > 0;
  const hasActiveOwnership = user.ownerships.length > 0;
  const hasApprovedStaffMembership = user.memberships.some(
    (m) => (m.role === Role.MANAGER || m.role === Role.LEADERSHIP) && m.status === 'APPROVED'
  );

  if (!hasActiveResidency && !hasActiveOwnership && !hasApprovedStaffMembership) {
    return res.status(403).json({
      error: {
        code: 'RESIDENCE_VERIFICATION_REQUIRED',
        message: 'Verify your account and link an active residence to continue.',
      },
    });
  }

  next();
};
