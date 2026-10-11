import React, { useState } from 'react';
import { Heart, Plus, ListMusic, Trash2, Play, X } from 'lucide-react';
import { formatViewCount } from '../utils';

export function VideoCard({video, isFavorite, isCurrent, playlists, onPlay, onFavorite, onQueue, onAddPlaylist, onRemovePlaylist, t}) {
  const [menu, setMenu] = useState(false);
  
  return (
    <article className={`video-card ${isCurrent ? 'is-current' : ''}`}>
      <button 
        className="thumbnail" 
        onClick={() => onPlay(video)} 
        aria-label={`Phát ${video.title}`}
      >
        <img 
          src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`} 
          loading="lazy" 
          alt=""
        />
        <span className="thumbnail-overlay">
          <span className="play-circle">
            <Play size={20} fill="currentColor"/>
          </span>
        </span>
        {isCurrent && <span className="now-badge">{t.nowPlaying}</span>}
        {video.viewCount !== undefined && video.viewCount !== null && (
          <span className="view-count">
            {formatViewCount(video.viewCount)} {t.views}
          </span>
        )}
      </button>
      
      <div className="video-info">
        <button 
          className="video-title" 
          onClick={() => onPlay(video)} 
          title={video.title}
        >
          {video.title}
        </button>
        <div className="video-channel">{video.channel}</div>
        
        <div className="card-actions">
          <button 
            className={`card-action ${isFavorite ? 'favorite-on' : ''}`} 
            onClick={() => onFavorite(video)} 
            title={isFavorite ? t.removeFavorite : t.addFavorite}
          >
            <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'}/>
          </button>
          
          <button 
            className="card-action queue-add" 
            onClick={() => onQueue(video)} 
            title={t.addToQueue}
          >
            <Plus size={15}/>
            <span>{t.queue}</span>
          </button>
          
          <div className="playlist-menu-wrap">
            <button 
              className="card-action" 
              onClick={() => setMenu(!menu)} 
              title={t.addToPlaylist}
            >
              <ListMusic size={15}/>
            </button>
            
            {menu && (
              <>
                <button 
                  className="menu-dismiss" 
                  aria-label={t.closeMenu} 
                  onClick={() => setMenu(false)}
                />
                <div className="playlist-menu">
                  {playlists.length ? (
                    playlists.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => { 
                          onAddPlaylist(video, p.id); 
                          setMenu(false); 
                        }}
                      >
                        <ListMusic size={13}/>
                        {p.name}
                      </button>
                    ))
                  ) : (
                    <span>{t.noPlaylists}</span>
                  )}
                </div>
              </>
            )}
          </div>
          
          {onRemovePlaylist && (
            <button 
              className="card-action remove-track" 
              title={t.remove} 
              onClick={() => onRemovePlaylist(video.id)}
            >
              <Trash2 size={14}/>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
