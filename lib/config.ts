import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const TOKENS_FILE = path.join(DATA_DIR, "tokens.json");

export type SavedPlaylist = {
  id: string;
  name: string;
  imageUrl: string;
};

export type Config = {
  sonosDeviceIp: string | null;
  sonosDeviceName: string | null;
  maxVolume: number;
  playlists: SavedPlaylist[];
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
};

const DEFAULT_MAX_VOLUME = 50;
const MIN_VOLUME = 0;
const MAX_VOLUME = 100;

const DEFAULT_CONFIG: Config = {
  sonosDeviceIp: null,
  sonosDeviceName: null,
  maxVolume: DEFAULT_MAX_VOLUME,
  playlists: [],
};

function normalizeMaxVolume(value: unknown): number {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return DEFAULT_MAX_VOLUME;
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, numeric));
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return DEFAULT_CONFIG;
  }
  const parsed = JSON.parse(
    fs.readFileSync(CONFIG_FILE, "utf-8"),
  ) as Partial<Config>;
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    maxVolume: normalizeMaxVolume(parsed.maxVolume),
    playlists: Array.isArray(parsed.playlists) ? parsed.playlists : [],
  };
}

export function writeConfig(config: Config): void {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function readTokens(): Tokens | null {
  ensureDataDir();
  if (!fs.existsSync(TOKENS_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
}

export function writeTokens(tokens: Tokens): void {
  ensureDataDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}
