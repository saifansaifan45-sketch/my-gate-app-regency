import { prisma } from '../prisma';
import bcrypt from 'bcrypt';

// In-memory store for failed attempts (production should use Redis)
const failedAttempts = new Map<string, {
  count: number;
  lastAttempt: number;
  lockedUntil: number | null;
  captchaRequired: boolean;
}>();

// Configuration
const CONFIG = {
  maxAttemptsBeforeLockout: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  captchaThreshold: 3,
  attemptWindowMs: 15 * 60 * 1000, // 15 minute window
  progressiveDelayBase: 2, // base for exponential backoff
  maxDelayMs: 60 * 1000, // max 60 seconds delay
  cleanupIntervalMs: 5 * 60 * 1000, // cleanup every 5 minutes
};

// Cleanup old entries periodically
let lastCleanup = Date.now();
function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CONFIG.cleanupIntervalMs) return;
  
  for (const [key, value] of failedAttempts.entries()) {
    if (now - value.lastAttempt > CONFIG.attemptWindowMs && 
        (!value.lockedUntil || now > value.lockedUntil)) {
      failedAttempts.delete(key);
    }
  }
  lastCleanup = now;
}

// Get or create attempt record
function getAttemptRecord(email: string) {
  cleanupOldEntries();
  
  const normalizedEmail = email.toLowerCase().trim();
  let record = failedAttempts.get(normalizedEmail);
  
  if (!record) {
    record = { count: 0, lastAttempt: 0, lockedUntil: null, captchaRequired: false };
    failedAttempts.set(normalizedEmail, record);
  }
  
  return record;
}

// Check if account is locked
export function isAccountLocked(email: string): { locked: boolean; remainingMs?: number; captchaRequired: boolean } {
  const record = getAttemptRecord(email);
  const now = Date.now();
  
  // Check if locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return {
      locked: true,
      remainingMs: record.lockedUntil - now,
      captchaRequired: true,
    };
  }
  
  // Check if lockout expired
  if (record.lockedUntil && now >= record.lockedUntil) {
    record.lockedUntil = null;
    record.count = 0;
    record.captchaRequired = false;
  }
  
  return { locked: false, captchaRequired: record.captchaRequired };
}

// Record a failed attempt
export function recordFailedAttempt(email: string): { 
  delayMs: number; 
  captchaRequired: boolean; 
  locked: boolean;
  remainingAttempts: number;
} {
  const record = getAttemptRecord(email);
  const now = Date.now();
  
  // Reset count if outside window
  if (now - record.lastAttempt > CONFIG.attemptWindowMs) {
    record.count = 0;
  }
  
  record.count++;
  record.lastAttempt = now;
  
  // Calculate progressive delay (exponential backoff)
  const delayMs = Math.min(
    CONFIG.progressiveDelayBase ** record.count * 1000,
    CONFIG.maxDelayMs
  );
  
  // Check if CAPTCHA required
  if (record.count >= CONFIG.captchaThreshold) {
    record.captchaRequired = true;
  }
  
  // Check if should lock
  if (record.count >= CONFIG.maxAttemptsBeforeLockout) {
    record.lockedUntil = now + CONFIG.lockoutDurationMs;
    return {
      delayMs,
      captchaRequired: true,
      locked: true,
      remainingAttempts: 0,
    };
  }
  
  return {
    delayMs,
    captchaRequired: record.captchaRequired,
    locked: false,
    remainingAttempts: CONFIG.maxAttemptsBeforeLockout - record.count,
  };
}

// Record successful login (reset attempts)
export function recordSuccessfulLogin(email: string): void {
  const normalizedEmail = email.toLowerCase().trim();
  failedAttempts.delete(normalizedEmail);
}

// Validate CAPTCHA (simple math challenge for now)
export function validateCaptcha(email: string, captchaAnswer: string, captchaToken: string): boolean {
  // In production, use a proper CAPTCHA service (reCAPTCHA, hCaptcha)
  // For now, we'll validate a simple math challenge stored in session
  
  try {
    const decoded = Buffer.from(captchaToken, 'base64').toString();
    const [expectedAnswer, timestamp] = decoded.split(':');
    
    if (!expectedAnswer || !timestamp) {
      return false;
    }
    
    // Token expires after 5 minutes
    if (Date.now() - parseInt(timestamp) > 5 * 60 * 1000) {
      return false;
    }
    
    return captchaAnswer === expectedAnswer;
  } catch {
    return false;
  }
}

// Generate CAPTCHA challenge
export function generateCaptcha(email: string): { question: string; token: string } {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const operation = Math.random() > 0.5 ? '+' : '-';
  const answer = operation === '+' ? a + b : a - b;
  
  const token = Buffer.from(`${answer}:${Date.now()}`).toString('base64');
  
  return {
    question: `What is ${a} ${operation} ${b}?`,
    token,
  };
}

// Admin unlock endpoint
export async function adminUnlockAccount(email: string, adminUserId: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const record = failedAttempts.get(normalizedEmail);
  
  if (record) {
    record.lockedUntil = null;
    record.count = 0;
    record.captchaRequired = false;
  }
  
  // Log the admin action
  console.log(`Admin ${adminUserId} unlocked account: ${normalizedEmail}`);
  
  return true;
}

// Get account status (for admin view)
export function getAccountStatus(email: string): {
  failedAttempts: number;
  locked: boolean;
  lockedUntil?: Date;
  captchaRequired: boolean;
  lastAttempt?: Date;
} {
  const record = getAttemptRecord(email);
  
  return {
    failedAttempts: record.count,
    locked: !!record.lockedUntil && Date.now() < record.lockedUntil,
    ...(record.lockedUntil ? { lockedUntil: new Date(record.lockedUntil) } : {}),
    captchaRequired: record.captchaRequired,
    ...(record.lastAttempt ? { lastAttempt: new Date(record.lastAttempt) } : {}),
  };
}
