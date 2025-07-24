import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Auth store
interface AuthState {
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  setAuth: (user: AuthState['user'], token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        login: async (email: string, password: string) => {
          try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.error?.message || 'Login failed');
            }
            
            if (data.success && data.data) {
              const { token, user } = data.data;
              get().setAuth(user, token);
            }
          } catch (error) {
            throw error;
          }
        },
        setAuth: (user, token) => {
          localStorage.setItem('auth_token', token);
          set({ user, token, isAuthenticated: true });
        },
        clearAuth: () => {
          localStorage.removeItem('auth_token');
          set({ user: null, token: null, isAuthenticated: false });
        }
      }),
      {
        name: 'auth-storage'
      }
    )
  )
);

// App state store
interface AppState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        theme: 'light',
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        setSidebarOpen: (open) => set({ sidebarOpen: open }),
        toggleTheme: () => set((state) => ({ 
          theme: state.theme === 'light' ? 'dark' : 'light' 
        })),
        setTheme: (theme) => set({ theme })
      }),
      {
        name: 'app-storage'
      }
    )
  )
);