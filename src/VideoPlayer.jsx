import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ArrowsOut, ArrowsIn, Pause, Play, SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import { useWatchProgress } from './hooks/useWatchProgress';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

export default function VideoPlayer({ m3u8Url, episodeId, onNext }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hideTimer = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [speed, setSpeed] = useState('1');
  const [audioTracks, setAudioTracks] = useState([]);
  const [levels, setLevels] = useState([]);
  const [audioTrack, setAudioTrack] = useState('0');
  const [quality, setQuality] = useState('-1');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const updateTime = () => { setCurrentTime(video.currentTime || 0); setDuration(Number.isFinite(video.duration) ? video.duration : 0); };
    const updatePlaying = () => setPlaying(!video.paused && !video.ended);
    const updateVolume = () => { setVolume(video.volume); setMuted(video.muted); };
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === video.closest('.video-frame'));
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('durationchange', updateTime);
    video.addEventListener('loadedmetadata', updateTime);
    video.addEventListener('play', updatePlaying);
    video.addEventListener('pause', updatePlaying);
    video.addEventListener('ended', updatePlaying);
    video.addEventListener('volumechange', updateVolume);
    document.addEventListener('fullscreenchange', updateFullscreen);
    updateFullscreen();
    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('durationchange', updateTime);
      video.removeEventListener('loadedmetadata', updateTime);
      video.removeEventListener('play', updatePlaying);
      video.removeEventListener('pause', updatePlaying);
      video.removeEventListener('ended', updatePlaying);
      video.removeEventListener('volumechange', updateVolume);
      document.removeEventListener('fullscreenchange', updateFullscreen);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  function showControls() {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  function skip(seconds) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }

  function togglePlay() {
    const video = videoRef.current;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function toggleFullscreen() {
    const video = videoRef.current;
    const frame = video.closest('.video-frame');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (frame.requestFullscreen) frame.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) {
      video.controls = true;
      video.addEventListener('webkitendfullscreen', () => { video.controls = false; }, { once: true });
      video.webkitEnterFullscreen();
    }
  }

  return (
    <div className="player">
      <div className="video-screen" onMouseMove={showControls} onTouchStart={showControls} onFocusCapture={showControls}>
        <video ref={videoRef} playsInline aria-label="Reproductor del episodio" onClick={togglePlay} />
        {status === 'loading' && <div className="player-status" role="status">Preparando episodio…</div>}
        {status === 'error' && <div className="player-status player-error" role="alert"><p>No se ha podido cargar el episodio.</p><button className="player-tool" onClick={() => { setStatus('loading'); setAttempt((value) => value + 1); }}>Volver a intentar</button></div>}
        <div className={`player-controls${playing && !controlsVisible ? ' player-controls-hidden' : ''}`} role="group" aria-label="Controles del reproductor">
          <input className="player-timeline" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration)} disabled={!duration} aria-label="Posición del episodio" aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`} onChange={(event) => { videoRef.current.currentTime = Number(event.target.value); setCurrentTime(Number(event.target.value)); }} />
          <div className="player-control-row">
            <button className="player-control" disabled={status !== 'ready'} onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}</button>
            <span className="player-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button className="player-control" disabled={status !== 'ready'} onClick={() => skip(-10)} aria-label="Retroceder 10 segundos">↶ 10 s</button>
            <button className="player-control" disabled={status !== 'ready'} onClick={() => skip(10)} aria-label="Adelantar 10 segundos">10 s ↷</button>
            <button className="player-control" disabled={status !== 'ready'} onClick={() => skip(60)} title="Adelantar 60 segundos; la duración de la intro puede variar">Saltar intro · +60 s</button>
            <button className="player-control" onClick={() => { videoRef.current.muted = !videoRef.current.muted; }} aria-label={muted || volume === 0 ? 'Activar sonido' : 'Silenciar'}>{muted || volume === 0 ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}</button>
            <input className="player-volume" type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} aria-label="Volumen" onChange={(event) => { videoRef.current.volume = Number(event.target.value); videoRef.current.muted = false; }} />
            <label className="player-control-select">Velocidad <select value={speed} onChange={(event) => { setSpeed(event.target.value); videoRef.current.playbackRate = Number(event.target.value); }}><option value="0.75">0,75×</option><option value="1">Normal</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option></select></label>
            {audioTracks.length > 1 && <label className="player-control-select">Audio <select value={audioTrack} onChange={(event) => { setAudioTrack(event.target.value); hlsRef.current.audioTrack = Number(event.target.value); }}>{audioTracks.map((track) => <option key={track.index} value={track.index}>{track.label}</option>)}</select></label>}
            {levels.length > 1 && <label className="player-control-select">Calidad <select value={quality} onChange={(event) => { setQuality(event.target.value); hlsRef.current.currentLevel = Number(event.target.value); }}><option value="-1">Automática</option>{levels.map((level) => <option key={level.index} value={level.index}>{level.label}</option>)}</select></label>}
            <button className="player-control" disabled={!onNext} onClick={onNext}>Siguiente episodio →</button>
            <button className="player-control" onClick={toggleFullscreen} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}>{fullscreen ? <ArrowsIn size={20} /> : <ArrowsOut size={20} />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
