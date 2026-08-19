import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

const DIR = join(homedir(), ".skillhub");
const AUTH_FILE = join(DIR, "mcp-auth.json");

export interface McpOAuthState {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  discovery?: OAuthDiscoveryState;
}

export interface McpAuthEntry {
  headers?: Record<string, string>;
  env?: Record<string, string>;
  oauth?: McpOAuthState;
}

type McpAuthStore = Record<string, McpAuthEntry>;

let cache: McpAuthStore | null = null;

async function loadStore(): Promise<McpAuthStore> {
  if (cache) return cache;
  try {
    await access(AUTH_FILE);
    const raw = await readFile(AUTH_FILE, "utf-8");
    cache = JSON.parse(raw) as McpAuthStore;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(store: McpAuthStore): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(store, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
  cache = store;
}

export async function getMcpAuthEntry(id: string): Promise<McpAuthEntry | undefined> {
  const store = await loadStore();
  return store[id];
}

export async function setMcpAuthOverrides(
  id: string,
  overrides: { headers?: Record<string, string>; env?: Record<string, string> }
): Promise<McpAuthEntry> {
  const store = await loadStore();
  const entry = store[id] ?? {};
  if (overrides.headers && Object.keys(overrides.headers).length) {
    entry.headers = overrides.headers;
  } else {
    delete entry.headers;
  }
  if (overrides.env && Object.keys(overrides.env).length) {
    entry.env = overrides.env;
  } else {
    delete entry.env;
  }
  if (!entry.headers && !entry.env && !entry.oauth) {
    delete store[id];
  } else {
    store[id] = entry;
  }
  await persist(store);
  return entry;
}

export async function clearMcpOAuth(id: string): Promise<void> {
  const store = await loadStore();
  const entry = store[id];
  if (!entry) return;
  delete entry.oauth;
  if (!entry.headers && !entry.env && Object.keys(entry).length === 0) {
    delete store[id];
  }
  await persist(store);
}

export async function hasMcpOAuthTokens(id: string): Promise<boolean> {
  const entry = await getMcpAuthEntry(id);
  return !!entry?.oauth?.tokens?.access_token;
}

export function oauthRedirectUrl(): string {
  const port = Number(process.env.PORT) || 3742;
  return `http://127.0.0.1:${port}/oauth/callback`;
}

const pendingAuthUrls = new Map<string, string>();
const stateToServerId = new Map<string, string>();

export function getPendingOAuthUrl(serverId: string): string | undefined {
  return pendingAuthUrls.get(serverId);
}

export function clearPendingOAuthUrl(serverId: string): void {
  pendingAuthUrls.delete(serverId);
}

export function getServerIdForOAuthState(state: string): string | undefined {
  return stateToServerId.get(state);
}

export class McpOAuthProvider implements OAuthClientProvider {
  constructor(
    private readonly serverId: string,
    private readonly redirect: string
  ) {}

  get redirectUrl(): string {
    return this.redirect;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirect],
      client_name: "skillhub-local",
      token_endpoint_auth_method: "none",
    };
  }

  private async entry(): Promise<McpAuthEntry | undefined> {
    return getMcpAuthEntry(this.serverId);
  }

  private async updateOAuth(
    mutate: (oauth: McpOAuthState) => void
  ): Promise<void> {
    const store = await loadStore();
    const entry = store[this.serverId] ?? {};
    const oauth = entry.oauth ?? {};
    mutate(oauth);
    entry.oauth = oauth;
    store[this.serverId] = entry;
    await persist(store);
  }

  async state(): Promise<string> {
    const state = randomBytes(16).toString("hex");
    stateToServerId.set(state, this.serverId);
    return state;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const info = (await this.entry())?.oauth?.clientInformation;
    if (!info) return undefined;
    // Dynamic client registrations are bound to the redirect URI that was
    // registered (which includes the backend port). If the server restarted on
    // a different port, the stored registration is stale — force re-registration.
    const redirects = Array.isArray((info as OAuthClientInformationMixed & { redirect_uris?: unknown }).redirect_uris)
      ? (info as { redirect_uris: unknown[] }).redirect_uris.map(String)
      : [];
    if (!redirects.includes(this.redirect)) return undefined;
    return info;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    await this.updateOAuth((oauth) => {
      oauth.clientInformation = info;
    });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await this.entry())?.oauth?.tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.updateOAuth((oauth) => {
      oauth.tokens = tokens;
    });
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    pendingAuthUrls.set(this.serverId, url.toString());
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.updateOAuth((oauth) => {
      oauth.codeVerifier = codeVerifier;
    });
  }

  async codeVerifier(): Promise<string> {
    return (await this.entry())?.oauth?.codeVerifier ?? "";
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return (await this.entry())?.oauth?.discovery;
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await this.updateOAuth((oauth) => {
      oauth.discovery = state;
    });
  }
}

export function createOAuthProvider(serverId: string): McpOAuthProvider {
  return new McpOAuthProvider(serverId, oauthRedirectUrl());
}
