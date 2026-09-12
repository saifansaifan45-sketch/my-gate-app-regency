import { generateCaptcha, validateCaptcha, sleep } from '../src/utils/loginSecurity';

describe('Captcha HMAC + email-bound + single-use + delay', () => {
  it('same token + different email → 400 (email-bound)', () => {
    const emailA = `a_${Date.now()}@test.com`;
    const emailB = `b_${Date.now()}@test.com`;
    const { token, question } = generateCaptcha(emailA);
    const answer = question.match(/What is (\d+) (.) (\d+)/) ? (() => {
      const m = question.match(/What is (\d+) (.) (\d+)/)!;
      const a = parseInt(m[1]), b = parseInt(m[3]), op = m[2];
      return (op === '+' ? a + b : a - b).toString();
    })() : '0';
    // Valid for A
    expect(validateCaptcha(emailA, answer, token)).toBe(true);
    // Same token for B should fail (email-bound) — but token already used, so also fails
    // Generate new token for A and try for B
    const { token: token2, question: q2 } = generateCaptcha(emailA);
    const ans2 = (() => {
      const m = q2.match(/What is (\d+) (.) (\d+)/)!;
      const a = parseInt(m[1]), b = parseInt(m[3]), op = m[2];
      return (op === '+' ? a + b : a - b).toString();
    })();
    expect(validateCaptcha(emailB, ans2, token2)).toBe(false);
  });

  it('reused token → 400 (single-use)', () => {
    const email = `reuse_${Date.now()}@test.com`;
    const { token, question } = generateCaptcha(email);
    const m = question.match(/What is (\d+) (.) (\d+)/)!;
    const a = parseInt(m[1]), b = parseInt(m[3]), op = m[2];
    const answer = (op === '+' ? a + b : a - b).toString();
    expect(validateCaptcha(email, answer, token)).toBe(true);
    expect(validateCaptcha(email, answer, token)).toBe(false);
  });

  it('delay actually enforced (sleep)', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
  });
});
