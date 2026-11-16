import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CaretLeft, CaretRight, Compass, MagnifyingGlass, Play, SignOut, User, X } from '@phosphor-icons/react';
import VideoPlayer from './VideoPlayer';
import pokemonData from './data/pokemon_episodes.json';
import { useAuth } from './context/AuthContext';
import { useProgress } from './context/ProgressContext';
import { getContinueWatching } from './lib/continueWatching';
import journeyHero from './assets/journey-hero.webp';

const episodes = pokemonData.flatMap((season) => season.episodes.map((episode) => ({
  ...episode, seasonId: season.id, seasonName: season.name,
})));
const PAGE_SIZE = 50;
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const episodeKey = (episode) => `${episode.seasonId}_${episode.number}`;
const shortSeason = (name) => name.replace(/^Temporada\s+\d+\s*[-–]\s*/i, '').replace(/^Pokémon\s*:?\s*/i, '');
const synopsisCache = new Map();

function useSynopsis(episode) {
  const key = episode ? episodeKey(episode) : null;
  const localDescription = episode?.description;
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!key || localDescription) return;
    const cached = synopsisCache.get(key);
    if (cached) return;
    const controller = new AbortController();
    const [season, number] = key.split('_');
    fetch(`/api/synopsis?season=${encodeURIComponent(season)}&episode=${encodeURIComponent(number)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (controller.signal.aborted) return;
        const value = { key, description: data?.description || '', source: data?.source || null };
        synopsisCache.set(key, value);
        setResult(value);
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ key, description: '', source: null }); });
    return () => controller.abort();
  }, [key, localDescription]);
  if (!episode) return null;
  if (localDescription) return { description: localDescription };
  const current = result?.key === key ? result : synopsisCache.get(key);
  if (current) return { ...current, description: current.description || 'No hay una sinopsis disponible para este episodio.' };
  return { description: 'Buscando sinopsis…' };
}

function App() {
  const { currentUser, loginWithGoogle, logout, isConfigured } = useAuth();
  const { progressData, seenEpisodes, loading } = useProgress();
  const [selectedSeasonId, setSelectedSeasonId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const dialogRef = useRef(null);
  const seasonRailRef = useRef(null);

  useEffect(() => {
    if (!selectedEpisode) return;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const selector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';
    dialog?.querySelector('button')?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') setSelectedEpisode(null);
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll(selector)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [selectedEpisode]);

  const continueWatching = useMemo(() => getContinueWatching(pokemonData, progressData), [progressData]);
  const featured = continueWatching?.episode || episodes[0];
  const featuredSynopsis = useSynopsis(featured);
  const selectedSynopsis = useSynopsis(selectedEpisode);
  const featuredIndex = episodes.findIndex((episode) => episodeKey(episode) === episodeKey(featured));
  const nextEpisode = episodes[featuredIndex + 1];
  const activeSeason = pokemonData.find((season) => String(season.id) === selectedSeasonId);
  const currentEpisodes = activeSeason ? activeSeason.episodes : episodes;
  const canonCount = currentEpisodes.filter((episode) => episode.status === 'Historia').length;
  const canonPct = Math.round(canonCount / currentEpisodes.length * 100);
  const filtered = useMemo(() => {
    const query = normalize(searchQuery.trim());
    return episodes.filter((episode) => {
      const matchesSeason = selectedSeasonId === 'all' || String(episode.seasonId) === selectedSeasonId;
      const matchesType = filterType === 'all' || (filterType === 'canon' ? episode.status === 'Historia' : episode.status === 'Relleno');
      const matchesSearch = !query || normalize(episode.title).includes(query) || String(episode.number) === query || String(episode.global_number) === query;
      return matchesSeason && matchesType && matchesSearch;
    });
  }, [selectedSeasonId, filterType, searchQuery]);

  function chooseSeason(id) { setSelectedSeasonId(id); setVisibleCount(PAGE_SIZE); }
  function chooseFilter(value) { setFilterType(value); setVisibleCount(PAGE_SIZE); }
  function openEpisode(episode, tab = 'details') { setSelectedEpisode(episode); setActiveTab(tab); }
  const progress = continueWatching?.kind === 'resume' ? continueWatching.progress : null;
  const progressMinutes = progress?.time > 0 ? Math.floor(progress.time / 60) : 0;
  const progressPercent = progress?.duration > 0 ? Math.min(100, Math.max(0, progress.time / progress.duration * 100)) : null;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#episodios">Saltar a episodios</a>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Pokédex Anime, inicio">
          <Compass className="brand-icon" size={38} weight="duotone" aria-hidden="true" />
          <span>Pokédex <em>Anime</em></span>
        </a>
        <nav className="header-nav" aria-label="Navegación principal">
          <a href="#episodios" className="nav-active"><BookOpen size={19} /> Episodios</a>
          <a href="#temporadas"><Compass size={19} /> Temporadas</a>
        </nav>
        <div className="header-right">
          <span className="series-count">La serie de Ash · <strong>{episodes.length.toLocaleString('es-ES')} episodios</strong></span>
          {currentUser ? (
            <div className="account"><span>{currentUser.displayName?.split(' ')[0] || 'Mi cuenta'}</span><button className="account-button" onClick={logout} aria-label="Cerrar sesión"><SignOut size={19} /> Salir</button></div>
          ) : isConfigured ? (
            <button className="login-button" onClick={loginWithGoogle}><User size={19} /> Iniciar sesión</button>
          ) : <span className="cloud-notice">Progreso en la nube no configurado</span>}
        </div>
      </header>

      <main id="inicio" className="page-content">
        <section className="hero" aria-labelledby="hero-title">
          <img className="hero-art" src={journeyHero} alt="" />
          <div className="hero-copy">
            <p className="eyebrow">{loading && currentUser ? 'CARGANDO TU VIAJE' : continueWatching?.kind === 'next' ? 'TU SIGUIENTE EPISODIO' : continueWatching?.kind === 'complete' ? 'VIAJE COMPLETADO' : continueWatching ? 'CONTINÚA TU VIAJE' : 'COMIENZA TU VIAJE'}</p>
            <h1 id="hero-title">{featured.title}</h1>
            <p className="hero-description">{featuredSynopsis.description}</p>
            {featuredSynopsis.source && <a className="synopsis-source" href={featuredSynopsis.source.url} target="_blank" rel="noopener noreferrer">Sinopsis: {featuredSynopsis.source.name}</a>}
            <div className="hero-meta"><span>Ep. {featured.number}</span><span>Temporada {featured.seasonId}</span><span>#{featured.global_number} global</span></div>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => openEpisode(featured, 'player')}><Play size={19} weight="fill" /> {continueWatching?.kind === 'next' ? 'Ver episodio' : continueWatching?.kind === 'complete' ? 'Volver a ver' : continueWatching ? 'Continuar episodio' : 'Empezar episodio'}</button>
              <button className="secondary-button" disabled={!nextEpisode} onClick={() => nextEpisode && openEpisode(nextEpisode, 'player')}><span>Siguiente episodio</span><CaretRight size={18} /></button>
            </div>
            {progress && progressMinutes > 0 ? (
              <div className="watch-progress">
                {progressPercent !== null && <progress value={progressPercent} max="100" aria-label="Progreso del episodio" />}
                <span>Visto: {progressMinutes} min{progress?.duration > 0 ? ` de ${Math.floor(progress.duration / 60)} min` : ''}</span>
              </div>
            ) : !currentUser ? <p className="hero-hint">Inicia sesión para guardar tu progreso.</p> : null}
          </div>
        </section>

        <section id="temporadas" className="seasons" aria-label="Seleccionar temporada">
          <div className="season-heading"><Compass size={28} /><h2>Temporadas</h2></div>
          <button className="rail-arrow" aria-label="Temporadas anteriores" onClick={() => seasonRailRef.current?.scrollBy({ left: -450, behavior: 'smooth' })}><CaretLeft size={18} /></button>
          <div className="season-rail" ref={seasonRailRef}>
            <button className={selectedSeasonId === 'all' ? 'season-pill active' : 'season-pill'} aria-pressed={selectedSeasonId === 'all'} onClick={() => chooseSeason('all')}><strong>Todas</strong><span>La serie</span></button>
            {pokemonData.map((season) => <button key={season.id} className={selectedSeasonId === String(season.id) ? 'season-pill active' : 'season-pill'} aria-pressed={selectedSeasonId === String(season.id)} onClick={() => chooseSeason(String(season.id))}><strong>T{season.id}</strong><span>{shortSeason(season.name)}</span></button>)}
          </div>
          <button className="rail-arrow" aria-label="Más temporadas" onClick={() => seasonRailRef.current?.scrollBy({ left: 450, behavior: 'smooth' })}><CaretRight size={18} /></button>
        </section>

        <section id="episodios" className="catalog" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div><p className="section-kicker">LA GUÍA DE EPISODIOS</p><h2 id="catalog-title">{activeSeason ? <>Temporada {activeSeason.id} <span>· {shortSeason(activeSeason.name)}</span></> : 'Todas las temporadas'}</h2>
              <p className="catalog-meta">{currentEpisodes.length} episodios <span>·</span> {canonPct}% historia</p></div>
            <span className="catalog-index">GUÍA DE VIAJE / {activeSeason ? String(activeSeason.id).padStart(2, '0') : '01—25'}</span>
          </div>
          <div className="catalog-controls">
            <label className="search"><MagnifyingGlass size={23} aria-hidden="true" /><span className="sr-only">Buscar por título, número de capítulo o número global</span><input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="Buscar por título o número de episodio..." /></label>
            <div className="filters" role="group" aria-label="Filtrar por clasificación"><span>Filtrar:</span>{[['all', 'Todos'], ['canon', 'Historia'], ['filler', 'Relleno']].map(([value, label]) => <button key={value} className={filterType === value ? 'filter active' : 'filter'} aria-pressed={filterType === value} onClick={() => chooseFilter(value)}>{label}</button>)}</div>
          </div>
          <div className="results-line"><span>{filtered.length} {filtered.length === 1 ? 'episodio' : 'episodios'}</span>{(searchQuery || filterType !== 'all' || selectedSeasonId !== 'all') && <button onClick={() => { chooseSeason('all'); chooseFilter('all'); setSearchQuery(''); }}>Limpiar filtros</button>}</div>
          {filtered.length ? <div className="episode-list">
            {filtered.slice(0, visibleCount).map((episode) => {
              const isFinished = progressData[episodeKey(episode)]?.finished === true;
              const isWatching = continueWatching?.kind === 'resume' && episodeKey(featured) === episodeKey(episode);
              const wasSeen = seenEpisodes.has(episodeKey(episode));
              return <button className="episode-row" key={episodeKey(episode)} onClick={() => openEpisode(episode)}>
                <span className="episode-number">Ep. {episode.number}</span>
                <span className="episode-information"><strong>{episode.title}</strong><span>{episode.description || `Temporada ${episode.seasonId} · Episodio global ${episode.global_number}`}</span></span>
                <span className={episode.status === 'Historia' ? 'status-tag canon' : 'status-tag filler'}>{episode.status === 'Historia' ? 'CANON' : 'RELLENO'}</span>
                <span className="episode-kind"><BookOpen size={20} /> {isFinished ? 'Terminado' : isWatching ? 'Viendo' : wasSeen ? 'Visto' : episode.status === 'Historia' ? 'Historia' : 'Relleno'}</span>
                <CaretRight className="row-arrow" size={20} />
              </button>;
            })}
          </div> : <div className="empty-state"><h3>No encontramos episodios</h3><p>Prueba con otro título o cambia los filtros.</p></div>}
          {visibleCount < filtered.length && <div className="load-more"><button className="secondary-button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Mostrar más episodios <CaretRight size={16} /></button><span>Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length}</span></div>}
        </section>
        <footer className="site-footer"><span>Pokédex <em>Anime</em></span><span>Una guía para volver a vivir la aventura.</span></footer>
      </main>

      {selectedEpisode && <div className="modal-backdrop" onClick={() => setSelectedEpisode(null)}>
        <div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="episode-dialog-title" onClick={(event) => event.stopPropagation()}>
          <button className="modal-close" aria-label="Cerrar detalles" onClick={() => setSelectedEpisode(null)}><X size={22} /></button>
          <p className="eyebrow">TEMPORADA {selectedEpisode.seasonId} · EPISODIO {selectedEpisode.number}</p>
          <h2 id="episode-dialog-title">{selectedEpisode.title}</h2>
          <p className="modal-subtitle">Episodio global #{selectedEpisode.global_number} <span>·</span> {selectedEpisode.status === 'Historia' ? 'Historia (canon)' : 'Relleno'}</p>
          <div className="modal-tabs"><button className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>Información</button><button className={activeTab === 'player' ? 'active' : ''} onClick={() => setActiveTab('player')}>Reproductor</button></div>
          {activeTab === 'details' ? <div className="modal-details"><p className="section-kicker">SINOPSIS</p><p>{selectedSynopsis.description}</p>{selectedSynopsis.source && <a className="synopsis-source" href={selectedSynopsis.source.url} target="_blank" rel="noopener noreferrer">Sinopsis: {selectedSynopsis.source.name}</a>}<div className="modal-actions"><button className="primary-button" onClick={() => setActiveTab('player')}><Play weight="fill" size={17} /> Ver episodio</button><a className="external-link" href={`https://pkproject.net/episodios/serie-ash/temporada-${selectedEpisode.seasonId}/episodio-${selectedEpisode.number}`} target="_blank" rel="noopener noreferrer">Abrir en Pokémon Project <CaretRight size={16} /></a></div></div> :
            <div className="video-frame"><VideoPlayer m3u8Url={`/pkvideo/descargas/stream/serie-ash/t${String(selectedEpisode.seasonId).padStart(2, '0')}/e${String(selectedEpisode.number).padStart(2, '0')}/t${String(selectedEpisode.seasonId).padStart(2, '0')}_e${String(selectedEpisode.number).padStart(2, '0')}.master.m3u8`} episodeId={episodeKey(selectedEpisode)} /></div>}
        </div>
      </div>}
    </div>
  );
}

export default App;
