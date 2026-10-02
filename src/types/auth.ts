import type { Session, User } from '@supabase/supabase-js';

export type Profile = { id: string; display_name: string | null; avatar_url: string | null; created_at: string; updated_at: string };

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (displayName: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
};
