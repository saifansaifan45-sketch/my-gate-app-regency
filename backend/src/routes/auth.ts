import crypto from 'crypto';
import { sendEmail, generateResetToken } from '../utils/email';
import { Router, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Role, OwnershipStatus, ResidencyStatus, ResidencyType, MembershipStatus } from '@prisma/client';
import { prisma } from '../prisma';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: { message: 'Too many requests, please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

// Login: 10 attempts per 15 min per IP+email combo
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: { message: 'Too many login attempts. Please try again in 15 minutes.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    try {
      const body = JSON.parse(req.body?.toString() || '{}');
      const email = (body.email || '').toLowerCase().trim();
      return email ? `${ip}:${email}` : ip;
    } catch {
      return ip;
    }
  },
  skipSuccessfulRequests: true,
});

// Register: 5 per hour per IP (legitimate users rarely register more than once)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: { message: 'Too many registration attempts. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

// Password reset: 3 per hour per IP (strict but not blocking)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: { message: 'Too many password reset attempts. Please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
});

const registerSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().optional(),
  phoneNumber: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
  // Legacy / optional fields for backward compatibility
  floor: z.string().optional(),
  room: z.string().optional(),
  flatNumber: z.string().optional(),
  role: z.string().optional(),
  relationship: z.string().optional(),
  livesHere: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Helper to format user response with all active roles, memberships, ownerships, and residencies
function formatUserResponse(user: any) {
  const rolesSet = new Set<string>();
  if (user.role) rolesSet.add(user.role);
  if (user.memberships) {
    user.memberships.forEach((m: any) => {
      if (m.role) rolesSet.add(m.role);
    });
  }

  const hasPropertyConnection =
    (user.ownerships && user.ownerships.length > 0) ||
    (user.residencies && user.residencies.length > 0);
  const hasEmployeeConnection =
    user.memberships &&
    user.memberships.some(
      (m: any) => m.role === 'MANAGER' || m.role === 'WORKFORCE' || m.role === 'LEADERSHIP'
    );

  const pendingEmployeeMembership = user.memberships?.find(
    (m: any) =>
      (m.role === 'MANAGER' || m.role === 'WORKFORCE') && m.status === 'PENDING'
  );

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || 'Resident',
    lastName: user.lastName || '',
    phoneNumber: user.phoneNumber || '',
    unitNumber: user.unitNumber || '',
    role: user.role || Role.RESIDENT,
    roles: Array.from(rolesSet),
    isOnboarded: hasPropertyConnection || (hasEmployeeConnection && !pendingEmployeeMembership),
    isPendingApproval: Boolean(pendingEmployeeMembership),
    memberships: (user.memberships || []).map((m: any) => ({
      id: m.id,
      communityId: m.communityId,
      unitId: m.unitId,
      role: m.role,
      status: m.status,
    })),
    ownerships: (user.ownerships || []).map((o: any) => ({
      id: o.id,
      unitId: o.unitId,
      unitNumber: o.unit?.unitNumber,
      status: o.status,
    })),
    residencies: (user.residencies || []).map((r: any) => ({
      id: r.id,
      unitId: r.unitId,
      unitNumber: r.unit?.unitNumber,
      relationshipType: r.relationshipType,
      status: r.status,
    })),
  };
}

// ----------------------------------------------------
// 1. POST /auth/register (Step 1 — Pure Account Creation)
// ----------------------------------------------------
router.post('/register', registerLimiter, async (req, res, _next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();
    const idempotencyKey = body.idempotencyKey;

    // Idempotency check
    if (idempotencyKey) {
      const existingKey = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
      if (existingKey) {
        if (existingKey.response) {
          return res.status(201).json(existingKey.response);
        }
        return res.status(409).json({ error: { message: 'Request is being processed, please wait.' } });
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const response = { error: { message: 'User already exists with this email address' } };
      if (idempotencyKey) {
        await prisma.idempotencyKey.create({
          data: { key: idempotencyKey, endpoint: '/auth/register', userId: existingUser.id, response, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
        });
      }
      return res.status(400).json(response);
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    let firstName = 'Resident';
    let lastName = '';
    if (body.fullName && body.fullName.trim()) {
      const parts = body.fullName.trim().split(' ');
      firstName = parts[0] || 'Resident';
      lastName = parts.slice(1).join(' ');
    }

    // Default community lookup
    let community = await prisma.community.findFirst();
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue, Regency Salma' },
      });
    }

    // Create User Identity
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phoneNumber: body.phoneNumber?.trim() || null,
        role: Role.RESIDENT,
      },
    });

    // Store idempotency key if provided
    if (idempotencyKey) {
      await prisma.idempotencyKey.create({
        data: { key: idempotencyKey, endpoint: '/auth/register', userId: user.id, response: { id: user.id, email: user.email }, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
      });
    }

    let _membership = null;
    let _createdOwnership: any = null;
    let _createdResidency: any = null;
    const legacyUnitNum = body.flatNumber || (body.floor && body.room ? `${body.floor}${body.room}` : null);
    if (legacyUnitNum) {
      const unitNumber = legacyUnitNum.toUpperCase().trim();
      let unit = await prisma.unit.findFirst({
        where: { communityId: community.id, unitNumber },
        include: { ownerships: { where: { status: OwnershipStatus.ACTIVE } } },
      });
      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            communityId: community.id,
            unitNumber,
            floor: body.floor || '1',
            block: 'Tower A',
          },
          include: { ownerships: { where: { status: OwnershipStatus.ACTIVE } } },
        });
      }

      const isTenant =
        body.relationship?.toUpperCase() === 'TENANT' || body.role?.toLowerCase() === 'tenant';
      const userRole = isTenant ? Role.TENANT : (body.role?.toUpperCase() === 'MANAGER' ? Role.MANAGER : Role.OWNER);

      _membership = await prisma.membership.create({
        data: {
          userId: user.id,
          communityId: community.id,
          unitId: unit.id,
          role: userRole,
          status: 'APPROVED',
        },
      });

      if (!isTenant) {
        _createdOwnership = await prisma.unitOwnership.create({
          data: { userId: user.id, unitId: unit.id, status: OwnershipStatus.ACTIVE },
          include: { unit: true },
        });

        if (body.livesHere !== false) {
          _createdResidency = await prisma.unitResidency.create({
            data: {
              userId: user.id,
              unitId: unit.id,
              status: ResidencyStatus.ACTIVE,
              relationshipType: ResidencyType.OWNER,
              verifiedAt: new Date(),
            },
            include: { unit: true },
          });
        }
      } else {
        _createdResidency = await prisma.unitResidency.create({
          data: {
            userId: user.id,
            unitId: unit.id,
            status: ResidencyStatus.PENDING,
            relationshipType: ResidencyType.TENANT,
          },
          include: { unit: true },
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { unitNumber, role: userRole },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.tokenVersion);
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: hashedRefresh,
        expiresAt,
      },
    });

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: { include: { community: true, unit: true } },
        ownerships: { include: { unit: true } },
        residencies: { include: { unit: true } },
      },
    });

    const formatted = formatUserResponse(fullUser);

    const response = {
      accessToken,
      refreshToken,
      user: formatted,
      roles: formatted.roles,
      memberships: formatted.memberships,
    };

    // Update idempotency key with full response
    if (idempotencyKey) {
      await prisma.idempotencyKey.update({
        where: { key: idempotencyKey },
        data: { response }
      });
    }

    res.status(201).json(response);
  } catch (error) {
    _next(error);
  }
});

// ----------------------------------------------------
// 2. POST /auth/login
// ----------------------------------------------------
router.post('/login', loginLimiter, async (req, res, _next) => {
  try {
    const { email: rawEmail, password } = loginSchema.parse(req.body);
    const email = rawEmail.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { community: true, unit: true },
        },
        ownerships: {
          include: { unit: true },
        },
        residencies: {
          include: { unit: true },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: { message: 'Invalid email or password' } });
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.tokenVersion);
    const hashedRefresh = await bcrypt.hash(refreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: hashedRefresh,
        expiresAt,
      },
    });

    const formattedUser = formatUserResponse(user);

    res.json({
      accessToken,
      refreshToken,
      user: formattedUser,
      roles: formattedUser.roles,
      memberships: formattedUser.memberships,
    });
  } catch (error) {
    _next(error);
  }
});

// ----------------------------------------------------
// 3. POST /auth/onboarding/owner (Option 1: I own a property)
// ----------------------------------------------------
const ownerOnboardingSchema = z.object({
  floor: z.string().optional(),
  flatNumber: z.string().min(1, 'Flat / Unit number is required'),
  livesHere: z.boolean().default(true),
});

router.post('/onboarding/owner', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { floor, flatNumber, livesHere } = ownerOnboardingSchema.parse(req.body);
    const unitNumber = flatNumber.toUpperCase().trim();

    let community = await prisma.community.findFirst();
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue, Regency Salma' },
      });
    }

    let unit = await prisma.unit.findFirst({
      where: { communityId: community.id, unitNumber },
      include: { ownerships: { where: { status: 'ACTIVE' } } },
    });

    if (unit && unit.ownerships.length > 0) {
      if (!unit.ownerships.some((o: any) => o.userId === userId)) {
        res.status(403).json({ error: { message: 'This unit already has a registered owner.' } });
        return;
      }
    }

    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          communityId: community.id,
          unitNumber,
          floor: floor || '1',
          block: 'Tower A',
        },
        include: { ownerships: true },
      });
    }

    // 1. Create / Upsert UnitOwnership
    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId, unitId: unit.id } },
      update: { status: 'ACTIVE' },
      create: { userId, unitId: unit.id, status: 'ACTIVE' },
    });

    // 2. If livesHere is true -> create UnitResidency(OWNER, ACTIVE)
    if (livesHere) {
      await prisma.unitResidency.upsert({
        where: {
          userId_unitId_relationshipType: {
            userId,
            unitId: unit.id,
            relationshipType: ResidencyType.OWNER,
          },
        },
        update: { status: ResidencyStatus.ACTIVE, verifiedAt: new Date() },
        create: {
          userId,
          unitId: unit.id,
          relationshipType: ResidencyType.OWNER,
          status: ResidencyStatus.ACTIVE,
          verifiedAt: new Date(),
        },
      });
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        unitNumber,
        role: Role.OWNER,
      },
      include: {
        memberships: true,
        ownerships: { include: { unit: true } },
        residencies: { include: { unit: true } },
      },
    });

    res.json({
      success: true,
      message: livesHere
        ? `Configured as Owner & Resident of Unit ${unitNumber}.`
        : `Configured as Property Owner of Unit ${unitNumber}.`,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 4. POST /auth/onboarding/resident (Option 2: I live in a property)
// ----------------------------------------------------
const residentOnboardingSchema = z.object({
  floor: z.string().optional(),
  flatNumber: z.string().min(1, 'Flat / Unit number is required'),
  relationshipType: z.enum(['TENANT', 'FAMILY_MEMBER']).default('TENANT'),
});

router.post('/onboarding/resident', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { floor, flatNumber, relationshipType } = residentOnboardingSchema.parse(req.body);
    const unitNumber = flatNumber.toUpperCase().trim();
    const relType = relationshipType as ResidencyType;

    let community = await prisma.community.findFirst();
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue, Regency Salma' },
      });
    }

    let unit = await prisma.unit.findFirst({
      where: { communityId: community.id, unitNumber },
      include: {
        ownerships: {
          where: { status: OwnershipStatus.ACTIVE },
          include: { user: true },
        },
      },
    });

    if (!unit) {
      unit = await prisma.unit.create({
        data: {
          communityId: community.id,
          unitNumber,
          floor: floor || '1',
          block: 'Tower A',
        },
        include: {
          ownerships: {
            where: { status: OwnershipStatus.ACTIVE },
            include: { user: true },
          },
        },
      });
    }

    // Create UnitResidency(PENDING)
    const residency = await prisma.unitResidency.upsert({
      where: {
        userId_unitId_relationshipType: {
          userId,
          unitId: unit.id,
          relationshipType: relType,
        },
      },
      update: {
        status: ResidencyStatus.PENDING,
        verifiedById: null,
        verifiedAt: null,
      },
      create: {
        userId,
        unitId: unit.id,
        relationshipType: relType,
        status: ResidencyStatus.PENDING,
      },
    });

    // Notify unit owners
    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    if (unit.ownerships && unit.ownerships.length > 0) {
      for (const o of unit.ownerships) {
        await prisma.notification.create({
          data: {
            userId: o.userId,
            type: 'TENANT_VERIFICATION_REQUEST',
            title: 'Tenant Residency Request',
            message: `${applicant?.firstName || 'Resident'} has requested residency access for Unit ${unit.unitNumber}.`,
            metadata: { unitId: unit.id, unitNumber: unit.unitNumber, residencyId: residency.id },
          },
        });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        unitNumber,
        role: Role.TENANT,
      },
      include: {
        memberships: true,
        ownerships: { include: { unit: true } },
        residencies: { include: { unit: true } },
      },
    });

    res.json({
      success: true,
      message: `Residency request submitted for Unit ${unitNumber}. Pending owner verification.`,
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 5. POST /auth/onboarding/employee (Option 3: I work with the community)
// ----------------------------------------------------
const employeeOnboardingSchema = z.object({
  role: z.enum(['MANAGER', 'SECURITY', 'HOUSEKEEPING', 'HOUSE_HELP', 'MAINTENANCE', 'ELECTRICIAN', 'PLUMBER', 'GARDENER', 'DRIVER', 'OTHER']),
  department: z.string().optional(),
  experience: z.string().optional(),
  notes: z.string().optional(),
});

router.post('/onboarding/employee', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { role: selectedRole, department, experience, notes } = employeeOnboardingSchema.parse(req.body);

    let community = await prisma.community.findFirst();
    if (!community) {
      community = await prisma.community.create({
        data: { name: 'Regency Salma Township', address: '42 Palm Avenue, Regency Salma' },
      });
    }

    const assignedRole = selectedRole === 'MANAGER' ? Role.MANAGER : Role.WORKFORCE;
    
    // The role chosen in onboarding is authoritative. Department is retained
    // only for compatibility with older clients and never changes the role.
    let requestedCategory = 'OTHER';
    let requestedDepartment = 'OTHER';

    if (selectedRole === 'SECURITY') {
      requestedCategory = 'SECURITY';
      requestedDepartment = 'SECURITY';
    } else if (selectedRole === 'HOUSEKEEPING' || selectedRole === 'HOUSE_HELP') {
      requestedCategory = 'CLEANER';
      requestedDepartment = 'HOUSEKEEPING';
    } else if (selectedRole === 'ELECTRICIAN') {
      requestedCategory = 'ELECTRICIAN';
      requestedDepartment = 'MAINTENANCE';
    } else if (selectedRole === 'PLUMBER') {
      requestedCategory = 'PLUMBER';
      requestedDepartment = 'MAINTENANCE';
    } else if (selectedRole === 'GARDENER') {
      requestedCategory = 'GARDENER';
      requestedDepartment = 'GARDENING';
    } else if (selectedRole === 'MAINTENANCE') {
      requestedCategory = 'MAINTENANCE';
      requestedDepartment = 'MAINTENANCE';
    }

    // Create Membership with PENDING status
    await prisma.membership.upsert({
      where: {
        userId_communityId_role: {
          userId,
          communityId: community.id,
          role: assignedRole,
        },
      },
      update: {
        status: MembershipStatus.PENDING,
        requestedCategory,
        requestedDepartment,
      },
      create: {
        userId,
        communityId: community.id,
        role: assignedRole,
        status: MembershipStatus.PENDING,
        requestedCategory,
        requestedDepartment,
      },
    });

    // Notify Leadership
    const applicant = await prisma.user.findUnique({ where: { id: userId } });
    const leadershipUsers = await prisma.user.findMany({
      where: { role: Role.LEADERSHIP },
      select: { id: true },
    });

    for (const leader of leadershipUsers) {
      await prisma.notification.create({
        data: {
          userId: leader.id,
          type: 'EMPLOYEE_VERIFICATION_REQUEST',
          title: 'New Staff Application',
          message: `${applicant?.firstName || 'Employee'} applied for the ${selectedRole} role.`,
          metadata: { applicantId: userId, role: selectedRole, department, experience, notes },
        },
      });
    }

    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: true,
        ownerships: { include: { unit: true } },
        residencies: { include: { unit: true } },
      },
    });

    res.json({
      success: true,
      status: 'PENDING_APPROVAL',
      message: 'Your request has been sent to Regency Salma leadership. You will get access after approval.',
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------
// 6. POST /auth/refresh
// ----------------------------------------------------
router.post('/refresh', authLimiter, async (req, res, _next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const payload = verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        memberships: true,
        ownerships: { include: { unit: true } },
        residencies: { include: { unit: true } },
      },
    });

    if (!user) {
      return res.status(401).json({ error: { message: 'User not found' } });
    }

    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    let validSession = null;

    for (const session of sessions) {
      if (await bcrypt.compare(refreshToken, session.refreshToken)) {
        validSession = session;
        break;
      }
    }

    if (!validSession || validSession.expiresAt < new Date()) {
      return res.status(401).json({ error: { message: 'Invalid or expired refresh token' } });
    }

    const newTokens = generateTokens(user.id, user.tokenVersion);
    const newHashedRefresh = await bcrypt.hash(newTokens.refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.update({
      where: { id: validSession.id },
      data: { refreshToken: newHashedRefresh, expiresAt },
    });

    res.json({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      user: formatUserResponse(user),
    });
  } catch (_error) {
    res.status(401).json({ error: { message: 'Invalid refresh token' } });
  }
});

// ----------------------------------------------------
// 7. POST /auth/logout
// ----------------------------------------------------
router.post('/logout', requireAuth, async (req: AuthRequest, res, _next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const sessions = await prisma.session.findMany({ where: { userId: req.user!.userId } });
      for (const session of sessions) {
        if (await bcrypt.compare(refreshToken, session.refreshToken)) {
          await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
        }
      }
    } else {
      await prisma.session.deleteMany({ where: { userId: req.user!.userId } });
    }

    res.json({ success: true });
  } catch (error) {
    _next(error);
  }
});

// ----------------------------------------------------
// 8. GET /auth/me
// ----------------------------------------------------
router.get('/me', requireAuth, async (req: AuthRequest, res, _next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        memberships: {
          include: { community: true, unit: true },
        },
        ownerships: {
          include: { unit: true },
        },
        residencies: {
          include: { unit: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    res.json(formatUserResponse(user));
  } catch (error) {
    _next(error);
  }
});

// ----------------------------------------------------
// 9. PATCH /auth/role (Switch role between existing approved memberships)
// ----------------------------------------------------
router.patch('/role', requireAuth, async (req: AuthRequest, res, _next) => {
  try {
    const { role } = req.body;
    const allowedRoles = [Role.OWNER, Role.TENANT, Role.MANAGER, Role.RESIDENT, Role.LEADERSHIP, Role.WORKFORCE];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: { message: 'Invalid role' } });
    }

    const userId = req.user!.userId;

    // Check if user has an approved membership or active residency/ownership for the target role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: { where: { status: 'APPROVED' } },
        residencies: { where: { status: ResidencyStatus.ACTIVE } },
        ownerships: { where: { status: OwnershipStatus.ACTIVE } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } });
    }

    const hasApprovedMembershipForRole = user.memberships.some((m) => m.role === role);
    const hasActiveResidencyForRole = (role === Role.RESIDENT || role === Role.TENANT) && user.residencies.length > 0;
    const hasActiveOwnershipForRole = role === Role.OWNER && user.ownerships.length > 0;

    if (!hasApprovedMembershipForRole && !hasActiveResidencyForRole && !hasActiveOwnershipForRole) {
      return res.status(403).json({
        error: {
          code: 'ROLE_ESCALATION_PROHIBITED',
          message: 'Self-service role escalation is prohibited. Approved community membership required.',
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        memberships: {
          include: { community: true, unit: true },
        },
        ownerships: {
          include: { unit: true },
        },
        residencies: {
          include: { unit: true },
        },
      },
    });

    res.json({ success: true, user: formatUserResponse(updated) });
  } catch (error) {
    _next(error);
  }
});


// ----------------------------------------------------
// 10. POST /auth/change-password
// ----------------------------------------------------
const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});

router.post('/change-password', requireAuth, authLimiter, async (req: AuthRequest, res, _next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: { message: 'User not found' } });

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) return res.status(400).json({ error: { message: 'Incorrect current password' } });

    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({ error: { message: 'New password cannot be the same as current password' } });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const newTokenVersion = user.tokenVersion + 1;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newHash, tokenVersion: newTokenVersion }
      });
      await tx.session.deleteMany({ where: { userId } });
      
      const firstCommunity = await tx.community.findFirst();
      if (firstCommunity) {
        await tx.auditLog.create({
          data: {
            communityId: firstCommunity.id,
            actorId: userId,
            targetId: userId,
            action: 'PASSWORD_CHANGED'
          }
        });
      }
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    _next(error);
  }
});




// ----------------------------------------------------
// 11. POST /auth/forgot-password
// ----------------------------------------------------
router.post('/forgot-password', passwordResetLimiter, async (req, res, _next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: { message: 'Email is required' } });

    // Important: Always return a safe generic response to prevent email enumeration
    res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    // Rate-limiting check: Prevent sending if reset was requested within the last 2 minutes
    if (user.resetTokenExpiresAt && user.resetTokenExpiresAt.getTime() - Date.now() > 58 * 60 * 1000) {
      return; // Token was generated less than 2 minutes ago
    }

    const { resetToken, resetTokenHash } = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpiresAt: expiresAt }
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: `You requested a password reset. Please click the following link to reset your password: ${resetLink}\nIf you did not request this, please ignore this email.`,
      html: `<p>You requested a password reset.</p><p><a href="${resetLink}">Click here to reset your password</a></p><p>If you did not request this, please ignore this email.</p>`
    });
    
    const firstCommunity = await prisma.community.findFirst();
    if (firstCommunity) {
      await prisma.auditLog.create({
        data: {
          communityId: firstCommunity.id,
          actorId: user.id,
          targetId: user.id,
          action: 'PASSWORD_RESET_REQUESTED'
        }
      });
    }
  } catch (error) {
    console.error('Forgot password error:', error);
  }
});

// ----------------------------------------------------
// 12. POST /auth/reset-password
// ----------------------------------------------------
router.post('/reset-password', authLimiter, async (req, res, _next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: { message: 'Valid token and new password (min 8 chars) are required' } });
    }

    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash,
        resetTokenExpiresAt: { gt: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({ error: { message: 'Invalid or expired reset token' } });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const newTokenVersion = user.tokenVersion + 1;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { 
          passwordHash: newHash, 
          tokenVersion: newTokenVersion,
          resetTokenHash: null,
          resetTokenExpiresAt: null
        }
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      
      const firstCommunity = await tx.community.findFirst();
      if (firstCommunity) {
        await tx.auditLog.create({
          data: {
            communityId: firstCommunity.id,
            actorId: user.id,
            targetId: user.id,
            action: 'PASSWORD_RESET_COMPLETED'
          }
        });
      }
    });

    await sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully',
      text: 'Your password has been successfully reset. If you did not perform this action, please contact support immediately.',
      html: '<p>Your password has been successfully reset. If you did not perform this action, please contact support immediately.</p>'
    }).catch(console.error);

    res.json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    _next(error);
  }
});

export default router;
