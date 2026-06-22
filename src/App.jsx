import React, { useState, useMemo } from 'react';
import VideoPlayer from './VideoPlayer';
import pokemonData from './data/pokemon_episodes.json';
import { useAuth } from './context/AuthContext';
import { useProgress } from './context/ProgressContext';

function App() {
  const { currentUser, loginWithGoogle, logout } = useAuth();
  const { seenEpisodes, currentlyWatching } = useProgress();

  const [selectedSeasonId, setSelectedSeasonId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, canon, filler
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [activeTab, setActiveTab] = useState('details'); // details, player

  // Parse seasons and precalculate stats
  const seasonsWithStats = useMemo(() => {
    return pokemonData.map(season => {
      const total = season.episodes.length;
      const canon = season.episodes.filter(ep => ep.status === 'Historia').length;
      const filler = total - canon;
      const canonPct = total > 0 ? Math.round((canon / total) * 100) : 0;
      
      // Calculate if season is completed (all canon episodes seen)
      const canonEpisodes = season.episodes.filter(ep => ep.status === 'Historia');
      const isCompleted = canonEpisodes.length > 0 && canonEpisodes.every(ep => seenEpisodes.has(`${season.id}_${ep.number}`));

      return {
        ...season,
        isCompleted,
        stats: { total, canon, filler, canonPct }
      };
    });
  }, [seenEpisodes]);

  // Filter episodes based on selected season, search query and filler filter
  const filteredEpisodes = useMemo(() => {
    let list = [];
    
    if (selectedSeasonId === 'all') {
      // Flatten all episodes and add season context to each
      pokemonData.forEach(season => {
        season.episodes.forEach(ep => {
          list.push({
            ...ep,
            seasonId: season.id,
            seasonName: season.name
          });
        });
      });
    } else {
      const season = pokemonData.find(s => s.id === Number(selectedSeasonId));
      if (season) {
        list = season.episodes.map(ep => ({
          ...ep,
          seasonId: season.id,
          seasonName: season.name
        }));
      }
    }

    // Apply Search Filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(ep => 
        ep.title.toLowerCase().includes(query) ||
        ep.number.toString() === query ||
        ep.global_number.toString() === query
      );
    }

    // Apply Status Filter
    if (filterType === 'canon') {
      list = list.filter(ep => ep.status === 'Historia');
    } else if (filterType === 'filler') {
      list = list.filter(ep => ep.status === 'Relleno');
    }

    return list;
  }, [selectedSeasonId, searchQuery, filterType]);

  // Overall stats for the current view
  const currentViewStats = useMemo(() => {
    let total = 0;
    let canon = 0;
    
    if (selectedSeasonId === 'all') {
      seasonsWithStats.forEach(s => {
        total += s.stats.total;
        canon += s.stats.canon;
      });
    } else {
      const s = seasonsWithStats.find(s => s.id === Number(selectedSeasonId));
      if (s) {
        total = s.stats.total;
        canon = s.stats.canon;
      }
    }
    
    const filler = total - canon;
    const canonPct = total > 0 ? Math.round((canon / total) * 100) : 0;
    const fillerPct = total > 0 ? Math.round((filler / total) * 100) : 0;

    return { total, canon, filler, canonPct, fillerPct };
  }, [selectedSeasonId, seasonsWithStats]);

  const activeSeasonName = useMemo(() => {
    if (selectedSeasonId === 'all') return 'Todas las Temporadas';
    const s = pokemonData.find(s => s.id === Number(selectedSeasonId));
    return s ? s.name : '';
  }, [selectedSeasonId]);

  return (
    <div className="pokedex-app">
      {/* Pokedex Header */}
      <header className="pokedex-header glass">
        <div className="pokedex-logo-section">
          <div className="pokedex-lens"></div>
          <div className="pokedex-lights">
            <div className="light red"></div>
            <div className="light yellow"></div>
            <div className="light green"></div>
          </div>
          <h1 className="pokedex-title">
            POKÉDEX <span>ANIME</span>
          </h1>
        </div>
        <div className="pokedex-stats-quick" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} className="hide-mobile">
            Serie Completa • <strong>1226 Episodios</strong>
          </span>
          {currentUser ? (
            <div className="user-profile">
              <img src={currentUser.photoURL || 'https://via.placeholder.com/32'} alt="Avatar" className="user-avatar" />
              <div className="user-info">
                <span className="user-name">{currentUser.displayName?.split(' ')[0]}</span>
                <button onClick={logout} className="logout-btn">Salir</button>
              </div>
            </div>
          ) : (
            <button onClick={loginWithGoogle} className="login-btn">
              <span className="google-icon">G</span> Iniciar Sesión
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        
        {/* Sidebar seasons navigation */}
        <aside className="sidebar-panel glass">
          <div className="sidebar-title">
            <span>TEMPORADAS</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>25 en Total</span>
          </div>
          <div className="seasons-list">
            <button
              onClick={() => setSelectedSeasonId('all')}
              className={`season-btn ${selectedSeasonId === 'all' ? 'active' : ''}`}
            >
              <span className="season-btn-name">Todas las Temporadas</span>
              <span className="season-btn-stats">1226 caps • 25 temp</span>
            </button>
            
            {seasonsWithStats.map(season => (
              <button
                key={season.id}
                onClick={() => setSelectedSeasonId(season.id.toString())}
                className={`season-btn ${selectedSeasonId === season.id.toString() ? 'active' : ''} ${season.isCompleted ? 'completed' : ''}`}
              >
                <span className="season-btn-name">
                  {season.name} {season.isCompleted && '✅'}
                </span>
                <span className="season-btn-stats">
                  {season.stats.total} caps • {season.stats.canonPct}% canon
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Dashboard Content */}
        <main className="main-content">
          
          {/* Season Stats Banner */}
          <section className="stats-banner glass">
            <div className="stats-card">
              <span className="stats-label">Temporada Activa</span>
              <div className="stats-val-group">
                <span className="stats-value" style={{ fontSize: '1.25rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '300px' }}>
                  {activeSeasonName}
                </span>
              </div>
              <span className="stats-percentage">Total: {currentViewStats.total} episodios</span>
            </div>

            <div className="stats-card">
              <span className="stats-label">Episodios de Historia (Canon)</span>
              <div className="stats-val-group">
                <span className="stats-value green">{currentViewStats.canon}</span>
                <span className="stats-percentage">{currentViewStats.canonPct}% de la serie</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill green" 
                  style={{ width: `${currentViewStats.canonPct}%` }}
                ></div>
              </div>
            </div>

            <div className="stats-card">
              <span className="stats-label">Episodios de Relleno</span>
              <div className="stats-val-group">
                <span className="stats-value red">{currentViewStats.filler}</span>
                <span className="stats-percentage">{currentViewStats.fillerPct}% de la serie</span>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill red" 
                  style={{ width: `${currentViewStats.fillerPct}%` }}
                ></div>
              </div>
            </div>
          </section>

          {/* Search & Filter Controls */}
          <section className="controls-bar glass">
            <div className="search-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Buscar por título, N° capítulo o N° global..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="filters-wrapper">
              <button
                className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Todos
              </button>
              <button
                className={`filter-btn ${filterType === 'canon' ? 'active' : ''}`}
                onClick={() => setFilterType('canon')}
              >
                Solo Canon ✅
              </button>
              <button
                className={`filter-btn ${filterType === 'filler' ? 'active' : ''}`}
                onClick={() => setFilterType('filler')}
              >
                Solo Relleno ❌
              </button>
            </div>
          </section>

          {/* Episodes Grid */}
          {filteredEpisodes.length > 0 ? (
            <div className="episode-grid">
              {filteredEpisodes.map((ep) => {
                const epKey = `${ep.seasonId}_${ep.number}`;
                const isSeen = seenEpisodes.has(epKey);
                const isWatching = currentlyWatching === epKey;
                
                return (
                <div
                  key={epKey}
                  className={`episode-card glass ${ep.status === 'Historia' ? 'canon' : 'filler'} ${isSeen ? 'seen' : ''} ${isWatching ? 'watching' : ''}`}
                  onClick={() => { setSelectedEpisode(ep); setActiveTab('details'); }}
                >
                  <div className="ep-card-header">
                    <div className="ep-badge-group">
                      <span className="ep-number">Cap. {ep.number}</span>
                      <span className="ep-global">Global: #{ep.global_number}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isWatching && <span className="ep-watching-badge">Viendo 👀</span>}
                      {isSeen && !isWatching && <span className="ep-seen-badge">Visto ✅</span>}
                      <span className={`ep-status-badge ${ep.status === 'Historia' ? 'canon' : 'filler'}`}>
                        {ep.status === 'Historia' ? 'Canon' : 'Relleno'}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="ep-title">{ep.title}</h3>
                  {selectedSeasonId === 'all' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--neon-blue)', fontWeight: 600 }}>
                      {ep.seasonName.split(' - ')[0]}
                    </span>
                  )}
                  {ep.description && (
                    <p className="ep-desc">{ep.description}</p>
                  )}
                </div>
              )})}
            </div>
          ) : (
            <div className="empty-state glass">
              <span className="empty-state-icon">🚫</span>
              <p className="empty-state-text">No se encontraron episodios que coincidan con la búsqueda.</p>
            </div>
          )}
        </main>
      </div>

      {/* Episode Detail Drawer/Modal */}
      {selectedEpisode && (
        <div className="details-modal" onClick={() => setSelectedEpisode(null)}>
          <div 
            className="details-content glass" 
            onClick={(e) => e.stopPropagation()}
            style={{ borderTop: `4px solid ${selectedEpisode.status === 'Historia' ? 'var(--neon-green)' : 'var(--neon-red)'}` }}
          >
            <button 
              className="details-close-btn"
              onClick={() => setSelectedEpisode(null)}
            >
              ✕
            </button>
            
            <div className="details-ep-number">
              Capítulo {selectedEpisode.number} • Global #{selectedEpisode.global_number}
            </div>
            
            <h2 className="details-ep-title">{selectedEpisode.title}</h2>

            {/* Modal Tabs */}
            <div className="modal-tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
              <button 
                className={`modal-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                onClick={() => setActiveTab('details')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: activeTab === 'details' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-header)',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'details' ? '2px solid var(--neon-blue)' : 'none',
                  paddingBottom: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
              >
                Información
              </button>
              <button 
                className={`modal-tab-btn ${activeTab === 'player' ? 'active' : ''}`}
                onClick={() => setActiveTab('player')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: activeTab === 'player' ? 'var(--neon-blue)' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-header)',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'player' ? '2px solid var(--neon-blue)' : 'none',
                  paddingBottom: '0.25rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
              >
                ▶ Reproductor
              </button>
            </div>

            {activeTab === 'details' ? (
              <>
                <div className="details-meta-row">
                  <div className="details-meta-item">
                    <span className="details-meta-label">Temporada</span>
                    <span className="details-meta-val">{selectedEpisode.seasonName}</span>
                  </div>
                  <div className="details-meta-item">
                    <span className="details-meta-label">Clasificación</span>
                    <span 
                      className="details-meta-val" 
                      style={{ color: selectedEpisode.status === 'Historia' ? 'var(--neon-green)' : 'var(--neon-red)' }}
                    >
                      {selectedEpisode.status === 'Historia' ? 'Historia (Canon) ✅' : 'Relleno (Filler) ❌'}
                    </span>
                  </div>
                </div>
                
                <div className="details-description-section">
                  <h4 className="details-desc-title">Sinopsis / Detalles</h4>
                  <p className="details-desc">
                    {selectedEpisode.description || 
                      "Este episodio pertenece a la historia principal de la aventura de Ash. Para este capítulo, no hay una sinopsis detallada disponible en Pokémaster, pero puedes disfrutarlo sabiendo que es " + 
                      (selectedEpisode.status === 'Historia' ? 'relevante para la trama (evoluciones, gimnasios, combates clave o capturas).' : 'un episodio de relleno que puedes omitir sin perderte avances en la historia principal.')
                    }
                  </p>
                </div>
                
                <div className="details-action-section" style={{ marginTop: '2rem', display: 'flex' }}>
                  <a 
                    href={`https://pkproject.net/episodios/serie-ash/temporada-${selectedEpisode.seasonId}/episodio-${selectedEpisode.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="watch-btn"
                    style={{
                      background: selectedEpisode.status === 'Historia' ? 'var(--neon-green)' : 'var(--neon-red)',
                      color: '#000',
                      textDecoration: 'none',
                      padding: '0.8rem 1.5rem',
                      borderRadius: '10px',
                      fontWeight: '800',
                      textAlign: 'center',
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: selectedEpisode.status === 'Historia' ? '0 0 15px rgba(0, 230, 118, 0.3)' : '0 0 15px rgba(255, 70, 85, 0.3)',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    ▶ VER EPISODIO EN POKÉMON PROJECT
                  </a>
                </div>
              </>
            ) : (
              <div style={{ 
                marginTop: '1.5rem',
                borderRadius: '12px',
                overflow: 'hidden',
                background: '#000',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                position: 'relative',
                paddingTop: '56.25%' /* 16:9 Aspect Ratio */
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0
                }}>
                  <VideoPlayer 
                    m3u8Url={`/pkvideo/descargas/stream/serie-ash/t${String(selectedEpisode.seasonId).padStart(2, '0')}/e${String(selectedEpisode.number).padStart(2, '0')}/t${String(selectedEpisode.seasonId).padStart(2, '0')}_e${String(selectedEpisode.number).padStart(2, '0')}.master.m3u8`}
                    episodeId={`${selectedEpisode.seasonId}_${selectedEpisode.number}`}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
