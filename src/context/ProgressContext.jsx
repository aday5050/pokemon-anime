import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

const ProgressContext = createContext();

export function useProgress() {
  return useContext(ProgressContext);
}

export function ProgressProvider({ children }) {
  const { currentUser } = useAuth();
  const [progressData, setProgressData] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setProgressData({});
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'user_progress', currentUser.uid);
    
    // onSnapshot automatically updates the state whenever the document changes in Firebase!
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProgressData(docSnap.data());
      } else {
        setProgressData({});
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching progress data:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Derived state: what episodes are considered "seen"?
  // An episode is seen if time > 600 seconds (10 minutes) OR if it has a manual 'finished: true' flag.
  const seenEpisodes = new Set();
  let currentlyWatching = null;
  let latestUpdate = 0;

  Object.entries(progressData).forEach(([episodeId, data]) => {
    if (data.finished || data.time > 600) {
      seenEpisodes.add(episodeId);
    }
    
    if (data.lastUpdated) {
      const updateTime = new Date(data.lastUpdated).getTime();
      if (updateTime > latestUpdate) {
        latestUpdate = updateTime;
        currentlyWatching = episodeId;
      }
    }
  });

  async function markAsSeen(episodeId, isSeen) {
    if (!currentUser) return;
    try {
      const docRef = doc(db, 'user_progress', currentUser.uid);
      await setDoc(docRef, {
        [episodeId]: {
          finished: isSeen,
          lastUpdated: new Date().toISOString()
        }
      }, { merge: true });
    } catch (e) {
      console.error("Error marking episode as seen:", e);
    }
  }

  const value = {
    progressData,
    seenEpisodes,
    currentlyWatching,
    markAsSeen,
    loading
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}
