import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

const ProgressContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export function useProgress() {
  return useContext(ProgressContext);
}

export function ProgressProvider({ children }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? null;
  const [snapshot, setSnapshot] = useState({ userId, data: null });
  // Reset synchronously when the account changes without unmounting the interface.
  if (snapshot.userId !== userId) setSnapshot({ userId, data: null });

  useEffect(() => {
    if (!userId) return;
    const docRef = doc(db, 'user_progress', userId);
    return onSnapshot(docRef, (docSnap) => {
      setSnapshot({ userId, data: docSnap.exists() ? docSnap.data() : {} });
    }, (error) => {
      console.error('Error fetching progress data:', error);
      setSnapshot({ userId, data: {} });
    });
  }, [userId]);

  // A snapshot from a different account is never exposed while the listener loads.
  const loading = Boolean(userId && (snapshot.userId !== userId || snapshot.data === null));
  const progressData = userId && !loading ? snapshot.data : {};
  const seenEpisodes = new Set();
  let currentlyWatching = null;
  let latestUpdate = 0;

  Object.entries(progressData).forEach(([episodeId, data]) => {
    if (data.finished ?? data.time > 600) seenEpisodes.add(episodeId);
    if (data.lastUpdated) {
      const updateTime = new Date(data.lastUpdated).getTime();
      if (updateTime > latestUpdate) {
        latestUpdate = updateTime;
        currentlyWatching = episodeId;
      }
    }
  });

  async function markAsSeen(episodeId, isSeen) {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'user_progress', userId), {
        [episodeId]: { finished: isSeen, lastUpdated: new Date().toISOString() }
      }, { merge: true });
    } catch (error) {
      console.error('Error marking episode as seen:', error);
    }
  }

  return (
    <ProgressContext.Provider value={{ progressData, seenEpisodes, currentlyWatching, markAsSeen, loading }}>
      {children}
    </ProgressContext.Provider>
  );
}
