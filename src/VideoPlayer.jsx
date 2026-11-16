import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useWatchProgress } from './hooks/useWatchProgress';

export default function VideoPlayer({ m3u8Url, episodeId, onNext }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [speed, setSpeed] = useState('1');
  const [audioTracks, setAudioTracks] = useState([]);
  const [levels, setLevels] = useState([]);
  const [audioTrack, setAudioTrack] = useState('0');
  const [quality, setQuality] = useState('-1');
  const { initialProgress, isLoaded, saveProgress, finishProgress } = useWatchProgress(episodeId);

  useEffect(() => {
    if (!m3u8Url || !videoRef.current || !isLoaded) return;
    const video = videoRef.current;
    let hls;
    let networkRetries = 0;
    let mediaRetries = 0;
    const ready = () => setStatus('ready');
    const failed = () => setStatus('error');
    const restoreNativeProgress = () => {
      if (initialProgress > 0) video.currentTime = Math.min(initialProgress, Number.isFinite(video.duration) ? video.duration : initialProgress);
    };
    video.addEventListener('canplay', ready);
    video.addEventListener('error', failed);

    if (Hls.isSupported()) {
      hls = new Hls({ startPosition: initialProgress > 0 ? initialProgress : -1 });
      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLevels(hls.levels.map((level, index) => ({ index, label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps` })));
        setQuality('-1');
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        setAudioTracks(data.audioTracks.map((track, index) => ({ index, label: track.name || track.lang || `Audio ${index + 1}` })));
        setAudioTrack(String(Math.max(0, hls.audioTrack)));
      });
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => setAudioTrack(String(data.id)));
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 1) hls.startLoad();
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) hls.recoverMediaError();
        else failed();
      });
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.addEventListener('loadedmetadata', restoreNativeProgress, { once: true });
      video.src = m3u8Url;
    } else {
      failed();
    }
    return () => {
      video.removeEventListener('canplay', ready);
      video.removeEventListener('error', failed);
      video.removeEventListener('loadedmetadata', restoreNativeProgress);
      if (hls) { hlsRef.current = null; hls.destroy(); }
      else { video.removeAttribute('src'); video.load(); }
    };
  }, [m3u8Url, isLoaded, initialProgress, attempt]);

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

  function skip(seconds) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }

  return (
    <div className="player">
      <div className="video-screen">
        <video ref={videoRef} controls playsInline aria-label="Reproductor del episodio" />
        {status === 'loading' && <div className="player-status" role="status">Preparando episodio…</div>}
        {status === 'error' && <div className="player-status player-error" role="alert"><p>No se ha podido cargar el episodio.</p><button className="player-tool" onClick={() => { setStatus('loading'); setAttempt((value) => value + 1); }}>Volver a intentar</button></div>}
      </div>
      <div className="player-toolbar">
        <div className="player-tools">
          <button className="player-tool" disabled={status !== 'ready'} onClick={() => skip(-10)} aria-label="Retroceder 10 segundos">↶ 10 s</button>
          <button className="player-tool" disabled={status !== 'ready'} onClick={() => skip(10)} aria-label="Adelantar 10 segundos">10 s ↷</button>
          <label className="player-speed">Velocidad <select value={speed} onChange={(event) => { setSpeed(event.target.value); videoRef.current.playbackRate = Number(event.target.value); }}><option value="0.75">0,75×</option><option value="1">Normal</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label>
          {audioTracks.length > 1 && <label className="player-speed">Audio <select value={audioTrack} onChange={(event) => { setAudioTrack(event.target.value); hlsRef.current.audioTrack = Number(event.target.value); }}>{audioTracks.map((track) => <option key={track.index} value={track.index}>{track.label}</option>)}</select></label>}
          {levels.length > 1 && <label className="player-speed">Calidad <select value={quality} onChange={(event) => { setQuality(event.target.value); hlsRef.current.currentLevel = Number(event.target.value); }}><option value="-1">Automática</option>{levels.map((level) => <option key={level.index} value={level.index}>{level.label}</option>)}</select></label>}
        </div>
        <button className="player-next" disabled={!onNext} onClick={onNext}>Siguiente episodio →</button>
      </div>
    </div>
  );
}
