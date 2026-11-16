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
  const lastSavedTime = useRef(null);

  useEffect(() => {
    if (userId && loading) return;
    if (restored.key === episodeKey) return;

    const progress = userId && episodeId ? progressData[episodeId] : null;
    const time = progress?.finished === true ? 0 : Math.max(0, Number(progress?.time) || 0);
    lastSavedTime.current = time > 0 ? time : null;
    // The initial position is captured once per account and episode, after Firestore loads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored({ key: episodeKey, time });
  }, [episodeId, episodeKey, loading, progressData, restored.key, userId]);

  const isLoaded = (!userId || !loading) && restored.key === episodeKey;
  const saveProgress = useCallback(async (time, { force = false, duration } = {}) => {
    if (!episodeId || !userId || !isLoaded || !Number.isFinite(time)) return;
    if (time < 1 || (!force && lastSavedTime.current !== null && Math.abs(time - lastSavedTime.current) <= 10)) return;

    const previousTime = lastSavedTime.current;
    lastSavedTime.current = time;
    try {
      await setDoc(doc(db, 'user_progress', userId), {
        [episodeId]: {
          time: Math.floor(time),
          finished: false,
          lastUpdated: new Date().toISOString(),
          ...(Number.isFinite(duration) && duration > 0 ? { duration: Math.max(1, Math.floor(duration)) } : {}),
        },
      }, { merge: true });
    } catch (error) {
      // Allow a later timeupdate to retry the same position after a failed write.
      if (lastSavedTime.current === time) lastSavedTime.current = previousTime;
      console.error('Error guardando el progreso:', error);
    }
  }, [episodeId, isLoaded, userId]);

  const finishProgress = useCallback(async (time, duration) => {
    if (!episodeId || !userId || !isLoaded) return;
    try {
      await setDoc(doc(db, 'user_progress', userId), {
        [episodeId]: {
          time: Number.isFinite(time) ? Math.max(0, Math.floor(time)) : 0,
          finished: true,
          lastUpdated: new Date().toISOString(),
          ...(Number.isFinite(duration) && duration > 0 ? { duration: Math.max(1, Math.floor(duration)) } : {}),
        },
      }, { merge: true });
    } catch (error) {
      console.error('Error guardando el final del episodio:', error);
    }
  }, [episodeId, isLoaded, userId]);

  return { initialProgress: restored.time, isLoaded, saveProgress, finishProgress };
}
