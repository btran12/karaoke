import { useEffect, useRef } from 'react';

const NOCOOKIE_HOST = 'https://www.youtube-nocookie.com';

let apiPromise = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise(resolve => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

export function YouTubePlayer({ videoId, title, onEnded }) {
  const frameRef = useRef(null);
  const playerRef = useRef(null);
  const readyRef = useRef(false);

  // Refs keep the async API callback and the state-change handler reading fresh
  // values without recreating the player on every render.
  const videoIdRef = useRef(videoId);
  const onEndedRef = useRef(onEnded);
  const titleRef = useRef(title);
  videoIdRef.current = videoId;
  onEndedRef.current = onEnded;
  titleRef.current = title;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let cancelled = false;
    // YT.Player replaces its target element with an <iframe>, so a throwaway
    // holder is created per mount; this keeps StrictMode's double mount safe.
    const holder = document.createElement('div');
    frame.appendChild(holder);

    loadYouTubeApi().then(YT => {
      if (cancelled) { holder.remove(); return; }

      playerRef.current = new YT.Player(holder, {
        host: NOCOOKIE_HOST,
        videoId: videoIdRef.current,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: event => {
            readyRef.current = true;
            // The API builds its own iframe; restore the attributes the raw
            // iframe had so native fullscreen, PiP and captions keep working.
            const iframe = event.target.getIframe?.();
            if (iframe) {
              iframe.setAttribute('allowfullscreen', '');
              iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
              iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
              iframe.setAttribute('title', titleRef.current || 'YouTube player');
            }
          },
          onStateChange: event => {
            if (event.data === YT.PlayerState.ENDED) onEndedRef.current?.();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      readyRef.current = false;
      try { playerRef.current?.destroy?.(); } catch { /* already gone */ }
      playerRef.current = null;
      frame.replaceChildren();
    };
  }, []);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.loadVideoById?.(videoId);
  }, [videoId]);

  return <div className="youtube-frame" ref={frameRef} />;
}
