import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { findBook } from '@/data/mock-books';

type PlayerContextValue = { activeBookId: string; isPlaying: boolean; progress: number; playbackRate: number; togglePlaying: () => void; setProgress: (progress: number) => void; setPlaybackRate: (rate: number) => void; rememberSaved: boolean; saveRemember: () => void };
const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(72);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rememberSaved, setRememberSaved] = useState(false);
  const value = useMemo(() => ({ activeBookId: findBook('atomic-habits')!.id, isPlaying, progress, playbackRate, togglePlaying: () => setIsPlaying((value) => !value), setProgress, setPlaybackRate, rememberSaved, saveRemember: () => setRememberSaved(true) }), [isPlaying, progress, playbackRate, rememberSaved]);
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() { const value = useContext(PlayerContext); if (!value) throw new Error('usePlayer must be used inside PlayerProvider'); return value; }
