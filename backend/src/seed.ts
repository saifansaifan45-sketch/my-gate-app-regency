import { prisma } from './prisma';
import bcrypt from 'bcrypt';
import {
  Role,
  PersonnelCategory,
  AvailabilityStatus,
  AttendanceStatus,
  TicketPriority,
  TicketStatus,
  TaskStatus,
  OwnershipStatus,
  ResidencyStatus,
  ResidencyType,
  SpaceType,
  SpaceAccessType,
  PostType,
  PollStatus,
} from '@prisma/client';

export async function seedDatabase() {
  console.log('--- Starting Realistic Golden Dataset Seed for Regency Salma ---');
  try {
    const defaultPassword = await bcrypt.hash('password123', 10);

    // =========================================================================
    // 1. Township Community & Standard Regency Salma Property Units
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
      { unitNumber: 'GA', floor: 'G', block: 'Ground Wing' },
      { unitNumber: 'GB', floor: 'G', block: 'Ground Wing' },
      { unitNumber: '1A', floor: '1', block: 'Tower A' },
      { unitNumber: '1B', floor: '1', block: 'Tower A' },
      { unitNumber: '2A', floor: '2', block: 'Tower A' },
      { unitNumber: '2B', floor: '2', block: 'Tower A' },
      { unitNumber: '9A', floor: '9', block: 'Penthouse Tower' },
      { unitNumber: '9B', floor: '9', block: 'Penthouse Tower' },
      { unitNumber: '10A', floor: '10', block: 'Sky Tower' },
      { unitNumber: '10B', floor: '10', block: 'Sky Tower' },
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
    // 2. Realistic User Personas & Relationships
    // =========================================================================

    // -------------------------------------------------------------------------
    // Scenario 1: Township President / Leadership (Anand Sharma)
    // -------------------------------------------------------------------------
    const president = await prisma.user.upsert({
      where: { email: 'president@regencysalma.com' },
      update: { role: Role.LEADERSHIP, unitNumber: '10A', passwordHash: defaultPassword },
      create: {
        email: 'president@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Anand',
        lastName: 'Sharma',
        phoneNumber: '+91 98000 00001',
        unitNumber: '10A',
        role: Role.LEADERSHIP,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: president.id, communityId: community.id, role: Role.LEADERSHIP } },
      update: { status: 'APPROVED' },
      create: { userId: president.id, communityId: community.id, unitId: units['10A'].id, role: Role.LEADERSHIP, status: 'APPROVED' },
    });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: president.id, unitId: units['10A'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: president.id, unitId: units['10A'].id, status: OwnershipStatus.ACTIVE },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: president.id, unitId: units['10A'].id, relationshipType: ResidencyType.OWNER } },
      update: { status: ResidencyStatus.ACTIVE },
      create: {
        userId: president.id,
        unitId: units['10A'].id,
        relationshipType: ResidencyType.OWNER,
        status: ResidencyStatus.ACTIVE,
        verifiedById: president.id,
        verifiedAt: new Date(),
      },
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Dedicated Operations Manager (Kavita Deshmukh) — No property ownership
    // -------------------------------------------------------------------------
    const manager = await prisma.user.upsert({
      where: { email: 'manager@regencysalma.com' },
      update: { role: Role.MANAGER, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'manager@regencysalma.com',
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

    // Clean any accidental ownerships/residencies for pure manager
    await prisma.unitOwnership.deleteMany({ where: { userId: manager.id } });
    await prisma.unitResidency.deleteMany({ where: { userId: manager.id } });

    // -------------------------------------------------------------------------
    // Scenario 3: Resident Owner (Rohan Mehta) — Unit 9A Owner + Active Resident
    // -------------------------------------------------------------------------
    const residentRohan = await prisma.user.upsert({
      where: { email: 'rohan@regencysalma.com' },
      update: { role: Role.OWNER, unitNumber: '9A', passwordHash: defaultPassword },
      create: {
        email: 'rohan@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Rohan',
        lastName: 'Mehta',
        phoneNumber: '+91 98765 00000',
        unitNumber: '9A',
        role: Role.OWNER,
      },
    });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: residentRohan.id, unitId: units['9A'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: residentRohan.id, unitId: units['9A'].id, status: OwnershipStatus.ACTIVE },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: residentRohan.id, unitId: units['9A'].id, relationshipType: ResidencyType.OWNER } },
      update: { status: ResidencyStatus.ACTIVE },
      create: {
        userId: residentRohan.id,
        unitId: units['9A'].id,
        relationshipType: ResidencyType.OWNER,
        status: ResidencyStatus.ACTIVE,
        verifiedById: residentRohan.id,
        verifiedAt: new Date(),
      },
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Landlord / Multi-Unit Owner (Vikram Verma) — Owns 9B & 10B (No residency)
    // -------------------------------------------------------------------------
    const landlord = await prisma.user.upsert({
      where: { email: 'landlord@regencysalma.com' },
      update: { role: Role.OWNER, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'landlord@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Vikram',
        lastName: 'Verma',
        phoneNumber: '+91 98111 00001',
        role: Role.OWNER,
      },
    });

    // Clean any residencies for non-resident landlord
    await prisma.unitResidency.deleteMany({ where: { userId: landlord.id } });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: landlord.id, unitId: units['9B'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: landlord.id, unitId: units['9B'].id, status: OwnershipStatus.ACTIVE },
    });

    await prisma.unitOwnership.upsert({
      where: { userId_unitId: { userId: landlord.id, unitId: units['10B'].id } },
      update: { status: OwnershipStatus.ACTIVE },
      create: { userId: landlord.id, unitId: units['10B'].id, status: OwnershipStatus.ACTIVE },
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Approved Tenant (Ahmed Khan) — Active Resident in Unit 9B
    // -------------------------------------------------------------------------
    const approvedTenant = await prisma.user.upsert({
      where: { email: 'tenant@regencysalma.com' },
      update: { role: Role.TENANT, unitNumber: '9B', passwordHash: defaultPassword },
      create: {
        email: 'tenant@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Ahmed',
        lastName: 'Khan',
        phoneNumber: '+91 98222 00002',
        unitNumber: '9B',
        role: Role.TENANT,
      },
    });

    await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: approvedTenant.id, unitId: units['9B'].id, relationshipType: ResidencyType.TENANT } },
      update: { status: ResidencyStatus.ACTIVE, verifiedById: landlord.id, verifiedAt: new Date() },
      create: {
        userId: approvedTenant.id,
        unitId: units['9B'].id,
        relationshipType: ResidencyType.TENANT,
        status: ResidencyStatus.ACTIVE,
        verifiedById: landlord.id,
        verifiedAt: new Date(),
      },
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Pending Tenant Applicant (Priya Nair) — Applied for Unit 10B
    // -------------------------------------------------------------------------
    const pendingTenant = await prisma.user.upsert({
      where: { email: 'pending.tenant@regencysalma.com' },
      update: { role: Role.TENANT, unitNumber: '10B', passwordHash: defaultPassword },
      create: {
        email: 'pending.tenant@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Priya',
        lastName: 'Nair',
        phoneNumber: '+91 98444 00004',
        unitNumber: '10B',
        role: Role.TENANT,
      },
    });

    const priyaResidency = await prisma.unitResidency.upsert({
      where: { userId_unitId_relationshipType: { userId: pendingTenant.id, unitId: units['10B'].id, relationshipType: ResidencyType.TENANT } },
      update: { status: ResidencyStatus.PENDING, verifiedById: null, verifiedAt: null },
      create: {
        userId: pendingTenant.id,
        unitId: units['10B'].id,
        relationshipType: ResidencyType.TENANT,
        status: ResidencyStatus.PENDING,
      },
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Community Workforce Staff (Security & Maintenance) — No property
    // -------------------------------------------------------------------------
    const securityStaff = await prisma.user.upsert({
      where: { email: 'security@regencysalma.com' },
      update: { role: Role.WORKFORCE, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'security@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Rajesh',
        lastName: 'Kumar',
        phoneNumber: '+91 98444 55667',
        role: Role.WORKFORCE,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: securityStaff.id, communityId: community.id, role: Role.WORKFORCE } },
      update: { status: 'APPROVED', requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
      create: { userId: securityStaff.id, communityId: community.id, role: Role.WORKFORCE, status: 'APPROVED', requestedCategory: 'SECURITY', requestedDepartment: 'SECURITY' },
    });

    const maintenanceStaff = await prisma.user.upsert({
      where: { email: 'maintenance@regencysalma.com' },
      update: { role: Role.WORKFORCE, unitNumber: null, passwordHash: defaultPassword },
      create: {
        email: 'maintenance@regencysalma.com',
        passwordHash: defaultPassword,
        firstName: 'Sunil',
        lastName: 'Sharma',
        phoneNumber: '+91 98222 33445',
        role: Role.WORKFORCE,
      },
    });

    await prisma.membership.upsert({
      where: { userId_communityId_role: { userId: maintenanceStaff.id, communityId: community.id, role: Role.WORKFORCE } },
      update: { status: 'APPROVED', requestedCategory: 'ELECTRICIAN', requestedDepartment: 'MAINTENANCE' },
      create: { userId: maintenanceStaff.id, communityId: community.id, role: Role.WORKFORCE, status: 'APPROVED', requestedCategory: 'ELECTRICIAN', requestedDepartment: 'MAINTENANCE' },
    });


    // =========================================================================
    // 3. Community Spaces & Access Rules
    // =========================================================================
    console.log('Seeding Community Spaces with Access Rules...');

    // Space 1: Leadership Operations
    let leadershipSpace = await prisma.space.findFirst({
      where: { communityId: community.id, type: SpaceType.LEADERSHIP_OPERATIONS },
    });
    if (!leadershipSpace) {
      leadershipSpace = await prisma.space.create({
        data: {
          communityId: community.id,
          name: 'Leadership Operations',
          description: 'Official committee workspace for managing township decisions, staff, and operations.',
          type: SpaceType.LEADERSHIP_OPERATIONS,
          accessRules: {
            create: [
              { accessType: SpaceAccessType.LEADERSHIP },
              { accessType: SpaceAccessType.MANAGERS },
            ],
          },
        },
      });
    }

    // Space 2: Owners Community
    let ownersSpace = await prisma.space.findFirst({
      where: { communityId: community.id, type: SpaceType.OWNER_COMMUNITY },
    });
    if (!ownersSpace) {
      ownersSpace = await prisma.space.create({
        data: {
          communityId: community.id,
          name: 'Owners Community',
          description: 'Exclusive forum for property owners to discuss asset enhancement, maintenance corpus, and voting.',
          type: SpaceType.OWNER_COMMUNITY,
          accessRules: {
            create: [
              { accessType: SpaceAccessType.OWNERS },
              { accessType: SpaceAccessType.LEADERSHIP },
              { accessType: SpaceAccessType.MANAGERS },
            ],
          },
        },
      });
    }

    // Space 3: Residents Community
    let residentsSpace = await prisma.space.findFirst({
      where: { communityId: community.id, type: SpaceType.RESIDENT_COMMUNITY },
    });
    if (!residentsSpace) {
      residentsSpace = await prisma.space.create({
        data: {
          communityId: community.id,
          name: 'Residents Community',
          description: 'Township-wide neighborhood hub for discussions, sports, and weekend events.',
          type: SpaceType.RESIDENT_COMMUNITY,
          accessRules: {
            create: [
              { accessType: SpaceAccessType.ACTIVE_RESIDENTS },
              { accessType: SpaceAccessType.LEADERSHIP },
              { accessType: SpaceAccessType.MANAGERS },
            ],
          },
        },
      });
    }

    // Space 4: Emergency Alerts
    let emergencySpace = await prisma.space.findFirst({
      where: { communityId: community.id, type: SpaceType.EMERGENCY },
    });
    if (!emergencySpace) {
      emergencySpace = await prisma.space.create({
        data: {
          communityId: community.id,
          name: 'Emergency Alerts',
          description: 'High-priority township security alerts, power backup status, and emergency broadcasts.',
          type: SpaceType.EMERGENCY,
          accessRules: {
            create: [{ accessType: SpaceAccessType.ALL_COMMUNITY }],
          },
        },
      });
    }

    // =========================================================================
    // 4. Sample Posts, Polls & Broadcasts
    // =========================================================================
    await prisma.announcement.deleteMany({
      where: { spaceId: { in: [leadershipSpace.id, ownersSpace.id, residentsSpace.id, emergencySpace.id] } },
    }).catch(() => {});

    await prisma.communityPost.deleteMany({
      where: { spaceId: { in: [residentsSpace.id, ownersSpace.id] } },
    }).catch(() => {});

    await prisma.communityPost.createMany({
      data: [
        {
          spaceId: residentsSpace.id,
          authorId: residentRohan.id,
          type: PostType.EVENT,
          content: 'Township Weekend Farmers Market & Organic Produce Stall is coming to the Central Clubhouse lawns this Saturday 8 AM to 12 PM!',
        },
        {
          spaceId: residentsSpace.id,
          authorId: approvedTenant.id,
          type: PostType.DISCUSSION,
          content: 'Looking for badminton partners for early morning games at the indoor sports complex (Court 2). Ping me if interested!',
        },
        {
          spaceId: ownersSpace.id,
          authorId: landlord.id,
          type: PostType.UPDATE,
          content: 'Solar rooftop installation RFP proposals have been received from 3 vendors. Detailed financial projections uploaded for review.',
        },
      ],
    });

    await prisma.poll.deleteMany({
      where: { spaceId: { in: [residentsSpace.id, ownersSpace.id] } },
    }).catch(() => {});

    const weekendPoll = await prisma.poll.create({
      data: {
        spaceId: residentsSpace.id,
        authorId: residentRohan.id,
        question: 'Which movie should we screen at the Open-Air Amphitheater this Saturday?',
        status: PollStatus.ACTIVE,
        options: {
          create: [
            { text: 'Interstellar (Sci-Fi)' },
            { text: 'The Lion King (Family / Kids)' },
            { text: 'Top Gun: Maverick (Action)' },
          ],
        },
      },
      include: { options: true },
    });

    const opt0 = weekendPoll.options[0];
    const opt1 = weekendPoll.options[1];
    if (opt0 && opt1) {
      await prisma.pollVote.createMany({
        data: [
          { pollId: weekendPoll.id, optionId: opt0.id, userId: residentRohan.id },
          { pollId: weekendPoll.id, optionId: opt0.id, userId: approvedTenant.id },
          { pollId: weekendPoll.id, optionId: opt1.id, userId: landlord.id },
        ],
      });
    }

    // =========================================================================
    // 5. Personnel & Daily Attendance
    // =========================================================================
    const personnelSeeds = [
      { name: 'Rahul Kumar', phone: '+91 98111 22334', category: PersonnelCategory.PLUMBER, department: 'MAINTENANCE', designation: 'Plumbing Specialist', availabilityStatus: AvailabilityStatus.AVAILABLE },
      { name: 'Sunil Sharma', phone: '+91 98222 33445', userId: maintenanceStaff.id, category: PersonnelCategory.ELECTRICIAN, department: 'MAINTENANCE', designation: 'Lead Electrician', availabilityStatus: AvailabilityStatus.BUSY },
      { name: 'Suresh Patel', phone: '+91 98333 44556', category: PersonnelCategory.CLEANER, department: 'HOUSEKEEPING', designation: 'Floor Cleaner', availabilityStatus: AvailabilityStatus.AVAILABLE },
      { name: 'Rajesh Kumar', phone: '+91 98444 55667', userId: securityStaff.id, category: PersonnelCategory.SECURITY, department: 'SECURITY', designation: 'Main Gate Security Officer', availabilityStatus: AvailabilityStatus.AVAILABLE },
      { name: 'Mohan Das', phone: '+91 98555 66778', category: PersonnelCategory.GARDENER, department: 'GARDENING', designation: 'Landscape Gardener', availabilityStatus: AvailabilityStatus.OFF_DUTY },
      { name: 'Rajesh Sharma', phone: '+91 98666 77889', category: PersonnelCategory.MAINTENANCE, department: 'MAINTENANCE', designation: 'HVAC Technician', availabilityStatus: AvailabilityStatus.LEAVE },
    ];

    const personnelMap: Record<string, any> = {};
    for (const p of personnelSeeds) {
      let person = await prisma.personnel.findFirst({ where: { phone: p.phone } });
      if (!person) {
        person = await prisma.personnel.create({
          data: {
            name: p.name,
            phone: p.phone,
            userId: (p as any).userId,
            category: p.category,
            department: (p as any).department,
            designation: (p as any).designation,
            availabilityStatus: p.availabilityStatus,
            communityId: community.id,
          },
        });
      } else {
        person = await prisma.personnel.update({
          where: { id: person.id },
          data: {
            name: p.name,
            userId: (p as any).userId || person.userId,
            availabilityStatus: p.availabilityStatus,
            category: p.category,
            department: (p as any).department || person.department,
            designation: (p as any).designation || person.designation,
          },
        });
      }
      personnelMap[p.name] = person;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendanceSeeds = [
      { name: 'Rahul Kumar', status: AttendanceStatus.PRESENT, checkInHour: 9, checkInMin: 0, remarks: 'On time for morning shift' },
      { name: 'Arun Singh', status: AttendanceStatus.PRESENT, checkInHour: 9, checkInMin: 15, remarks: 'Assigned to urgent electrical call' },
      { name: 'Suresh Patel', status: AttendanceStatus.PRESENT, checkInHour: 8, checkInMin: 30, remarks: 'Tower A cleaning sweep' },
      { name: 'Vikram Rathore', status: AttendanceStatus.PRESENT, checkInHour: 8, checkInMin: 0, remarks: 'Main gate duty' },
      { name: 'Mohan Das', status: AttendanceStatus.ABSENT, remarks: 'Scheduled weekly off' },
      { name: 'Rajesh Sharma', status: AttendanceStatus.LEAVE, remarks: 'Approved medical leave' },
    ];

    for (const att of attendanceSeeds) {
      const person = personnelMap[att.name];
      if (!person) continue;

      const existingAtt = await prisma.attendance.findFirst({
        where: { personnelId: person.id, date: { gte: today } },
      });

      let checkInTime = null;
      if (att.status === AttendanceStatus.PRESENT) {
        checkInTime = new Date(today);
        checkInTime.setHours(att.checkInHour || 9, att.checkInMin || 0, 0, 0);
      }

      if (existingAtt) {
        await prisma.attendance.update({
          where: { id: existingAtt.id },
          data: { status: att.status, checkIn: checkInTime, remarks: att.remarks },
        });
      } else {
        await prisma.attendance.create({
          data: { personnelId: person.id, date: today, status: att.status, checkIn: checkInTime, remarks: att.remarks },
        });
      }
    }

    // =========================================================================
    // 6. Tickets & Tasks
    // =========================================================================
    let t1 = await prisma.ticket.findFirst({ where: { title: 'Bathroom Pipe Leakage' } });
    if (!t1) {
      t1 = await prisma.ticket.create({
        data: {
          residentId: residentRohan.id,
          unitId: units['9A'].id,
          communityId: community.id,
          category: 'Plumbing',
          title: 'Bathroom Pipe Leakage',
          description: 'Water spraying from under the washbasin pipe in the master bathroom.',
          priority: TicketPriority.HIGH,
          status: TicketStatus.IN_PROGRESS,
        },
      });

      await prisma.task.create({
        data: {
          ticketId: t1.id,
          assignedPersonnelId: personnelMap['Rahul Kumar'].id,
          assignedById: manager.id,
          status: TaskStatus.IN_PROGRESS,
          startedAt: new Date(Date.now() - 1000 * 60 * 45),
          remarks: 'Replacing damaged brass coupling and washer.',
        },
      });
    }

    let t2 = await prisma.ticket.findFirst({ where: { title: 'Power Tripping in Master Bedroom' } });
    if (!t2) {
      t2 = await prisma.ticket.create({
        data: {
          residentId: approvedTenant.id,
          unitId: units['9B'].id,
          communityId: community.id,
          category: 'Electrical',
          title: 'Power Tripping in Master Bedroom',
          description: 'Circuit breaker trips instantly whenever AC or heavy appliance is powered on.',
          priority: TicketPriority.URGENT,
          status: TicketStatus.ASSIGNED,
        },
      });

      await prisma.task.create({
        data: {
          ticketId: t2.id,
          assignedPersonnelId: personnelMap['Sunil Sharma'].id,
          assignedById: manager.id,
          status: TaskStatus.ASSIGNED,
          remarks: 'Investigating MCB distribution board wiring.',
        },
      });
    }

    // =========================================================================
    // 7. Notifications
    // =========================================================================
    await prisma.notification.deleteMany({
      where: {
        userId: { in: [manager.id, president.id, landlord.id, residentRohan.id, approvedTenant.id, pendingTenant.id] },
      },
    }).catch(() => {});

    await prisma.notification.createMany({
      data: [
        {
          userId: manager.id,
          type: 'NEW_TICKET',
          title: 'New Maintenance Request',
          message: 'Ahmed Khan (Tenant, Unit 9B) reported: Power Tripping in Master Bedroom',
          readStatus: false,
          metadata: { ticketId: t2.id, unitNumber: '9B' },
        },
        {
          userId: landlord.id,
          type: 'TENANT_VERIFICATION_REQUEST',
          title: 'Tenant Verification Request',
          message: 'Priya Nair (pending.tenant@regencysalma.com) requested residency verification for Unit 10B.',
          readStatus: false,
          metadata: {
            unitId: units['10B'].id,
            unitNumber: '10B',
            residencyId: priyaResidency.id,
            applicantId: pendingTenant.id,
            applicantName: 'Priya Nair',
          },
        },
        {
          userId: approvedTenant.id,
          type: 'RESIDENCY_APPROVED',
          title: 'Residency Access Approved',
          message: 'Your tenancy residency for Unit 9B has been verified and approved by the property owner.',
          readStatus: true,
          metadata: { unitId: units['9B'].id, unitNumber: '9B' },
        },
      ],
    });

    console.log('✅ Regency Salma Golden Dataset + Community Spaces successfully seeded!');
  } catch (error) {
    console.error('Error seeding golden dataset with community spaces:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
