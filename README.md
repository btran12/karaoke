# Karaoke Hub — React starter

A personal karaoke library powered by YouTube Data API v3 and the YouTube embedded player.

## Features

- Search YouTube videos with `karaoke` automatically appended to the search query.
- Restricts search results to videos marked embeddable by YouTube.
- Embedded playback with fullscreen support.
- Favorites, custom playlists, and an upcoming queue with reorder/remove/clear controls.
- Saves favorites, playlists, queue, and current selection in browser `localStorage`.
- Responsive dark interface designed for desktop, mobile, and TV-sized displays.

## Requirements

- Node.js 18+ (Node 20+ recommended)
- A Google Cloud project with **YouTube Data API v3** enabled and an API key created.

## Run locally

1. Copy `.env.example` to `.env`.
2. Replace the placeholder with your YouTube Data API key:

   ```env
   VITE_YOUTUBE_API_KEY=your_actual_key_here
   ```

3. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

If you change `.env`, restart the dev server.

## Create a YouTube API key

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project.
3. Go to **APIs & Services → Library**, enable **YouTube Data API v3**.
4. Go to **APIs & Services → Credentials → Create credentials → API key**.
5. For a public deployment, restrict the key by **HTTP referrers** (your site's domains) and by API (YouTube Data API v3). Do not commit `.env` to source control.

**Security note:** Vite's `VITE_` variables are embedded in browser code. Referrer/API restrictions reduce misuse but do not make a browser key secret. For stronger key protection, route search through a backend endpoint that stores the key server-side.

## How search suffixing works

The search helper trims excess whitespace and appends `karaoke` unless the query already contains that word, case-insensitively. For example, `Adele Hello` becomes `Adele Hello karaoke`, while `Adele Hello Karaoke` is left unchanged.

The app calls `search.list` with `type=video`, `videoEmbeddable=true`, and `maxResults=24`. Search quota usage follows Google's current API rules; check the official docs for your project's quota.

## Notes and limitations

- Favorites/playlists/queue are stored locally in this browser. There is no account sync or cloud database in this starter.
- Some videos may become unavailable or disallow playback in embedded players despite search filtering. YouTube controls playback behavior and may show ads.
- A browser may block autoplay; use the YouTube player's play button if playback does not start automatically.
- Use the YouTube Data API and embedded player in accordance with YouTube's terms and policies.

## Build for production

```bash
npm run build
npm run preview
```

The static site output is written to `dist/`. It can be hosted on S3 + CloudFront, Netlify, Vercel, or another static hosting provider. Configure your API key's HTTP referrer restrictions for the deployed domain.
