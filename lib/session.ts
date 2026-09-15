// Shared by proxy.ts (middleware) and lib/auth.ts. Kept dependency-free so
// the middleware bundle doesn't have to pull in next/headers / next/navigation.
export const SESSION_COOKIE = "admin_session";
export const SESSION_TOKEN = "authenticated";
export const SPOTIFY_OAUTH_STATE_COOKIE = "spotify_oauth_state";
