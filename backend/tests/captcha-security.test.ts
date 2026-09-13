import supertest from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import app from '../src/index';
import { prisma } from '../src/prisma';
import bcrypt from 'bcrypt';
import { generateCaptcha, validateCaptcha, recordSuccessfulLogin } from '../src/utils/loginSecurity';

const request = supertest(app);

describe('Login Security & CAPTCHA Verification Suite', () => {
  const testEmail = 'captcha_test@regencysalma.com';
  const testPassword = 'Password123!';

  beforeAll(async () => {
    // Clean up test user
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const passwordHash = await bcrypt.hash(testPassword, 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        firstName: 'Captcha',
        lastName: 'User',
      },
    });
  });

  afterAll(async () => {
    const existing = await prisma.user.findUnique({ where: { email: testEmail } });
    if (existing) {
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }
  });

  it('1. Utility generateCaptcha and validateCaptcha works correctly', () => {
    const captcha = generateCaptcha(testEmail);
    expect(captcha.question).toBeDefined();
    expect(captcha.token).toBeDefined();

    const decoded = Buffer.from(captcha.token, 'base64').toString();
    const [expectedAnswer] = decoded.split(':');
    
    expect(expectedAnswer).toBeDefined();
    // Correct answer passes
    expect(validateCaptcha(testEmail, expectedAnswer!, captcha.token)).toBe(true);
    // Wrong answer fails
    expect(validateCaptcha(testEmail, '999999', captcha.token)).toBe(false);
  });

  it('2. Login succeeds with correct credentials', async () => {
    recordSuccessfulLogin(testEmail);
    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('3. Consecutive failed login attempts trigger CAPTCHA requirement on 3rd attempt', async () => {
    recordSuccessfulLogin(testEmail);

    // Attempt 1: Fail
    const fail1 = await request.post('/auth/login').send({
      email: testEmail,
      password: 'WrongPassword1',
    });
    expect(fail1.status).toBe(401);
    expect(fail1.body.error?.captchaRequired).toBeFalsy();

    // Attempt 2: Fail
    const fail2 = await request.post('/auth/login').send({
      email: testEmail,
      password: 'WrongPassword2',
    });
    expect(fail2.status).toBe(401);
    expect(fail2.body.error?.captchaRequired).toBeFalsy();

    // Attempt 3: Fail -> Should require CAPTCHA (with delay, may take up to 8s)
    const fail3 = await request.post('/auth/login').send({
      email: testEmail,
      password: 'WrongPassword3',
    });
    expect(fail3.status).toBe(401);
    expect(fail3.body.error?.captchaRequired).toBe(true);
    expect(fail3.body.error?.captchaQuestion).toBeDefined();
    expect(fail3.body.error?.captchaToken).toBeDefined();
  }, 15000);

  it('4. Attempting login without CAPTCHA when required returns 400 CAPTCHA required', async () => {
    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body.error?.captchaRequired).toBe(true);
    expect(res.body.error?.captchaQuestion).toBeDefined();
  });

  it('5. Attempting login with correct CAPTCHA and correct password succeeds', async () => {
    // Generate fresh captcha
    const captcha = generateCaptcha(testEmail);
    const decoded = Buffer.from(captcha.token, 'base64').toString();
    const [correctAnswer] = decoded.split(':');

    const res = await request.post('/auth/login').send({
      email: testEmail,
      password: testPassword,
      captchaAnswer: correctAnswer,
      captchaToken: captcha.token,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  }, 15000);
});
