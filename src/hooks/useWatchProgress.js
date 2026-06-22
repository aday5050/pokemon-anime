import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProgress } from '../context/ProgressContext';

export function useWatchProgress(episodeId) {
  const { currentUser } = useAuth();
  const { progressData } = useProgress();
  const [initialProgress, setInitialProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSavedTime = useRef(0);
  const currentEp = useRef(null);

  // Cargar el progreso inicial desde el contexto de progreso global
  useEffect(() => {
    if (!episodeId || !currentUser) {
      setIsLoaded(true);
      return;
    }
    
    // Si ya hemos cargado el progreso de este episodio, ignoramos las actualizaciones en tiempo real
    if (currentEp.current === episodeId) return;
    
    currentEp.current = episodeId;

    // Al cambiar el episodio, leemos la última posición desde progressData
    if (progressData[episodeId] && progressData[episodeId].time) {
      setInitialProgress(progressData[episodeId].time);
      lastSavedTime.current = progressData[episodeId].time;
    } else {
      setInitialProgress(0);
      lastSavedTime.current = 0;
    }
    
    setIsLoaded(true);
  }, [episodeId, currentUser, progressData]);

  // Función para guardar el progreso (se llama mientras se reproduce el video)
  const saveProgress = async (time) => {
    if (!episodeId || !currentUser || !isLoaded) return;
    
    // Solo guardamos en la base de datos si la diferencia de tiempo es mayor a 10 segundos
    if (Math.abs(time - lastSavedTime.current) > 10) {
      lastSavedTime.current = time;
      try {
        const docRef = doc(db, 'user_progress', currentUser.uid);
        await setDoc(docRef, {
          [episodeId]: {
            time: Math.floor(time),
            lastUpdated: new Date().toISOString()
          }
        }, { merge: true });
      } catch (e) {
        console.error("Error guardando el progreso:", e);
      }
    }
  };

  return { initialProgress, isLoaded, saveProgress };
}
