import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getCreatorProfile, type CreatorProfile } from '@/services/api';
import { useAuth } from '@/providers/auth-provider';

export type AppMode = 'LISTENER' | 'CREATOR';
type AppModeContextValue = { mode: AppMode; creatorProfile: CreatorProfile | null; creatorLoading: boolean; refreshCreator: () => Promise<CreatorProfile | null>; switchToCreator: () => Promise<boolean>; switchToListener: () => Promise<void> };
const STORAGE_KEY = 'playbook.preferred-mode';
const AppModeContext = createContext<AppModeContextValue | null>(null);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<AppMode>('LISTENER');
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [creatorLoading, setCreatorLoading] = useState(false);

  const refreshCreator = useCallback(async () => {
    if (!isAuthenticated) { setCreatorProfile(null); setMode('LISTENER'); return null; }
    setCreatorLoading(true);
    try { const profile = await getCreatorProfile(); setCreatorProfile(profile); if (profile?.status !== 'ACTIVE') setMode('LISTENER'); return profile; }
    catch { setCreatorProfile(null); setMode('LISTENER'); return null; }
    finally { setCreatorLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { let active = true; void AsyncStorage.getItem(STORAGE_KEY).then((value) => { if (active && value === 'CREATOR') setMode('CREATOR'); }); return () => { active = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => void refreshCreator(), 0); return () => clearTimeout(timer); }, [refreshCreator]);
  useEffect(() => { if (!user || creatorProfile?.status !== 'ACTIVE') { const timer = setTimeout(() => setMode('LISTENER'), 0); return () => clearTimeout(timer); } }, [user, creatorProfile?.status]);
  const switchToListener = useCallback(async () => { setMode('LISTENER'); await AsyncStorage.setItem(STORAGE_KEY, 'LISTENER'); }, []);
  const switchToCreator = useCallback(async () => { const profile = creatorProfile ?? await refreshCreator(); if (profile?.status !== 'ACTIVE') return false; setMode('CREATOR'); await AsyncStorage.setItem(STORAGE_KEY, 'CREATOR'); return true; }, [creatorProfile, refreshCreator]);
  const value = useMemo(() => ({ mode, creatorProfile, creatorLoading, refreshCreator, switchToCreator, switchToListener }), [mode, creatorProfile, creatorLoading, refreshCreator, switchToCreator, switchToListener]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode() { const value = useContext(AppModeContext); if (!value) throw new Error('useAppMode must be used inside AppModeProvider'); return value; }
