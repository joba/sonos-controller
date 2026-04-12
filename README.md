# Sonos Music App for Kids

A simple home web app for young children to browse Spotify playlists and play music on a Sonos speaker. Designed to run on your local home network — big buttons, no complexity.

## How it works

A parent sets up the app once via the admin panel: connect a Spotify account, pick a Sonos speaker, and choose which playlists to show. Children then see a grid of playlist covers on the main screen and can tap to browse tracks and play them directly on the Sonos speaker.

## Features

- **Simple kid-friendly UI** — Large playlist covers and track list with album art
- **Sonos control** — Discovers Sonos speakers on your LAN via SSDP; plays, pauses, resumes, and adjusts volume
- **Spotify integration** — Browses your Spotify playlists and streams via Sonos's native Spotify service
- **Admin panel** — Password-protected setup page for parents to manage everything

## Setup

### 1. Spotify app

Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard) and add a redirect URI:

```
http://127.0.0.1:3000/api/auth/spotify/callback
```

### 2. Environment

Copy `.env.local.example` to `.env.local` and fill in your values:

```
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback
ADMIN_PASSWORD=...
```

### 3. Run

```bash
npm install
npm run dev
```

Access the app at `http://127.0.0.1:3000` (use the IP, not `localhost`, to avoid Spotify redirect URI issues).

### 4. First-time admin setup

Visit `http://127.0.0.1:3000/admin` and log in with your admin password, then:

1. Connect your Spotify account
2. Scan for Sonos speakers and select one
3. Add playlists to display on the main screen

## Stack

- [Next.js](https://nextjs.org) — App Router, API routes
- [@svrooij/sonos](https://github.com/svrooij/node-sonos-ts) — Local Sonos LAN control
- Spotify Web API — Playlist browsing and track metadata
- Tailwind CSS — Styling
