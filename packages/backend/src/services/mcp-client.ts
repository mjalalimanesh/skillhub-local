import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { expandHome } from "./scanner.js";
import type { McpServer } from "./mcp-scanner.js";
import {
  getMcpAuthEntry,
  createOAuthProvider,
  getPendingOAuthUrl,
  clearPendingOAuthUrl,
} from "./mcp-auth.js";

const LIST_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpToolsResult {
  serverId: string;
  tools: McpToolInfo[];
  error?: string;
  authRequired?: boolean;
  authorizationUrl?: string;
}

export interface McpOAuthStartResult {
  authorized: boolean;
  authorizationUrl?: string;
  error?: string;
}

export interface McpAuthOverrides {
  headers?: Record<string, string>;
  env?: Record<string, string>;
}

// On Windows, commands like `npx`/`npm` are .cmd shims and cannot be spawned
// directly; route them through cmd.exe.
function stdioParams(server: McpServer): { command: string; args: string[] } {
  const command = server.command ?? "";
  const args = server.args ?? [];
  if (process.platform === "win32") {
    const base = command.toLowerCase();
    const isShim =
      !/[\\/]/.test(command) &&
      !base.endsWith(".exe") &&
      !base.endsWith(".cmd") &&
      !base.endsWith(".bat");
    if (isShim) {
      return {
        command: process.env.ComSpec ?? "cmd.exe",
        args: ["/d", "/s", "/c", command, ...args],
      };
    }
  }
  return { command, args };
}

function mergeOverrides(
  config: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> | undefined {
  const merged = { ...(config ?? {}), ...(overrides ?? {}) };
  return Object.keys(merged).length ? merged : undefined;
}

interface BuildTransportOptions {
  headers?: Record<string, string>;
  env?: Record<string, string>;
  authProvider?: ReturnType<typeof createOAuthProvider>;
}

function buildTransport(server: McpServer, opts: BuildTransportOptions): Transport {
  if (server.transport === "stdio") {
    const { command, args } = stdioParams(server);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    Object.assign(env, server.env ?? {}, opts.env ?? {});
    return new StdioClientTransport({
      command,
      args,
      env,
      cwd: server.cwd ?? server.projectRoot ?? expandHome("~"),
      stderr: "ignore",
    });
  }

  if ((server.transport === "http" || server.transport === "sse") && server.url) {
    const url = new URL(server.url);
    const requestInit = opts.headers
      ? { headers: opts.headers }
      : undefined;
    const authProvider = opts.authProvider;
    if (server.transport === "http") {
      return new StreamableHTTPClientTransport(url, { requestInit, authProvider });
    }
    return new SSEClientTransport(url, { requestInit, authProvider });
  }

  throw new Error(
    server.transport === "unknown" && server.url
      ? "Cannot determine transport for this server"
      : "Server has no usable command or URL"
  );
}

async function resolveAuth(server: McpServer, overrides?: McpAuthOverrides) {
  const stored = await getMcpAuthEntry(server.id);
  const headers = mergeOverrides(
    mergeOverrides(server.headers, stored?.headers),
    overrides?.headers
  );
  const env = mergeOverrides(
    mergeOverrides(server.env, stored?.env),
    overrides?.env
  );
  return { headers, env };
}

async function connectAndList(
  server: McpServer,
  overrides?: McpAuthOverrides
): Promise<McpToolsResult> {
  const client = new Client({ name: "skillhub-local", version: "0.1.0" });
  let transport: Transport;

  const { headers, env } = await resolveAuth(server, overrides);

  if (server.transport === "http" || server.transport === "sse") {
    clearPendingOAuthUrl(server.id);
    transport = buildTransport(server, {
      headers,
      authProvider: createOAuthProvider(server.id),
    });
  } else {
    transport = buildTransport(server, { headers, env });
  }

  const timeout = setTimeout(() => {
    transport.close().catch(() => {});
  }, LIST_TIMEOUT_MS);

  try {
    await client.connect(transport);
    const result = await client.listTools();
    return {
      serverId: server.id,
      tools: result.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown> | undefined,
      })),
    };
  } catch (err) {
    const authorizationUrl = getPendingOAuthUrl(server.id);
    if (err instanceof UnauthorizedError && authorizationUrl) {
      return {
        serverId: server.id,
        tools: [],
        authRequired: true,
        authorizationUrl,
      };
    }
    return {
      serverId: server.id,
      tools: [],
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => {});
  }
}

const cache = new Map<string, { at: number; result: McpToolsResult }>();

export async function listMcpServerTools(
  server: McpServer,
  overrides?: McpAuthOverrides
): Promise<McpToolsResult> {
  const hasOverrides =
    overrides && (overrides.headers || overrides.env) ? true : false;
  const hit = cache.get(server.id);
  if (hit && !hasOverrides && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const result = await connectAndList(server, overrides);

  // Never cache results that still need authentication — the user may finish
  // the OAuth flow and retry within the TTL window.
  if (!hasOverrides && !result.authRequired) {
    cache.set(server.id, { at: Date.now(), result });
  }
  return result;
}

export async function startMcpOAuth(server: McpServer): Promise<McpOAuthStartResult> {
  if (server.transport !== "http" && server.transport !== "sse") {
    return { authorized: false, error: "OAuth is only supported for HTTP/SSE servers" };
  }
  if (!server.url) {
    return { authorized: false, error: "Server has no URL" };
  }

  const client = new Client({ name: "skillhub-local", version: "0.1.0" });
  clearPendingOAuthUrl(server.id);
  const transport = buildTransport(server, {
    headers: (await resolveAuth(server)).headers,
    authProvider: createOAuthProvider(server.id),
  });

  const timeout = setTimeout(() => {
    transport.close().catch(() => {});
  }, LIST_TIMEOUT_MS);

  try {
    await client.connect(transport);
    return { authorized: true };
  } catch (err) {
    const authorizationUrl = getPendingOAuthUrl(server.id);
    if (authorizationUrl) {
      return { authorized: false, authorizationUrl };
    }
    return {
      authorized: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => {});
  }
}

export async function finishMcpOAuth(
  server: McpServer,
  authorizationCode: string
): Promise<{ success: boolean; error?: string }> {
  if (!server.url) {
    return { success: false, error: "Server has no URL" };
  }
  try {
    const provider = createOAuthProvider(server.id);
    await auth(provider, {
      serverUrl: new URL(server.url),
      authorizationCode,
    });
    clearPendingOAuthUrl(server.id);
    cache.delete(server.id);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
