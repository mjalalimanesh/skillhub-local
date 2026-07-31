import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { expandHome } from "./scanner.js";
import type { McpServer } from "./mcp-scanner.js";

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

async function connectAndList(server: McpServer): Promise<McpToolInfo[]> {
  const client = new Client({ name: "skillhub-local", version: "0.1.0" });
  let transport: Transport;

  if (server.transport === "stdio") {
    const { command, args } = stdioParams(server);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    Object.assign(env, server.env ?? {});
    transport = new StdioClientTransport({
      command,
      args,
      env,
      cwd: server.cwd ?? server.projectRoot ?? expandHome("~"),
      stderr: "ignore",
    });
  } else if (server.transport === "http" && server.url) {
    transport = new StreamableHTTPClientTransport(new URL(server.url));
  } else if (server.transport === "sse" && server.url) {
    transport = new SSEClientTransport(new URL(server.url));
  } else {
    throw new Error(
      server.transport === "unknown" && server.url
        ? "Cannot determine transport for this server"
        : "Server has no usable command or URL"
    );
  }

  const timeout = setTimeout(() => {
    transport.close().catch(() => {});
  }, LIST_TIMEOUT_MS);

  try {
    await client.connect(transport);
    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown> | undefined,
    }));
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => {});
  }
}

const cache = new Map<string, { at: number; result: McpToolsResult }>();

export async function listMcpServerTools(server: McpServer): Promise<McpToolsResult> {
  const hit = cache.get(server.id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  let result: McpToolsResult;
  try {
    const tools = await connectAndList(server);
    result = { serverId: server.id, tools };
  } catch (err) {
    result = {
      serverId: server.id,
      tools: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  cache.set(server.id, { at: Date.now(), result });
  return result;
}
