import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProgress } from '../context/ProgressContext';

export function useWatchProgress(episodeId) {
  const { currentUser } = useAuth();
  const { progressData, loading } = useProgress();
  const userId = currentUser?.uid ?? null;
  const episodeKey = `${userId ?? 'guest'}:${episodeId ?? ''}`;
  const [restored, setRestored] = useState({ key: null, time: 0 });
  const lastSavedTime = useRef(0);

  useEffect(() => {
    if (userId && loading) return;
    if (restored.key === episodeKey) return;

    const time = userId && episodeId ? Number(progressData[episodeId]?.time) || 0 : 0;
    lastSavedTime.current = time;
    // The initial position is captured once per account and episode, after Firestore loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored({ key: episodeKey, time });
  }, [episodeId, episodeKey, loading, progressData, restored.key, userId]);

  const isLoaded = (!userId || !loading) && restored.key === episodeKey;
  const saveProgress = useCallback(async (time) => {
    if (!episodeId || !userId || !isLoaded || !Number.isFinite(time)) return;
    if (Math.abs(time - lastSavedTime.current) <= 10) return;

    const previousTime = lastSavedTime.current;
    lastSavedTime.current = time;
    try {
      await setDoc(doc(db, 'user_progress', userId), {
        [episodeId]: { time: Math.floor(time), lastUpdated: new Date().toISOString() }
      }, { merge: true });
    } catch (error) {
      // Allow a later timeupdate to retry the same position after a failed write.
      if (lastSavedTime.current === time) lastSavedTime.current = previousTime;
      console.error('Error guardando el progreso:', error);
    }
  }, [episodeId, isLoaded, userId]);

  return { initialProgress: restored.time, isLoaded, saveProgress };
}
