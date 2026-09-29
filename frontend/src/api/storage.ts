import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'regency_salma_refresh_token';

// On iOS this is Keychain; on Android Expo SecureStore uses Android Keystore
// backed encrypted storage. Never silently continue after a native write fails:
// doing so would make the UI look signed in while the session cannot be safely
// recovered after the process is killed.
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// In-memory fallback for web environments where SecureStore is not natively supported
let webMemoryToken: string | null = null;

export const storage = {
  async saveRefreshToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        webMemoryToken = token;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
        }
      } else {
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, secureStoreOptions);
      }
    } catch (e) {
      console.warn('Failed to save refresh token to secure storage', e);
      throw new Error('Unable to securely persist the session');
    }
  },

  async getRefreshToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(REFRESH_TOKEN_KEY) || webMemoryToken;
        }
        return webMemoryToken;
      }
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
    } catch (e) {
      console.warn('Failed to get refresh token from secure storage', e);
      return null;
    }
  },

  async removeRefreshToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        webMemoryToken = null;
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
      } else {
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions);
      }
    } catch (e) {
      console.warn('Failed to remove refresh token from secure storage', e);
    }
  },

  async savePushToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('regency_push_token', token);
        }
      } else {
        await SecureStore.setItemAsync('regency_push_token', token, secureStoreOptions);
      }
    } catch (e) {
      console.warn('Failed to save push token', e);
    }
  },

  async getPushToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem('regency_push_token');
        }
        return null;
      }
      return await SecureStore.getItemAsync('regency_push_token', secureStoreOptions);
    } catch {
      return null;
    }
  },

  async removePushToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('regency_push_token');
        }
      } else {
        await SecureStore.deleteItemAsync('regency_push_token', secureStoreOptions);
      }
    } catch (e) {
      console.warn('Failed to remove push token', e);
    }
  },
};
