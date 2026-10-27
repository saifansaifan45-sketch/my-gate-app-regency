import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { storage } from './storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Base API URL
const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  if (__DEV__) {
    if (Platform.OS === 'web') return 'http://localhost:3005';

    // When running in Expo Go on a physical phone, automatically use the host's LAN IP
    const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const hostIp = hostUri.split(':')[0];
      if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
        return `http://${hostIp}:3005`;
      }
    }

    if (Platform.OS === 'ios') return 'http://localhost:3005'; 
    if (Platform.OS === 'android') return 'http://10.0.2.2:3005';
    return 'http://localhost:3005';
  }

  throw new Error('EXPO_PUBLIC_API_URL must be defined in production.');
};

const BASE_URL = getBaseUrl();

if (!__DEV__ && !BASE_URL.startsWith('https://')) {
  throw new Error('Production authentication requires an HTTPS API URL.');
}

/**
 * Create an AbortController tied to a component lifecycle.
 * Returns { signal, cancel } — call cancel() in useEffect cleanup.
 */
export function createCancelToken() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
}

/**
 * Wrap an axios config with an AbortController signal.
 * Usage: api.get('/path', withCancel(signal))
 */
export function withCancel(signal?: AbortSignal | null, config?: AxiosRequestConfig): AxiosRequestConfig {
  return { ...config, signal: config?.signal ?? signal ?? undefined };
}

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<string> | null = null;
let onAuthFailureCallback: (() => void) | null = null;
let onResidenceAuthFailureCallback: ((msg?: string) => void) | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
};

export const getAccessToken = (): string | null => {
  return inMemoryAccessToken;
};

export const setOnAuthFailure = (callback: () => void) => {
  onAuthFailureCallback = callback;
};

export const setOnResidenceAuthFailure = (callback: (msg?: string) => void) => {
  onResidenceAuthFailureCallback = callback;
};

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
  },
});

// Request interceptor: attach in-memory access token
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && config.headers) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and 403 residence verification errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 403 &&
      error.response?.data?.error?.code === 'RESIDENCE_VERIFICATION_REQUIRED'
    ) {
      if (onResidenceAuthFailureCallback) {
        onResidenceAuthFailureCallback(error.response?.data?.error?.message);
      }
    }

    // Only attempt refresh on 401 and if we haven't already retried this request
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const storedRefreshToken = await storage.getRefreshToken();
        if (!storedRefreshToken) {
          throw new Error('No refresh token available');
        }

        // Share one rotation request across simultaneous 401s. Refresh-token
        // rotation is intentionally single-use, so parallel refreshes must not
        // invalidate one another.
        if (!refreshInFlight) {
          refreshInFlight = (async () => {
            const res = await axios.post(`${BASE_URL}/auth/refresh`, {
              refreshToken: storedRefreshToken,
            });
            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data;
            setAccessToken(newAccessToken);
            if (!newRefreshToken) throw new Error('Refresh response did not include a refresh token');
            await storage.saveRefreshToken(newRefreshToken);
            return newAccessToken as string;
          })().finally(() => {
            refreshInFlight = null;
          });
        }
        const newAccessToken = await refreshInFlight;

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed: wipe tokens and trigger logout
        setAccessToken(null);
        await storage.removeRefreshToken();
        if (onAuthFailureCallback) {
          onAuthFailureCallback();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
