import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useWatchProgress } from './hooks/useWatchProgress';

export default function VideoPlayer({ m3u8Url, episodeId }) {
  const videoRef = useRef(null);
  const { initialProgress, isLoaded, saveProgress } = useWatchProgress(episodeId);

  useEffect(() => {
    // Solo cargamos el video cuando Firebase haya respondido
    if (!m3u8Url || !videoRef.current || !isLoaded) return;

    const video = videoRef.current;
    let hls;
    let isFirstPlay = true;

    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: function(xhr, url) {
          xhr.withCredentials = false;
        }
      });
      
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Al cargar el video, vamos al minuto donde nos quedamos
        if (initialProgress > 0) {
          video.currentTime = initialProgress;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari
      video.src = m3u8Url;
      video.addEventListener('loadedmetadata', () => {
        if (initialProgress > 0 && isFirstPlay) {
          video.currentTime = initialProgress;
          isFirstPlay = false;
        }
      });
    }

    // Escuchar cuando el video avanza para guardarlo en Firebase
    const handleTimeUpdate = () => {
      saveProgress(video.currentTime);
    };
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      if (hls) {
        hls.destroy();
      }
    };
  }, [m3u8Url, isLoaded, initialProgress]);

  return (
    <video
      ref={videoRef}
      controls
      style={{ 
        width: '100%', 
        height: '100%',
        borderRadius: '12px',
        background: '#000',
        objectFit: 'contain'
      }}
    />
  );
}
