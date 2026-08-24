/**
 * Regency Salma — Centralized API Error Parser & User-Friendly Error Mapper
 *
 * Ensures no raw backend JSON, Prisma errors, Zod error arrays, or stack traces
 * are ever exposed directly to the user interface.
 */

export interface AppError {
  message: string;
  field?: string;
  statusCode?: number;
}

export const parseApiError = formatErrorMessage;

export function formatErrorMessage(error: unknown, fallbackMessage = 'Something went wrong. Please try again.'): string {
  if (!error) return fallbackMessage;

  // If already a string
  if (typeof error === 'string') {
    return cleanRawErrorString(error);
  }

  // Handle Axios / API Errors
  if (typeof error === 'object' && error !== null) {
    const anyErr = error as any;

    // Network / Offline errors
    if (anyErr.message === 'Network Error' || anyErr.code === 'ECONNABORTED' || anyErr.code === 'ERR_NETWORK') {
      return 'Unable to reach the server. Please check your internet connection.';
    }

    const response = anyErr.response;
    if (response) {
      const status = response.status;
      const data = response.data;

      // 1. Check data.error.message
      if (typeof data?.error?.message === 'string') {
        return cleanRawErrorString(data.error.message);
      }

      // 2. Check data.message
      if (typeof data?.message === 'string') {
        return cleanRawErrorString(data.message);
      }

      // 3. Check Zod validation issue array in data.error or data.errors
      const zodIssues = data?.error?.issues || data?.errors;
      if (Array.isArray(zodIssues) && zodIssues.length > 0) {
        const firstIssue = zodIssues[0];
        if (firstIssue?.message) {
          return cleanRawErrorString(firstIssue.message);
        }
      }

      // 4. HTTP Status Code fallbacks
      if (status === 400) return 'Invalid request. Please check your details and try again.';
      if (status === 401) return 'Incorrect email or password.';
      if (status === 403) return 'You do not have permission to perform this action.';
      if (status === 404) return 'The requested information was not found.';
      if (status === 409) return 'An account or record with these details already exists.';
      if (status >= 500) return 'Server is temporarily unavailable. Please try again in a moment.';
    }

    // Standard JavaScript Error
    if (anyErr.message && typeof anyErr.message === 'string') {
      return cleanRawErrorString(anyErr.message);
    }
  }

  return fallbackMessage;
}

function cleanRawErrorString(rawMsg: string): string {
  const lower = rawMsg.toLowerCase();

  if (lower.includes('invalid credentials') || lower.includes('invalid email or password') || lower.includes('password incorrect')) {
    return 'Incorrect email or password.';
  }

  if (lower.includes('email already exists') || lower.includes('user with this email already exists')) {
    return 'An account with this email address already exists.';
  }

  if (lower.includes('access denied') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    if (lower.includes('leadership')) return 'Access restricted to township leadership.';
    if (lower.includes('manager')) return 'Access restricted to township operations managers.';
    if (lower.includes('workforce')) return 'Access restricted to approved workforce staff.';
    return 'You do not have permission to access this feature.';
  }

  if (lower.includes('off duty') || lower.includes('off_duty')) {
    return 'Personnel is currently off duty and cannot receive task assignments.';
  }

  if (lower.includes('leave')) {
    return 'Personnel is currently on leave and cannot receive task assignments.';
  }

  if (lower.includes('suspended')) {
    return 'Staff account is currently suspended.';
  }

  if (lower.includes('terminated')) {
    return 'Staff account has been terminated.';
  }

  if (lower.includes('unit not found')) {
    return 'Specified unit was not found in Regency Salma.';
  }

  if (lower.includes('network error') || lower.includes('failed to fetch')) {
    return 'Unable to reach the server. Please check your internet connection.';
  }

  // Strip any accidental JSON formatting or Prisma table names
  if (rawMsg.startsWith('{') || rawMsg.startsWith('[') || rawMsg.includes('PrismaClient')) {
    return 'An error occurred while processing your request. Please try again.';
  }

  return rawMsg;
}
