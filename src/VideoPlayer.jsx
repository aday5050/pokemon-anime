import { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { useWatchProgress } from './hooks/useWatchProgress';

export default function VideoPlayer({ m3u8Url, episodeId }) {
  const videoRef = useRef(null);
  const { initialProgress, isLoaded, saveProgress, finishProgress } = useWatchProgress(episodeId);

  useEffect(() => {
    if (!m3u8Url || !videoRef.current || !isLoaded) return;

    const video = videoRef.current;
    let hls;
    const restoreNativeProgress = () => {
      if (initialProgress > 0) video.currentTime = initialProgress;
    };

    if (Hls.isSupported()) {
      hls = new Hls({ startPosition: initialProgress > 0 ? initialProgress : -1 });
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('loadedmetadata', restoreNativeProgress, { once: true });
      video.src = m3u8Url;
    }

    return () => {
      video.removeEventListener('loadedmetadata', restoreNativeProgress);
      if (hls) hls.destroy();
      else {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [m3u8Url, isLoaded, initialProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => { if (!video.ended) saveProgress(video.currentTime, { duration: video.duration }); };
    const handlePause = () => { if (!video.ended) saveProgress(video.currentTime, { force: true, duration: video.duration }); };
    const handleEnded = () => finishProgress(video.currentTime, video.duration);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [saveProgress, finishProgress]);

  return (
    <video ref={videoRef} controls style={{ width: '100%', height: '100%', borderRadius: '12px', background: '#000', objectFit: 'contain' }} />
  );
}
