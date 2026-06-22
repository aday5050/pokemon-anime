import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const SYNC_ID = import.meta.env.VITE_SYNC_ID;

export function useWatchProgress(episodeId) {
  const [initialProgress, setInitialProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const lastSavedTime = useRef(0);

  // Cargar el progreso inicial desde Firebase cuando cambia el episodio
  useEffect(() => {
    if (!episodeId || !SYNC_ID) {
      setIsLoaded(true);
      return;
    }
    
    let isMounted = true;
    
    async function fetchProgress() {
      try {
        const docRef = doc(db, 'user_progress', SYNC_ID);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && isMounted) {
          const data = docSnap.data();
          if (data[episodeId] && data[episodeId].time) {
            setInitialProgress(data[episodeId].time);
            lastSavedTime.current = data[episodeId].time;
          } else {
             setInitialProgress(0);
             lastSavedTime.current = 0;
          }
        }
        if (isMounted) setIsLoaded(true);
      } catch (e) {
        console.error("Error cargando el progreso:", e);
        if (isMounted) setIsLoaded(true); // Para que el video pueda empezar aunque falle Firebase
      }
    }
    
    setIsLoaded(false);
    fetchProgress();
    
    return () => {
      isMounted = false;
    };
  }, [episodeId]);

  // Función para guardar el progreso (se llama mientras se reproduce el video)
  const saveProgress = async (time) => {
    if (!episodeId || !SYNC_ID || !isLoaded) return;
    
    // Solo guardamos en la base de datos si la diferencia de tiempo es mayor a 10 segundos
    // para no saturar Firebase de peticiones
    if (Math.abs(time - lastSavedTime.current) > 10) {
      lastSavedTime.current = time;
      try {
        const docRef = doc(db, 'user_progress', SYNC_ID);
        // Usamos merge: true para no borrar el progreso de otros episodios
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
