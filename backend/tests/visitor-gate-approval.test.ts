import request from 'supertest';
import { Department, MembershipStatus, PersonnelCategory, Role, VisitorStatus } from '@prisma/client';
import app from '../src/index';
import { prisma } from '../src/prisma';
import { generateTokens } from '../src/utils/jwt';

const api = request(app);
const suffix = `gate-flow-${Date.now()}`;
const residentEmail = `${suffix}-resident@example.test`;
const securityEmail = `${suffix}-security@example.test`;

describe('Visitor resident approval and gate verification', () => {
  let communityId: string;
  let unitId: string;
  let residentId: string;
  let securityId: string;
  let residentToken: string;
  let securityToken: string;

  beforeAll(async () => {
    const community = await prisma.community.create({
      data: { name: `Visitor flow ${suffix}`, address: 'Test Gate, Regency Salma' },
    });
    communityId = community.id;
    const unit = await prisma.unit.create({ data: { communityId, unitNumber: 'TEST-101' } });
    unitId = unit.id;

    const resident = await prisma.user.create({
      data: { email: residentEmail, passwordHash: 'test-only', firstName: 'Aarav', lastName: 'Resident', role: Role.RESIDENT },
    });
    residentId = resident.id;
    residentToken = generateTokens(resident.id).accessToken;
    await prisma.unitResidency.create({
      data: { userId: resident.id, unitId, relationshipType: 'TENANT', status: 'ACTIVE' },
    });

    const security = await prisma.user.create({
      data: { email: securityEmail, passwordHash: 'test-only', firstName: 'Sana', lastName: 'Security', role: Role.WORKFORCE },
    });
    securityId = security.id;
    securityToken = generateTokens(security.id).accessToken;
    await prisma.membership.create({
      data: { userId: security.id, communityId, role: Role.WORKFORCE, status: MembershipStatus.APPROVED },
    });
    await prisma.personnel.create({
      data: {
        userId: security.id,
        name: 'Sana Security',
        phone: '+91 90000 00000',
        category: PersonnelCategory.SECURITY,
        department: Department.SECURITY,
        communityId,
      },
    });
  });

  afterAll(async () => {
    if (!communityId || !residentId || !securityId || !unitId) return;
    await prisma.notification.deleteMany({ where: { userId: { in: [residentId, securityId] } } });
    await prisma.auditLog.deleteMany({ where: { communityId } });
    await prisma.visitor.deleteMany({ where: { communityId } });
    await prisma.personnel.deleteMany({ where: { userId: securityId } });
    await prisma.membership.deleteMany({ where: { userId: securityId } });
    await prisma.unitResidency.deleteMany({ where: { userId: residentId } });
    await prisma.user.deleteMany({ where: { id: { in: [residentId, securityId] } } });
    await prisma.unit.delete({ where: { id: unitId } });
    await prisma.community.delete({ where: { id: communityId } });
  });

  it('generates a guest OTP after resident approval and verifies it at the gate', async () => {
    const create = await api.post('/visitors').set('Authorization', `Bearer ${residentToken}`).send({
      name: 'Rohan Guest',
      visitorType: 'GUEST',
      isPreApproved: false,
    });
    expect(create.status).toBe(201);
    expect(create.body.visitor.status).toBe(VisitorStatus.PENDING);
    expect(create.body.visitor.otp).toBeUndefined();

    const approve = await api.post(`/visitors/${create.body.visitor.id}/approve`).set('Authorization', `Bearer ${residentToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.visitor.status).toBe(VisitorStatus.APPROVED);
    expect(approve.body.visitor.otp).toMatch(/^\d{6}$/);

    const wrongCode = await api.post(`/visitors/${create.body.visitor.id}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({ otp: '000000' });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.message).toBe('Invalid OTP');

    const checkIn = await api.post(`/visitors/${create.body.visitor.id}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({ otp: approve.body.visitor.otp });
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.visitor.status).toBe(VisitorStatus.CHECKED_IN);
  });

  it('alerts the resident about an unannounced delivery, then allows security to confirm approved entry without OTP', async () => {
    const arrival = await api.post('/visitors/unannounced').set('Authorization', `Bearer ${securityToken}`).send({
      name: 'Anaya Delivery Agent',
      provider: 'Amazon',
      visitorType: 'DELIVERY',
      unitId,
    });
    expect(arrival.status).toBe(201);
    expect(arrival.body.visitor.status).toBe(VisitorStatus.PENDING);

    const alert = await prisma.notification.findFirst({
      where: { userId: residentId, type: 'UNANNOUNCED_ARRIVAL', metadata: { path: ['visitorId'], equals: arrival.body.visitor.id } },
    });
    expect(alert?.title).toBe('DELIVERY at the Gate');

    const approve = await api.post(`/visitors/${arrival.body.visitor.id}/approve`).set('Authorization', `Bearer ${residentToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.visitor.status).toBe(VisitorStatus.APPROVED);
    expect(approve.body.visitor.otp).toBeUndefined();

    const checkIn = await api.post(`/visitors/${arrival.body.visitor.id}/check-in`).set('Authorization', `Bearer ${securityToken}`).send({});
    expect(checkIn.status).toBe(200);
    expect(checkIn.body.visitor.status).toBe(VisitorStatus.CHECKED_IN);
  });
});
