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
  playlists: SavedPlaylist[];
};

export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function readConfig(): Config {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { sonosDeviceIp: null, sonosDeviceName: null, playlists: [] };
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
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
