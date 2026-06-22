import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function VideoPlayer({ m3u8Url }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!m3u8Url || !videoRef.current) return;

    const video = videoRef.current;
    
    // Destroy previous HLS instance if it exists to prevent memory leaks when changing episodes
    let hls;

    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: function(xhr, url) {
          xhr.withCredentials = false;
        }
      });
      
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // video.play().catch(e => console.log("Autoplay prevented", e)); 
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari soporta HLS nativo
      video.src = m3u8Url;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [m3u8Url]);

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
