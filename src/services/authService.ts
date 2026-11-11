export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  created_at?: string;
  updated_at?: string;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const STORAGE_KEYS = {
  TOKEN: 'medicare_access_token',
  USER: 'medicare_auth_user',
  // Backward compatibility keys
  LEGACY_TOKEN: 'access_token',
  LEGACY_AUTH_TOKEN: 'auth_token'
};

export const authService = {
  /**
   * Retrieves current JWT access token from localStorage.
   */
  getToken(): string | null {
    return (
      localStorage.getItem(STORAGE_KEYS.TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_AUTH_TOKEN)
    );
  },

  /**
   * Retrieves cached user object from localStorage.
   */
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  /**
   * Stores authentication session in localStorage.
   */
  setSession(token: string, user: AuthUser): void {
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.LEGACY_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.LEGACY_AUTH_TOKEN, token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  /**
   * Clears authentication session completely from localStorage.
   */
  clearSession(): void {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  /**
   * Logs in using email and password via POST /api/auth/login.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email.trim(), password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Invalid email or password');
    }

    this.setSession(data.access_token, data.user);
    return data as LoginResponse;
  },

  /**
   * Registers a new user via POST /api/auth/register.
   */
  async register(
    name: string,
    email: string,
    password: string,
    role: 'Admin' | 'User' = 'User'
  ): Promise<{ message: string; user: AuthUser }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        role
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  },

  /**
   * Validates current token against GET /api/users/me and refreshes user profile.
   */
  async fetchCurrentUser(): Promise<AuthUser | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch('/api/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.clearSession();
        }
        return null;
      }

      const data = await res.json();
      if (data?.user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
        return data.user as AuthUser;
      }
      return null;
    } catch {
      return this.getUser();
    }
  }
};
