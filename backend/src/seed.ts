import { prisma } from './prisma';
import bcrypt from 'bcrypt';
import {
  Role,
  PersonnelCategory,
  AvailabilityStatus,
  OwnershipStatus,
  ResidencyStatus,
  ResidencyType,
  SpaceType,
  SpaceAccessType,
} from '@prisma/client';

export async function seedDatabase() {
  console.log('--- Seeding Regency Salma Database ---');
  try {
    const defaultPassword = await bcrypt.hash('password123', 10);

    // =========================================================================
    // 1. Community & Units
    // =========================================================================
    let community = await prisma.community.findFirst({
      where: { name: 'Regency Salma Township' },
    });
    if (!community) {
      community = await prisma.community.create({
        data: {
          name: 'Regency Salma Township',
          address: '42 Palm Avenue, Regency Salma, Bengaluru - 560037',
        },
      });
    }

    const unitConfigs = [
      { unitNumber: '9A', floor: '9', block: 'Penthouse Tower' },
      { unitNumber: '9B', floor: '9', block: 'Penthouse Tower' },
      { unitNumber: '10A', floor: '10', block: 'Sky Tower' },
    ];

    const units: Record<string, any> = {};
    for (const u of unitConfigs) {
      let unit = await prisma.unit.findFirst({
        where: { communityId: community.id, unitNumber: u.unitNumber },
      });
      if (!unit) {
        unit = await prisma.unit.create({
          data: {
            communityId: community.id,
            unitNumber: u.unitNumber,
            floor: u.floor,
            block: u.block,
          },
        });
      }
      units[u.unitNumber] = unit;
    }

    // =========================================================================
    // 2. User Accounts
    // =========================================================================

    // --- Leadership (room 9A) ---
    const leadership = await prisma.user.upsert({
      where: { email: 'leadership@regency.com' },
      update: { role: Role.LEADERSHIP, unitNumber: '9A', passwordHash: defaultPassword },
      create: {
        email: 'leadership@regency.com',
        passwordHash: defaultPassword,
        firstName: 'Anand',
        lastName: 'Sharma',
        phoneNumber: '+91 98000 00001',
        unitNumber: '9A',
        role: Role.LEADERSHIP,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: leadership.id, communityId: community.id, role: Role.LEADERSHIP } },
      update: { status: 'APPROVED' },
      create: { userId: leadership.id, communityId: community.id, unitId: units['9A'].id, role: Role.LEADERSHIP, status: 'APPROVED' },
    });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: leadership.id, unitId: units['9A'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: leadership.id, unitId: units['9A'].id, status: OwnershipStatus.ACTIVE },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: leadership.id, unitId: units['9A'].id, relationshipType: ResidencyType.OWNER } },
      update: { status: ResidencyStatus.ACTIVE },
      create: {
        userId: leadership.id,
        unitId: units['9A'].id,
        relationshipType: ResidencyType.OWNER,
        status: ResidencyStatus.ACTIVE,
        verifiedById: leadership.id,
        verifiedAt: new Date(),
      },
    });

    // --- Resident + Owner (room 9B) ---
    const residentOwner = await prisma.user.upsert({
      where: { email: 'resident@regency.com' },
      update: { role: Role.OWNER, unitNumber: '9B', passwordHash: defaultPassword },
      create: {
        email: 'resident@regency.com',
        passwordHash: defaultPassword,
        firstName: 'Rohan',
        lastName: 'Mehta',
        phoneNumber: '+91 98765 00000',
        unitNumber: '9B',
        role: Role.OWNER,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: residentOwner.id, communityId: community.id, role: Role.OWNER } },
      update: { status: 'APPROVED' },
      create: { userId: residentOwner.id, communityId: community.id, unitId: units['9B'].id, role: Role.OWNER, status: 'APPROVED' },
    });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: residentOwner.id, unitId: units['9B'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: residentOwner.id, unitId: units['9B'].id, status: OwnershipStatus.ACTIVE },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: residentOwner.id, unitId: units['9B'].id, relationshipType: ResidencyType.OWNER } },
      update: { status: ResidencyStatus.ACTIVE },
      create: {
        userId: residentOwner.id,
        unitId: units['9B'].id,
        relationshipType: ResidencyType.OWNER,
        status: ResidencyStatus.ACTIVE,
        verifiedById: residentOwner.id,
        verifiedAt: new Date(),
      },
    });

    // --- Family Member (room 9B, linked to resident owner) ---
    const familyMember = await prisma.user.upsert({
      where: { email: 'family@regency.com' },
      update: { role: Role.RESIDENT, unitNumber: '9B', passwordHash: defaultPassword },
      create: {
        email: 'family@regency.com',
        passwordHash: defaultPassword,
        firstName: 'Priya',
        lastName: 'Mehta',
        phoneNumber: '+91 98765 00001',
        unitNumber: '9B',
        role: Role.RESIDENT,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: familyMember.id, communityId: community.id, role: Role.RESIDENT } },
      update: { status: 'APPROVED' },
      create: { userId: familyMember.id, communityId: community.id, unitId: units['9B'].id, role: Role.RESIDENT, status: 'APPROVED' },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: familyMember.id, unitId: units['9B'].id, relationshipType: ResidencyType.TENANT } },
      update: { status: ResidencyStatus.ACTIVE, verifiedById: residentOwner.id, verifiedAt: new Date() },
      create: {
        userId: familyMember.id,
        unitId: units['9B'].id,
        relationshipType: ResidencyType.TENANT,
        status: ResidencyStatus.ACTIVE,
        verifiedById: residentOwner.id,
        verifiedAt: new Date(),
      },
    });

    // Also create a HouseholdMember record for the family member
    await prisma.householdMember.create({
      data: {
        unitId: units['9B'].id,
        createdById: residentOwner.id,
        name: 'Priya Mehta',
        relationship: 'Spouse',
        phone: '+91 98765 00001',
        email: 'family@regency.com',
        status: 'ACTIVE',
        communityId: community.id,
      },
    });

    // --- Manager ---
    const manager = await prisma.user.upsert({
      where: { email: 'manager@regency.com' },
      update: { role: Role.MANAGER, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'manager@regency.com',
        passwordHash: defaultPassword,
        firstName: 'Kavita',
        lastName: 'Deshmukh',
        phoneNumber: '+91 98765 43210',
        role: Role.MANAGER,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: manager.id, communityId: community.id, role: Role.MANAGER } },
      update: { status: 'APPROVED' },
      create: { userId: manager.id, communityId: community.id, role: Role.MANAGER, status: 'APPROVED' },
    });

    // --- Watchman / Security ---
    const watchman = await prisma.user.upsert({
      where: { email: 'watchman@regency.com' },
      update: { role: Role.WORKFORCE, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'watchman@regency.com',
        passwordHash: defaultPassword,
        firstName: 'Rajesh',
        lastName: 'Kumar',
        phoneNumber: '+91 98444 55667',
        role: Role.WORKFORCE,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: watchman.id, communityId: community.id, role: Role.WORKFORCE } },
      update: { status: 'APPROVED', requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
      create: { userId: watchman.id, communityId: community.id, role: Role.WORKFORCE, status: 'APPROVED', requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
    });

    // Create Personnel record for watchman
    await prisma.personnel.create({
      data: {
        name: 'Rajesh Kumar',
        phone: '+91 98444 55667',
        userId: watchman.id,
        category: PersonnelCategory.SECURITY,
        department: 'SECURITY',
        designation: 'Main Gate Security Officer',
        availabilityStatus: AvailabilityStatus.AVAILABLE,
        communityId: community.id,
      },
    });

    // =========================================================================
    // 3. Community Spaces
    // =========================================================================
    console.log('Seeding Community Spaces...');

    const leadershipSpace = await prisma.space.upsert({
      where: { id: `leadership-ops-${community.id}` },
      update: {},
      create: {
        id: `leadership-ops-${community.id}`,
        name: 'Leadership Operations',
        type: SpaceType.LEADERSHIP_OPERATIONS,
        communityId: community.id,
      },
    });

    const ownersSpace = await prisma.space.upsert({
      where: { id: `owners-${community.id}` },
      update: {},
      create: {
        id: `owners-${community.id}`,
        name: 'Owners Forum',
        type: SpaceType.OWNER_COMMUNITY,
        communityId: community.id,
      },
    });

    const residentsSpace = await prisma.space.upsert({
      where: { id: `residents-${community.id}` },
      update: {},
      create: {
        id: `residents-${community.id}`,
        name: 'Resident Community',
        type: SpaceType.RESIDENT_COMMUNITY,
        communityId: community.id,
      },
    });

    const emergencySpace = await prisma.space.upsert({
      where: { id: `emergency-${community.id}` },
      update: {},
      create: {
        id: `emergency-${community.id}`,
        name: 'Emergency Coordination',
        type: SpaceType.EMERGENCY,
        communityId: community.id,
      },
    });

    // Space access rules
    const spaces = [leadershipSpace, ownersSpace, residentsSpace, emergencySpace];
    for (const space of spaces) {
      const existingRule = await prisma.spaceAccessRule.findFirst({
        where: { spaceId: space.id },
      });
      if (!existingRule) {
        let accessType: SpaceAccessType = SpaceAccessType.ALL_COMMUNITY;
        if (space.type === SpaceType.LEADERSHIP_OPERATIONS) accessType = SpaceAccessType.LEADERSHIP;
        else if (space.type === SpaceType.OWNER_COMMUNITY) accessType = SpaceAccessType.OWNERS;
        else if (space.type === SpaceType.RESIDENT_COMMUNITY) accessType = SpaceAccessType.ACTIVE_RESIDENTS;

        await prisma.spaceAccessRule.create({
          data: {
            spaceId: space.id,
            accessType,
          },
        });
      }
    }

    // =========================================================================
    // Done
    // =========================================================================
    console.log('--- Seed Complete ---');
    console.log('');
    console.log('Accounts created:');
    console.log('  leadership@regency.com  | password123 | LEADERSHIP  | Unit 9A');
    console.log('  resident@regency.com    | password123 | OWNER       | Unit 9B');
    console.log('  family@regency.com      | password123 | RESIDENT    | Unit 9B');
    console.log('  manager@regency.com     | password123 | MANAGER     | —');
    console.log('  watchman@regency.com    | password123 | WORKFORCE   | SECURITY');

  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}
