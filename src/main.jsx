import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Mic2, Heart, ListMusic, Plus, Play, Trash2, X, ChevronUp, ChevronDown, Youtube, Settings2, Check, Palette, Cast, Globe } from 'lucide-react';
import { POPULAR_SONGS, VIETNAMESE_ARTISTS } from './constants';
import { useTranslation } from './translations';
import { normalizeQuery, removeVietnameseAccents } from './utils';
import { VideoCard } from './components/VideoCard';
import { YouTubePlayer } from './components/YouTubePlayer';
import './styles.css';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';
const STORAGE_KEY = 'karaoke-hub-v1';
const THEME_KEY = 'karaoke-theme';
const LANG_KEY = 'karaoke-lang';

const starter = { favorites: [], playlists: [{ id: 'popular-songs', name: 'Popular Songs', videos: POPULAR_SONGS }], queue: [], current: null };

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved.playlists?.some(p => p.id === 'popular-songs')) {
      saved.playlists = [{ id: 'popular-songs', name: 'Popular Songs', videos: POPULAR_SONGS }, ...(saved.playlists || [])];
    }
    return { ...starter, ...saved };
  } catch { return starter; }
}

function App() {
  const [saved, setSaved] = useState(readSaved);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('popular');
  const [activePlaylist, setActivePlaylist] = useState('popular-songs');
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'default');
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) || 'vi');
  const [isCasting, setIsCasting] = useState(false);

  const t = useTranslation(lang);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }, [saved]);
  useEffect(() => { localStorage.setItem(THEME_KEY, theme); document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem(LANG_KEY, lang); document.documentElement.setAttribute('lang', lang); }, [lang]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.chrome) return;

    const checkCastState = () => {
      if (window.cast?.framework?.CastContext) {
        const castContext = window.cast.framework.CastContext.getInstance();
        setIsCasting(!!castContext.getCurrentSession());
        castContext.addEventListener('caststatechanged', () => {
          setIsCasting(!!castContext.getCurrentSession());
        });
      }
    };

    if (window.cast) checkCastState();
    else window['__onGCastApiAvailable'] = isAvailable => { if (isAvailable) checkCastState(); };
  }, []);

  const current = saved.current || null;
  const favoriteIds = useMemo(() => new Set(saved.favorites.map(v => v.id)), [saved.favorites]);
  const update = fn => setSaved(prev => fn(prev));

  const matchingArtists = useMemo(() => {
    const normalizedQuery = removeVietnameseAccents(query);
    return VIETNAMESE_ARTISTS.filter(artist => removeVietnameseAccents(artist).includes(normalizedQuery));
  }, [query]);

  async function search(e) {
    e?.preventDefault();
    const q = normalizeQuery(query);
    if (!q) return;
    if (!API_KEY) { setError(t.errNoKey); setResults([]); return; }
    setLoading(true); setError(''); setActiveTab('search');
    try {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '24', order: 'relevance', q, key: API_KEY });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || t.errSearch);

      const videoIds = (data.items || []).filter(x => x.id?.videoId).map(x => x.id.videoId).join(',');
      const viewCounts = {};
      if (videoIds) {
        const statsParams = new URLSearchParams({ part: 'statistics', id: videoIds, key: API_KEY });
        const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`);
        const statsData = await statsRes.json();
        (statsData.items || []).forEach(item => { viewCounts[item.id] = item.statistics?.viewCount || '0'; });
      }

      setResults((data.items || []).filter(x => x.id?.videoId).map(x => ({
        id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle,
        thumbnail: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url,
        url: `https://www.youtube.com/watch?v=${x.id.videoId}`,
        viewCount: viewCounts[x.id.videoId] || '0'
      })));
      if (!(data.items || []).length) setError(t.errNoResults);
    } catch (err) { setError(`${err.message}. ${t.errCheckKey}`); setResults([]); }
    finally { setLoading(false); }
  }

  function searchArtist(artist) {
    setQuery(artist);
    if (!API_KEY) { setError(t.errNoKey); return; }
    setTimeout(() => document.querySelector('.searchbar-simple button')?.click(), 100);
  }

  function play(video) {
    update(p => ({ ...p, current: video, queue: p.queue.filter(v => v.id !== video.id) }));
    setToast(t.nowPlayingToast);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function addQueue(video) {
    update(p => ({ ...p, queue: p.queue.some(v => v.id === video.id) || p.current?.id === video.id ? p.queue : [...p.queue, video] }));
    setToast(t.addedToQueue);
  }
  function toggleFavorite(video) {
    update(p => ({ ...p, favorites: p.favorites.some(v => v.id === video.id) ? p.favorites.filter(v => v.id !== video.id) : [video, ...p.favorites] }));
  }
  function removeQueue(id) { update(p => ({ ...p, queue: p.queue.filter(v => v.id !== id) })); }
  function handleVideoEnded() {
    // Nothing queued: leave the finished video in place instead of collapsing the player.
    if (!saved.queue.length) return;
    update(p => ({ ...p, current: p.queue[0], queue: p.queue.slice(1) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function moveQueue(index, delta) {
    update(p => { const q = [...p.queue], to = index + delta; if (to < 0 || to >= q.length) return p; [q[index], q[to]] = [q[to], q[index]]; return { ...p, queue: q }; });
  }
  function createPlaylist(e) {
    e.preventDefault();
    const name = playlistName.trim(); if (!name) return;
    if (saved.playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) { setToast(t.playlistExists); return; }
    const item = { id: crypto.randomUUID(), name, videos: [] };
    update(p => ({ ...p, playlists: [...p.playlists, item] }));
    setActivePlaylist(item.id); setPlaylistName(''); setNewPlaylistOpen(false); setActiveTab('playlists');
  }
  function addToPlaylist(video, playlistId) {
    update(p => ({ ...p, playlists: p.playlists.map(list => list.id !== playlistId || list.videos.some(v => v.id === video.id) ? list : { ...list, videos: [...list.videos, video] }) }));
    setToast(t.addedToPlaylist);
  }
  function removeFromPlaylist(playlistId, videoId) {
    update(p => ({ ...p, playlists: p.playlists.map(list => list.id === playlistId ? { ...list, videos: list.videos.filter(v => v.id !== videoId) } : list) }));
  }
  function deletePlaylist(id) {
    if (id === 'popular-songs') return;
    update(p => ({ ...p, playlists: p.playlists.filter(x => x.id !== id) }));
    if (activePlaylist === id) { setActivePlaylist('popular-songs'); setActiveTab('popular'); }
  }
  function startCasting() {
    if (!window.cast?.framework) { setToast(t.cannotCast); return; }
    window.cast.framework.CastContext.getInstance().requestSession()
      .then(() => { setIsCasting(true); setToast(t.casting); })
      .catch(() => setToast(t.noDevice));
  }

  const visibleVideos = activeTab === 'favorites' ? saved.favorites :
                        activeTab === 'search' ? results :
                        (saved.playlists.find(p => p.id === activePlaylist)?.videos || []);

  const listTitle = activeTab === 'favorites' ? t.favoritesTitle :
                    activeTab === 'search' ? t.searchResults :
                    activePlaylist === 'popular-songs' ? t.popularTitle :
                    (saved.playlists.find(p => p.id === activePlaylist)?.name || t.playlistsTitle);

  const userPlaylists = saved.playlists.filter(p => p.id !== 'popular-songs');

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => { setActiveTab('popular'); setActivePlaylist('popular-songs'); }}>
        <Mic2 size={20}/>
        <span>Karaoke Hub</span>
      </a>
      <div className="top-actions">
        <button className="lang-toggle" onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} title={lang === 'vi' ? 'English' : 'Tiếng Việt'}>
          <Globe size={16}/>
          <span>{lang === 'vi' ? 'EN' : 'VI'}</span>
        </button>
        <button className="theme-toggle" onClick={() => setTheme(theme === 'default' ? 'glass' : 'default')} title={t.toggleTheme}>
          <Palette size={16}/>
        </button>
        {API_KEY && <span className="api-status"><span className="status-dot ready"/>{t.connected}</span>}
      </div>
    </header>

    <main>
      {current && <section className="player-section">
        <div className={`player-layout ${saved.queue.length === 0 ? 'no-queue' : ''}`}>
          <div className="player-main">
            <YouTubePlayer videoId={current.id} title={current.title} onEnded={handleVideoEnded}/>
            <div className="playing-meta">
              <div className="playing-title">
                <h3>{current.title}</h3>
                <p>{current.channel}</p>
              </div>
              <div className="player-controls">
                <button className="control-btn" title={t.favorite} onClick={() => toggleFavorite(current)}>
                  <Heart size={18} fill={favoriteIds.has(current.id) ? 'currentColor' : 'none'} className={favoriteIds.has(current.id) ? 'hearted' : ''}/>
                </button>
                <button className={`control-btn ${isCasting ? 'casting' : ''}`} title={t.cast} onClick={startCasting}>
                  <Cast size={18}/>
                </button>
              </div>
            </div>
          </div>

          {saved.queue.length > 0 && <aside className="queue-panel">
            <div className="queue-head">
              <h3>{t.queue} <span>{saved.queue.length}</span></h3>
              <button className="text-button" onClick={() => update(p => ({ ...p, queue: [] }))}>{t.clearAll}</button>
            </div>
            <div className="queue-list">
              {saved.queue.map((video, i) =>
                <div className="queue-row" key={video.id}>
                  <button className="queue-thumb" onClick={() => play(video)}>
                    <img src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt=""/>
                    <Play size={12} fill="currentColor"/>
                  </button>
                  <button className="queue-info" onClick={() => play(video)}>
                    <strong>{video.title}</strong>
                    <span>{video.channel}</span>
                  </button>
                  <div className="queue-actions">
                    <button title={t.moveUp} disabled={i === 0} onClick={() => moveQueue(i, -1)}><ChevronUp size={13}/></button>
                    <button title={t.moveDown} disabled={i === saved.queue.length - 1} onClick={() => moveQueue(i, 1)}><ChevronDown size={13}/></button>
                    <button title={t.remove} onClick={() => removeQueue(video.id)}><X size={13}/></button>
                  </div>
                </div>
              )}
            </div>
          </aside>}
        </div>
      </section>}

      <section className="hero-simple">
        <form className="searchbar-simple" onSubmit={search}>
          <Search size={18}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchPlaceholder} aria-label={t.searchLabel}/>
          <button type="submit" disabled={loading}>
            {loading ? <span className="spinner"/> : t.search}
          </button>
        </form>
        {!API_KEY && <div className="setup-note"><Settings2 size={14}/> {t.setupNote}</div>}
        <div className="artist-suggestions">
          <span className="suggestions-label">{query.trim() ? `${t.suggestions}:` : `${t.popularArtists}:`}</span>
          <div className="artist-chips">
            {query.trim()
              ? (matchingArtists.length
                  ? matchingArtists.slice(0, 8).map(artist =>
                      <button key={artist} className="artist-chip" onClick={() => searchArtist(artist)}>{artist}</button>)
                  : <span className="no-suggestions">{t.noSuggestions}</span>)
              : VIETNAMESE_ARTISTS.slice(0, 10).map(artist =>
                  <button key={artist} className="artist-chip" onClick={() => searchArtist(artist)}>{artist}</button>)}
          </div>
        </div>
      </section>

      <section className="workspace">
        <div className="library-column">
          <nav className="library-nav">
            <button className={activeTab === 'popular' ? 'nav-item selected' : 'nav-item'} onClick={() => { setActiveTab('popular'); setActivePlaylist('popular-songs'); }}>
              <ListMusic size={16}/><span>{t.popularSongs}</span>
            </button>
            <button className={activeTab === 'search' ? 'nav-item selected' : 'nav-item'} onClick={() => setActiveTab('search')}>
              <Search size={16}/><span>{t.discover}</span>
            </button>
            <button className={activeTab === 'favorites' ? 'nav-item selected' : 'nav-item'} onClick={() => setActiveTab('favorites')}>
              <Heart size={16}/><span>{t.favorites}</span><b>{saved.favorites.length}</b>
            </button>
            <div className="nav-divider"/>
            <div className="nav-label">{t.playlists}</div>
            {userPlaylists.map(list =>
              <div key={list.id} className="playlist-nav-row">
                <button className={`nav-item playlist-link ${activeTab === 'playlists' && activePlaylist === list.id ? 'selected' : ''}`}
                  onClick={() => { setActiveTab('playlists'); setActivePlaylist(list.id); }}>
                  <ListMusic size={16}/><span>{list.name}</span><b>{list.videos.length}</b>
                </button>
                <button className="tiny-delete" title={t.deletePlaylist} onClick={() => deletePlaylist(list.id)}><Trash2 size={12}/></button>
              </div>
            )}
            <button className="create-playlist-btn" onClick={() => setNewPlaylistOpen(true)}>
              <Plus size={14}/> {t.newPlaylist}
            </button>
          </nav>
        </div>

        <div className="results-column">
          <div className="section-heading">
            <h2>{listTitle}</h2>
            <span className="count-pill">{visibleVideos.length} {t.song}</span>
          </div>

          {error && <div className="notice"><span>{error}</span><button onClick={() => setError('')} aria-label={t.remove}><X size={16}/></button></div>}

          {activeTab === 'search' && !results.length && !loading &&
            <div className="empty-state">
              <Youtube size={28}/>
              <h3>{t.searchSongs}</h3>
              <p>{t.searchYT}</p>
            </div>}

          {activeTab === 'favorites' && !visibleVideos.length &&
            <div className="empty-state">
              <Heart size={26}/>
              <h3>{t.noFavorites}</h3>
              <p>{t.tapHeart}</p>
            </div>}

          {loading && <div className="loading-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton" key={i}/>)}</div>}

          <div className="video-grid">
            {visibleVideos.map(video =>
              <VideoCard key={video.id} video={video} isFavorite={favoriteIds.has(video.id)} isCurrent={current?.id === video.id}
                playlists={saved.playlists} onPlay={play} onFavorite={toggleFavorite} onQueue={addQueue}
                onAddPlaylist={addToPlaylist}
                onRemovePlaylist={activePlaylist !== 'popular-songs' ? id => removeFromPlaylist(activePlaylist, id) : null}
                t={t}/>
            )}
          </div>
        </div>
      </section>

      <footer>
        <span>{t.footer}</span>
      </footer>
    </main>

    {newPlaylistOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setNewPlaylistOpen(false); }}>
      <form className="modal" onSubmit={createPlaylist}>
        <button className="modal-close" type="button" onClick={() => setNewPlaylistOpen(false)}><X size={18}/></button>
        <h2>{t.newPlaylist}</h2>
        <label htmlFor="playlist-name">{t.playlistName}</label>
        <input id="playlist-name" autoFocus value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder={t.playlistPlaceholder} maxLength={50}/>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={() => setNewPlaylistOpen(false)}>{t.cancel}</button>
          <button type="submit" className="primary-small" disabled={!playlistName.trim()}>{t.create}</button>
        </div>
      </form>
    </div>}

    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
