/**
 * Regency Salma — Centralized API Error Parser & Normalizer
 *
 * Converts raw backend validation payloads, Zod issue arrays, Axios error codes,
 * and Prisma exceptions into clean, human-friendly error messages.
 */

export interface ParsedApiError {
  message: string;
  field?: string;
  statusCode?: number;
}

export function parseApiError(error: unknown, defaultMessage = 'Something went wrong. Please try again.'): string {
  if (!error) return defaultMessage;

  if (typeof error === 'string') {
    return sanitizeErrorMessage(error);
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as any;

    // 1. Check HTTP response error if server replied
    const response = err.response;
    if (response) {
      const data = response.data;
      const status = response.status;

      // Check data.error.message
      if (typeof data?.error?.message === 'string') {
        return sanitizeErrorMessage(data.error.message);
      }

      // Check data.message
      if (typeof data?.message === 'string') {
        return sanitizeErrorMessage(data.message);
      }

      // Check nested Zod / Pydantic validation issue array
      const issues = data?.error?.issues || data?.errors || data?.error?.errors;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        if (typeof first?.message === 'string') {
          return sanitizeErrorMessage(first.message);
        }
      }

      // Standard HTTP status code fallbacks
      if (status === 400) return 'Invalid details provided. Please check your inputs.';
      if (status === 401) return 'Incorrect email or password.';
      if (status === 403) return 'Access restricted. You do not have permission.';
      if (status === 404) return 'The requested resource was not found.';
      if (status === 409) return 'An account with this email address already exists.';
      if (status === 422) return 'Please check your entered details and try again.';
      if (status >= 500) return 'Something went wrong on our server. Please try again later.';
    }

    // 2. Request sent but no response or connection refused
    if (
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ERR_CONNECTION_REFUSED' ||
      err.message === 'Network Error' ||
      (err.request && !err.response)
    ) {
      if (__DEV__) {
        const url = err.config?.baseURL || 'Unknown Host';
        return `Unable to reach Regency Salma services at ${url}. Is the backend running?`;
      }
      return 'Unable to reach Regency Salma services. Please try again.';
    }

    // 3. Timeout failures
    if (err.code === 'ECONNABORTED' || (typeof err.message === 'string' && err.message.toLowerCase().includes('timeout'))) {
      return 'Request timed out. Please try again.';
    }

    // 4. Generic JS Error message
    if (typeof err.message === 'string') {
      return sanitizeErrorMessage(err.message);
    }
  }

  return defaultMessage;
}

function sanitizeErrorMessage(msg: string): string {
  const lower = msg.toLowerCase().trim();

  // Authentication errors
  if (
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('incorrect password') ||
    lower.includes('password incorrect')
  ) {
    return 'Incorrect email or password.';
  }

  if (lower.includes('already exists') || lower.includes('user with this email already exists')) {
    return 'An account with this email address already exists.';
  }

  if (lower.includes('invalid email') || lower.includes('valid email address is required') || lower.includes('invalid_format')) {
    return 'Please enter a valid email address.';
  }

  if (lower.includes('too small') || lower.includes('too_small')) {
    if (lower.includes('password')) return 'Password must be at least 6 characters.';
    return 'Please fill in all required fields.';
  }

  // Operational permissions
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

  // Remove raw JSON, schemas, Prisma strings, or Axios stack mentions
  if (msg.startsWith('{') || msg.startsWith('[') || msg.includes('PrismaClient') || msg.includes('AxiosError') || msg.includes('ZodError')) {
    return 'An unexpected error occurred. Please try again.';
  }

  return msg;
}
