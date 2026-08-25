import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'secret_access';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'secret_refresh';

export const generateTokens = (userId: string, tokenVersion: number = 0) => {
  const accessToken = jwt.sign({ userId, tokenVersion }, ACCESS_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, tokenVersion }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET) as { userId: string, tokenVersion?: number };
};

export const generateAttendanceExportToken = (userId: string, tokenVersion: number = 0) => {
  return jwt.sign({ userId, tokenVersion, purpose: 'attendance-export' }, ACCESS_SECRET, { expiresIn: '60s' });
};

export const verifyAttendanceExportToken = (token: string) => {
  return jwt.verify(token, ACCESS_SECRET) as { userId: string, tokenVersion?: number, purpose?: string };
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, REFRESH_SECRET) as { userId: string };
};
