import crypto from 'crypto';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendEmail } from '../utils/email';
import { ResidencyStatus, Role, MembershipStatus } from '@prisma/client';

const router = Router();

const createInvitationSchema = z.object({
  email: z.string().email('Valid email address is required'),
  name: z.string().optional(),
  role: z.enum(['TENANT', 'CO_OWNER', 'FAMILY_MEMBER']).default('TENANT'),
  unitId: z.string().uuid().optional(), // Will use user's primary unit if not provided
  message: z.string().max(500).optional(),
});

// ──────────────────────────────────────────────────────────
// POST /invitations — Create a new invitation
// ──────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const body = createInvitationSchema.parse(req.body);

    // Determine the unit — must be owned or co-owned by the inviter
    let unitId = body.unitId;
    if (!unitId) {
      // Find the user's primary unit (ownership or co-owner residency)
      const ownership = await prisma.unitOwnership.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { unitId: true },
      });
      if (ownership) {
        unitId = ownership.unitId;
      } else {
        const coOwnerResidency = await prisma.unitResidency.findFirst({
          where: { userId, relationshipType: 'CO_OWNER' as any, status: 'ACTIVE' as any },
          select: { unitId: true },
        });
        unitId = coOwnerResidency?.unitId;
      }
    }

    if (!unitId) {
      return res.status(400).json({ error: { message: 'No unit found. Please specify a unitId or ensure you own a property.' } });
    }

    // Verify the unit exists and user has access
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { community: true } });
    if (!unit) {
      return res.status(404).json({ error: { message: 'Unit not found.' } });
    }

    // Check if inviter is owner or co-owner of this unit
    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId, status: 'ACTIVE' },
    });
    const isCoOwner = await prisma.unitResidency.findFirst({
      where: { userId, unitId, relationshipType: 'CO_OWNER' as any, status: 'ACTIVE' as any },
    });

    if (!isOwner && !isCoOwner) {
      return res.status(403).json({ error: { message: 'Only property owners or co-owners can send invitations.' } });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ error: { message: 'This email is already registered. They can log in directly.' } });
    }

    // Create invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await prisma.$transaction(async (tx) => {
      // Serialize invitations for one unit so concurrent taps/retries cannot
      // create competing links for the same address.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${unitId}))`;
      const existing = await tx.invitation.findFirst({
        where: { email: body.email.toLowerCase(), unitId, status: 'PENDING' as any, expiresAt: { gt: new Date() } },
        include: { unit: true, invitedBy: { select: { firstName: true, lastName: true } } },
      });
      if (existing) return existing;
      await tx.invitation.updateMany({ where: { email: body.email.toLowerCase(), unitId, status: 'PENDING' as any }, data: { status: 'EXPIRED' as any } });
      return tx.invitation.create({
        data: {
          email: body.email.toLowerCase(), name: body.name || null, role: body.role as any,
          unitId, communityId: unit.communityId, invitedById: userId, token,
          status: 'PENDING' as any, message: body.message || null, expiresAt,
        },
        include: { unit: true, invitedBy: { select: { firstName: true, lastName: true } } },
      });
    });

    // An existing pending invitation already has the canonical link. Return it
    // without sending a duplicate email.
    if (invitation.token !== token) {
      return res.status(200).json({ invitation: { ...invitation, invitedBy: undefined } });
    }

    // Send invitation email
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8081';
    const inviteLink = `${FRONTEND_URL}/accept-invitation?token=${token}`;
    const inviterName = [invitation.invitedBy.firstName, invitation.invitedBy.lastName].filter(Boolean).join(' ') || 'A property owner';
    const roleLabel = body.role === 'CO_OWNER' ? 'Co-Owner' : body.role === 'FAMILY_MEMBER' ? 'Family Member' : 'Tenant';

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <div style="background: #143D2A; border-radius: 16px 16px 0 0; padding: 32px; text-align: center;">
          <h1 style="color: #FFFFFF; font-size: 22px; margin: 0; font-weight: 700;">Regency Salma</h1>
          <p style="color: rgba(255,255,255,0.7); font-size: 13px; margin: 6px 0 0;">Residential Community Platform</p>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E8EDE9; border-top: none; border-radius: 0 0 16px 16px; padding: 32px;">
          <h2 style="color: #17221C; font-size: 20px; margin: 0 0 12px;">You've been invited!</h2>
          <p style="color: #506057; font-size: 14px; line-height: 21px; margin: 0 0 20px;">
            ${inviterName} has invited you to join <strong>Unit ${invitation.unit.unitNumber}</strong> at Regency Salma as a <strong>${roleLabel}</strong>.
          </p>
          ${body.message ? `<p style="background: #F3F8F5; border-radius: 10px; padding: 14px; color: #506057; font-size: 13px; line-height: 19px; margin: 0 0 20px; border-left: 3px solid #143D2A;">"${body.message}"</p>` : ''}
          <a href="${inviteLink}" style="display: block; background: #143D2A; color: #FFFFFF; text-align: center; padding: 14px 24px; border-radius: 100px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 0 0 16px;">Accept Invitation</a>
          <p style="color: #718078; font-size: 12px; line-height: 17px; margin: 0; text-align: center;">
            This invitation expires in 7 days. If you didn't expect this, you can safely ignore this email.
          </p>
        </div>
        <p style="color: #718078; font-size: 11px; text-align: center; margin: 16px 0 0;">Regency Salma Township · 42 Palm Avenue</p>
      </div>
    `;

    await sendEmail({
      to: body.email.toLowerCase(),
      subject: `You're invited to join Regency Salma — Unit ${invitation.unit.unitNumber}`,
      text: `${inviterName} has invited you to join Unit ${invitation.unit.unitNumber} at Regency Salma as a ${roleLabel}. Accept here: ${inviteLink}`,
      html: emailHtml,
    }).catch((err) => {
      console.error('Failed to send invitation email:', err);
      // Don't fail the request — email is best-effort in dev
    });

    res.status(201).json({ invitation: { ...invitation, invitedBy: undefined } });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: { message: error.errors?.[0]?.message || 'Invalid input' } });
    }
    next(error);
  }
});

// ──────────────────────────────────────────────────────────
// GET /invitations — List invitations for the user's units
// ──────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Get all units the user owns or co-owns
    const ownerships = await prisma.unitOwnership.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { unitId: true },
    });
    const coOwnerUnits = await prisma.unitResidency.findMany({
      where: { userId, relationshipType: 'CO_OWNER' as any, status: 'ACTIVE' as any },
      select: { unitId: true },
    });
    const unitIds = [...new Set([...ownerships.map((o) => o.unitId), ...coOwnerUnits.map((o) => o.unitId)])];

    if (unitIds.length === 0) {
      return res.json({ invitations: [] });
    }

    const invitations = await prisma.invitation.findMany({
      where: { unitId: { in: unitIds } },
      include: {
        unit: { select: { unitNumber: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ invitations });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────
// POST /invitations/:id/revoke — Revoke an invitation
// ──────────────────────────────────────────────────────────
router.post('/:id/revoke', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const id = typeof req.params.id === 'string' ? req.params.id : '';

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return res.status(404).json({ error: { message: 'Invitation not found.' } });
    }

    // Verify user is owner or co-owner of the unit
    const isOwner = await prisma.unitOwnership.findFirst({
      where: { userId, unitId: invitation.unitId, status: 'ACTIVE' },
    });
    const isCoOwner = await prisma.unitResidency.findFirst({
      where: { userId, unitId: invitation.unitId, relationshipType: 'CO_OWNER' as any, status: 'ACTIVE' as any },
    });

    if (!isOwner && !isCoOwner) {
      return res.status(403).json({ error: { message: 'Only property owners or co-owners can revoke invitations.' } });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: { message: 'Only pending invitations can be revoked.' } });
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: 'REVOKED' as any },
    });

    res.json({ success: true, message: 'Invitation revoked.' });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────
// GET /invitations/accept/:token — Get invitation details (for accept screen)
// ──────────────────────────────────────────────────────────
router.get('/accept/:token', async (req, res, next: NextFunction) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token : '';

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        unit: { select: { unitNumber: true, block: true } },
        invitedBy: { select: { firstName: true, lastName: true } },
        community: { select: { name: true } },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: { message: 'Invitation not found.' } });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: { message: 'This invitation is no longer valid.' } });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' as any } });
      return res.status(400).json({ error: { message: 'This invitation has expired.' } });
    }

    res.json({
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        unitNumber: invitation.unit.unitNumber,
        block: invitation.unit.block,
        communityName: invitation.community.name,
        inviterName: [invitation.invitedBy.firstName, invitation.invitedBy.lastName].filter(Boolean).join(' '),
        message: invitation.message,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ──────────────────────────────────────────────────────────
// POST /invitations/accept/:token — Accept invitation & create account
// ──────────────────────────────────────────────────────────
router.post('/accept/:token', async (req, res, next: NextFunction) => {
  try {
    const token = typeof req.params.token === 'string' ? req.params.token : '';
    const { password, firstName, lastName, phoneNumber } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: { message: 'Password must be at least 8 characters.' } });
    }

    const invitation = await prisma.invitation.findUnique({ where: { token } });
    if (!invitation) {
      return res.status(404).json({ error: { message: 'Invitation not found.' } });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ error: { message: 'This invitation is no longer valid.' } });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' as any } });
      return res.status(400).json({ error: { message: 'This invitation has expired.' } });
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) {
      return res.status(409).json({ error: { message: 'An account with this email already exists. Please log in.' } });
    }

    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(password, 10);

    const roleMap: Record<string, Role> = {
      TENANT: Role.TENANT,
      CO_OWNER: Role.RESIDENT,
      FAMILY_MEMBER: Role.RESIDENT,
    };

    // Create user + residency + membership in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          passwordHash,
          firstName: firstName || invitation.name?.split(' ')[0] || null,
          lastName: lastName || invitation.name?.split(' ').slice(1).join(' ') || null,
          phoneNumber: phoneNumber || null,
          role: roleMap[invitation.role] || Role.RESIDENT,
        },
      });

      // Create residency
      await tx.unitResidency.create({
        data: {
          userId: user.id,
          unitId: invitation.unitId,
          relationshipType: invitation.role as any,
          status: ResidencyStatus.PENDING,
        },
      });

      // Create membership
      await tx.membership.create({
        data: {
          userId: user.id,
          communityId: invitation.communityId,
          unitId: invitation.unitId,
          role: roleMap[invitation.role] || Role.RESIDENT,
          status: MembershipStatus.PENDING,
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' as any, acceptedById: user.id },
      });

      return user;
    });

    // Generate tokens for immediate login
    const { generateTokens } = await import('../utils/jwt.js');
    const tokens = generateTokens(result.id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Your access is pending owner approval.',
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
