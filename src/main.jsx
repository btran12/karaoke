import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Mic2, Heart, ListMusic, Plus, Play, Pause, SkipForward, Trash2, Maximize, Music2, X, ChevronUp, ChevronDown, Youtube, Settings2, Check, ExternalLink } from 'lucide-react';
import './styles.css';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || '';
const STORAGE_KEY = 'karaoke-hub-v1';
const starter = { favorites: [], playlists: [], queue: [], current: null };
function readSaved() { try { return { ...starter, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return starter; } }
function normalizeQuery(q) {
  const clean = q.trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return /\bkaraoke\b/i.test(clean) ? clean : `${clean} karaoke`;
}
function fmtCount(n) { if (!n) return ''; const v = Number(n); return Number.isFinite(v) ? new Intl.NumberFormat(undefined, { notation: v > 9999 ? 'compact' : 'standard' }).format(v) : ''; }
function App() {
  const [saved, setSaved] = useState(readSaved);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [newPlaylistOpen, setNewPlaylistOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [toast, setToast] = useState('');
  const playerWrap = useRef(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); }, [saved]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2400); return () => clearTimeout(id); }, [toast]);

  const current = saved.current || null;
  const favoriteIds = useMemo(() => new Set(saved.favorites.map(v => v.id)), [saved.favorites]);
  const update = fn => setSaved(prev => fn(prev));

  async function search(e) {
    e?.preventDefault();
    const q = normalizeQuery(query);
    if (!q) return;
    if (!API_KEY) { setError('Add your YouTube API key to .env (see README) to enable live search. The rest of the app works now.'); setResults([]); return; }
    setLoading(true); setError(''); setActiveTab('search');
    try {
      const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '24', order: 'relevance', q, key: API_KEY });
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube search failed (${res.status})`);
      setResults((data.items || []).filter(x => x.id?.videoId).map(x => ({
        id: x.id.videoId, title: x.snippet.title, channel: x.snippet.channelTitle,
        description: x.snippet.description, thumbnail: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url,
        publishedAt: x.snippet.publishedAt, url: `https://www.youtube.com/watch?v=${x.id.videoId}`
      })));
      if (!(data.items || []).length) setError('No videos found. Try another song or artist.');
    } catch (err) { setError(`${err.message}. Check your API key, API quota, and Google Cloud restrictions.`); setResults([]); }
    finally { setLoading(false); }
  }

  function play(video) {
    update(p => ({ ...p, current: video, queue: p.queue.filter(v => v.id !== video.id) }));
    setToast('Now playing');
  }
  function addQueue(video) {
    update(p => ({ ...p, queue: p.queue.some(v => v.id === video.id) || p.current?.id === video.id ? p.queue : [...p.queue, video] }));
    setToast('Added to queue');
  }
  function toggleFavorite(video) {
    update(p => ({ ...p, favorites: p.favorites.some(v => v.id === video.id) ? p.favorites.filter(v => v.id !== video.id) : [video, ...p.favorites] }));
  }
  function nextTrack() {
    update(p => ({ ...p, current: p.queue[0] || null, queue: p.queue.slice(1) }));
  }
  function removeQueue(id) { update(p => ({ ...p, queue: p.queue.filter(v => v.id !== id) })); }
  function moveQueue(index, delta) {
    update(p => { const q = [...p.queue], to = index + delta; if (to < 0 || to >= q.length) return p; [q[index], q[to]] = [q[to], q[index]]; return { ...p, queue: q }; });
  }
  function createPlaylist(e) {
    e.preventDefault(); const name = playlistName.trim(); if (!name) return;
    if (saved.playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) { setToast('That playlist already exists'); return; }
    const item = { id: crypto.randomUUID(), name, videos: [] };
    update(p => ({ ...p, playlists: [...p.playlists, item] })); setActivePlaylist(item.id); setPlaylistName(''); setNewPlaylistOpen(false); setActiveTab('playlists');
  }
  function addToPlaylist(video, playlistId) {
    update(p => ({ ...p, playlists: p.playlists.map(list => list.id !== playlistId || list.videos.some(v => v.id === video.id) ? list : { ...list, videos: [...list.videos, video] }) }));
    setToast('Saved to playlist');
  }
  function removeFromPlaylist(playlistId, videoId) { update(p => ({ ...p, playlists: p.playlists.map(list => list.id === playlistId ? { ...list, videos: list.videos.filter(v => v.id !== videoId) } : list) })); }
  function deletePlaylist(id) { update(p => ({ ...p, playlists: p.playlists.filter(x => x.id !== id) })); if (activePlaylist === id) setActivePlaylist(null); }
  function fullscreen() {
    const el = playerWrap.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el);
  }

  const visibleVideos = activeTab === 'favorites' ? saved.favorites : activeTab === 'playlists' ? (saved.playlists.find(p => p.id === activePlaylist)?.videos || []) : results;
  const listTitle = activeTab === 'favorites' ? 'Your favorites' : activeTab === 'playlists' ? (saved.playlists.find(p => p.id === activePlaylist)?.name || 'Your playlists') : 'Search results';

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" onClick={() => setActiveTab('search')}><span className="brand-icon"><Mic2 size={22}/></span><span>Karaoke<span className="brand-light">Hub</span><small>YOUR PERSONAL SING-ALONG LIBRARY</small></span></a>
      <div className="top-actions"><span className="api-status"><span className={`status-dot ${API_KEY ? 'ready' : ''}`}/>{API_KEY ? 'Search connected' : 'API key needed'}</span><button className="icon-button" title="API setup" onClick={() => setError('To enable live search, copy .env.example to .env, add VITE_YOUTUBE_API_KEY, enable YouTube Data API v3 in Google Cloud Console, then restart npm run dev.')}><Settings2 size={18}/></button></div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span/> YOUR STAGE STARTS HERE</div><h1>Find your song.<br/><span>Own the moment.</span></h1><p>Search YouTube karaoke tracks, build your setlist, and sing along from one place.</p>
          <form className="searchbar" onSubmit={search}><Search size={21}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a song, artist, or language…" aria-label="Search songs"/><span className="karaoke-tag">+ karaoke</span><button type="submit" disabled={loading}>{loading ? <span className="spinner"/> : 'Search'}</button></form>
          <div className="search-hint"><Check size={14}/> Karaoke is automatically added to every search</div>
          {!API_KEY && <div className="setup-note"><Settings2 size={15}/> Add your API key to turn on YouTube search. <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Get an API key <ExternalLink size={12}/></a></div>}
        </div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="glow-disc"><div className="disc-center"><Mic2 size={62}/></div></div><span className="note note-a">♫</span><span className="note note-b">♪</span><span className="spark spark-a">✦</span><span className="spark spark-b">✧</span></div>
      </section>
      <section className="workspace">
        <div className="library-column">
          <div className="section-heading"><div><span className="section-kicker">YOUR COLLECTION</span><h2>My library</h2></div><button className="small-outline" onClick={() => setNewPlaylistOpen(true)}><Plus size={16}/> New playlist</button></div>
          <nav className="library-nav">
            <button className={activeTab === 'search' ? 'nav-item selected' : 'nav-item'} onClick={() => setActiveTab('search')}><Search size={18}/><span>Discover</span></button>
            <button className={activeTab === 'favorites' ? 'nav-item selected' : 'nav-item'} onClick={() => { setActiveTab('favorites'); setActivePlaylist(null); }}><Heart size={18}/><span>Favorites</span><b>{saved.favorites.length}</b></button>
            <div className="nav-divider"/><div className="nav-label">PLAYLISTS</div>
            {saved.playlists.map(list => <div key={list.id} className="playlist-nav-row"><button className={`nav-item playlist-link ${activeTab === 'playlists' && activePlaylist === list.id ? 'selected' : ''}`} onClick={() => { setActiveTab('playlists'); setActivePlaylist(list.id); }}><ListMusic size={17}/><span>{list.name}</span><b>{list.videos.length}</b></button><button className="tiny-delete" title="Delete playlist" onClick={() => deletePlaylist(list.id)}><Trash2 size={13}/></button></div>)}
            {!saved.playlists.length && <p className="empty-playlists">Your playlists will show up here.</p>}
          </nav>
          <div className="library-tip"><Music2 size={17}/><div><strong>Make it yours</strong><p>Save the songs you love and make a playlist for every mood.</p></div></div>
        </div>
        <div className="results-column">
          <div className="section-heading result-heading"><div><span className="section-kicker">{activeTab === 'search' ? 'DISCOVER SOMETHING GOOD' : 'YOUR SAVED MUSIC'}</span><h2>{listTitle}</h2></div><span className="count-pill">{visibleVideos.length} {visibleVideos.length === 1 ? 'track' : 'tracks'}</span></div>
          {error && <div className="notice"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16}/></button></div>}
          {activeTab === 'search' && !results.length && !loading ? <div className="empty-state"><div className="empty-icon"><Youtube size={29}/></div><h3>What are we singing today?</h3><p>Search a song or artist above. We'll look for karaoke videos and show playable results here.</p><div className="suggestions">{['Bohemian Rhapsody','Dancing Queen','Như Quỳnh'].map(s => <button key={s} onClick={() => { setQuery(s); if (API_KEY) { const q = s; setQuery(q); setTimeout(() => document.querySelector('.searchbar button')?.click(), 0); } else setError('Add your YouTube API key to .env to search for '+normalizeQuery(s)+'.'); }}>{s}<Search size={12}/></button>)}</div></div> : null}
          {activeTab === 'favorites' && !visibleVideos.length && <div className="empty-state"><div className="empty-icon"><Heart size={27}/></div><h3>Your favorites live here</h3><p>Tap the heart on any song to keep it close.</p></div>}
          {activeTab === 'playlists' && !visibleVideos.length && <div className="empty-state"><div className="empty-icon"><ListMusic size={28}/></div><h3>This playlist is ready for a hit</h3><p>Add tracks from search results using the playlist button.</p><button className="primary-small" onClick={() => setActiveTab('search')}>Find songs</button></div>}
          {loading && <div className="loading-grid">{Array.from({length:8},(_,i)=><div className="skeleton" key={i}/>)}</div>}
          <div className="video-grid">{visibleVideos.map(video => <VideoCard key={video.id} video={video} isFavorite={favoriteIds.has(video.id)} isCurrent={current?.id === video.id} playlists={saved.playlists} onPlay={play} onFavorite={toggleFavorite} onQueue={addQueue} onAddPlaylist={addToPlaylist} onRemovePlaylist={activeTab === 'playlists' ? id => removeFromPlaylist(activePlaylist,id) : null}/>)}</div>
        </div>
      </section>
      <section className="player-section">
        <div className="section-heading player-section-heading"><div><span className="section-kicker">YOUR KARAOKE STAGE</span><h2>Now playing</h2></div><div className="live-indicator"><span/> {current ? 'READY TO SING' : 'PLAYER STANDBY'}</div></div>
        <div className="player-layout">
          <div className="player-main" ref={playerWrap}>
            {current ? <><div className="youtube-frame"><iframe key={current.id} src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(current.id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`} title={`YouTube player: ${current.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/><div className="fullscreen-control"><button onClick={fullscreen} title="Fullscreen player"><Maximize size={17}/> Fullscreen</button></div></div><div className="playing-meta"><div className="playing-title"><span className="playing-label"><span/> NOW PLAYING</span><h3>{current.title}</h3><p>{current.channel}</p></div><div className="player-controls"><button className="control-btn" title="Toggle favorite" onClick={() => toggleFavorite(current)}><Heart size={19} fill={favoriteIds.has(current.id) ? 'currentColor' : 'none'} className={favoriteIds.has(current.id) ? 'hearted' : ''}/></button><button className="next-btn" onClick={nextTrack}><SkipForward size={18}/> Next song</button></div></div></> : <div className="player-placeholder"><div className="placeholder-icon"><Play size={27} fill="currentColor"/></div><h3>Your stage is waiting</h3><p>Choose a song from your search results or favorites to start singing.</p></div>}
          </div>
          <aside className="queue-panel"><div className="queue-head"><div><span className="section-kicker">UP NEXT</span><h3>Queue <span>{saved.queue.length}</span></h3></div><button className="text-button" onClick={() => update(p => ({...p, queue: []}))} disabled={!saved.queue.length}>Clear all</button></div>
            {saved.queue.length ? <div className="queue-list">{saved.queue.map((video,i)=><div className="queue-row" key={video.id}><button className="queue-thumb" onClick={() => play(video)}><img src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} alt=""/><Play size={14} fill="currentColor"/></button><button className="queue-info" onClick={() => play(video)}><strong>{video.title}</strong><span>{video.channel}</span></button><div className="queue-actions"><button title="Move up" disabled={i===0} onClick={() => moveQueue(i,-1)}><ChevronUp size={14}/></button><button title="Move down" disabled={i===saved.queue.length-1} onClick={() => moveQueue(i,1)}><ChevronDown size={14}/></button><button title="Remove" onClick={() => removeQueue(video.id)}><X size={14}/></button></div></div>)}</div> : <div className="queue-empty"><ListMusic size={25}/><p>Your queue is empty</p><span>Add songs to keep the music going.</span></div>}
            <div className="queue-footer"><span><Music2 size={14}/> {saved.queue.length} upcoming</span><span>Sing it loud ✦</span></div>
          </aside>
        </div>
      </section>
      <footer><a className="footer-brand" href="#home"><Mic2 size={17}/> KaraokeHub</a><span>Made for the love of singing.</span><span className="footer-note">Video playback powered by YouTube</span></footer>
    </main>
    {newPlaylistOpen && <div className="modal-backdrop" onMouseDown={e => { if(e.target === e.currentTarget) setNewPlaylistOpen(false); }}><form className="modal" onSubmit={createPlaylist}><button className="modal-close" type="button" onClick={() => setNewPlaylistOpen(false)}><X size={18}/></button><div className="modal-icon"><ListMusic size={23}/></div><h2>Create a playlist</h2><p>Give your next sing-along session a name.</p><label htmlFor="playlist-name">Playlist name</label><input id="playlist-name" autoFocus value={playlistName} onChange={e => setPlaylistName(e.target.value)} placeholder="e.g. 90s classics" maxLength={50}/><div className="modal-actions"><button type="button" className="cancel-btn" onClick={() => setNewPlaylistOpen(false)}>Cancel</button><button type="submit" className="primary-small" disabled={!playlistName.trim()}>Create playlist</button></div></form></div>}
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}

function VideoCard({video,isFavorite,isCurrent,playlists,onPlay,onFavorite,onQueue,onAddPlaylist,onRemovePlaylist}) {
  const [menu,setMenu] = useState(false);
  return <article className={`video-card ${isCurrent ? 'is-current' : ''}`}>
    <button className="thumbnail" onClick={() => onPlay(video)} aria-label={`Play ${video.title}`}><img src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} loading="lazy" alt=""/><span className="thumbnail-overlay"><span className="play-circle"><Play size={21} fill="currentColor"/></span></span><span className="yt-mark"><Youtube size={16}/></span>{isCurrent && <span className="now-badge">NOW PLAYING</span>}</button>
    <div className="video-info"><button className="video-title" onClick={() => onPlay(video)} title={video.title}>{video.title}</button><div className="video-channel">{video.channel}</div><div className="card-actions"><button className={`card-action ${isFavorite ? 'favorite-on' : ''}`} onClick={() => onFavorite(video)} title={isFavorite ? 'Remove favorite' : 'Add favorite'}><Heart size={16} fill={isFavorite ? 'currentColor' : 'none'}/></button><button className="card-action queue-add" onClick={() => onQueue(video)} title="Add to queue"><Plus size={16}/><span>Queue</span></button><div className="playlist-menu-wrap"><button className="card-action" onClick={() => setMenu(!menu)} title="Add to playlist"><ListMusic size={16}/></button>{menu && <><button className="menu-dismiss" aria-label="Close menu" onClick={() => setMenu(false)}/><div className="playlist-menu">{playlists.length ? playlists.map(p=><button key={p.id} onClick={() => { onAddPlaylist(video,p.id); setMenu(false); }}><ListMusic size={14}/>{p.name}</button>) : <span>Create a playlist first.</span>}</div></>}</div>{onRemovePlaylist && <button className="card-action remove-track" title="Remove from playlist" onClick={() => onRemovePlaylist(video.id)}><Trash2 size={15}/></button>}</div></div>
  </article>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
