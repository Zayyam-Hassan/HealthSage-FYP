import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, ApiError, setAccessToken } from './api';
import { unregisterCurrentDevice } from '@/src/shared/services/notificationService';

const AUTH_USER_KEY = '@healthsage_user';

export type UserRole = 'doctor' | 'patient';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  access_token?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginOptions {
  rememberSession?: boolean;
}

export interface UpdateProfilePayload {
  display_name?: string;
  email?: string;
  phone?: string;
  specialization?: string;
  bio?: string;
  accepting_patients?: boolean;
  full_name?: string;
}

class AuthService {
  private inMemoryUser: AuthUser | null = null;

  private async persistUser(user: AuthUser, rememberSession = true) {
    this.inMemoryUser = user;
    setAccessToken(user.access_token ?? null);
    if (rememberSession) {
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(AUTH_USER_KEY);
    }
  }

  async login(payload: LoginPayload, options?: LoginOptions): Promise<AuthUser> {
    try {
      const user = await apiClient.post<AuthUser>('/auth/login', payload);
      await this.persistUser(user, options?.rememberSession ?? false);
      return user;
    } catch (error) {
      const err = error as ApiError;
      throw err;
    }
  }

  async signup(payload: SignupPayload): Promise<AuthUser> {
    try {
      const user = await apiClient.post<AuthUser>('/auth/signup', payload);
      await this.persistUser(user);
      return user;
    } catch (error) {
      const err = error as ApiError;
      throw err;
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    if (this.inMemoryUser) return this.inMemoryUser;
    try {
      const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
      if (raw) {
        this.inMemoryUser = JSON.parse(raw) as AuthUser;
        setAccessToken(this.inMemoryUser.access_token ?? null);
        return this.inMemoryUser;
      }
    } catch {
      // ignore storage failures
    }
    return null;
  }

  async getAccessToken(): Promise<string | null> {
    const user = await this.getCurrentUser();
    return user?.access_token ?? null;
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    const user = await apiClient.patch<AuthUser>('/auth/me', payload);
    await this.persistUser({
      ...user,
      access_token: this.inMemoryUser?.access_token,
    });
    return this.inMemoryUser!;
  }

  async logout(): Promise<void> {
    await unregisterCurrentDevice().catch(() => undefined);
    this.inMemoryUser = null;
    setAccessToken(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  }
}

export const authService = new AuthService();
