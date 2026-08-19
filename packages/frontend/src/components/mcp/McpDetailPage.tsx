import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { maskEnvValue } from "./mcpFormat";
import {
  Terminal,
  Globe,
  Server,
  FileCode2,
  FolderOpen,
  KeyRound,
  Wrench,
  Loader2,
  RefreshCw,
  WrenchIcon,
  ShieldCheck,
  Plus,
  Trash2,
  LogIn,
  ExternalLink,
} from "lucide-react";
import type { McpServer } from "@/lib/types";

const transportLabels: Record<string, string> = {
  stdio: "stdio",
  http: "HTTP",
  sse: "SSE",
  unknown: "unknown",
};

function ServerInfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-ink-dim shrink-0 mt-0.5">{icon}</span>
      <span className="text-ink-dim shrink-0 mt-0.5">{label}</span>
      <span className={`text-ink ${mono ? "font-mono break-all" : "break-all"}`}>{value}</span>
    </div>
  );
}

interface KvRow {
  key: string;
  value: string;
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (i: number, patch: Partial<KvRow>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, { key: "", value: "" }]);

  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder={keyPlaceholder ?? "Name"}
            className="h-8 font-mono text-xs"
          />
          <Input
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={valuePlaceholder ?? "Value"}
            className="h-8 font-mono text-xs"
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 shrink-0"
            onClick={() => remove(i)}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={add}>
        <Plus size={13} />
        Add
      </Button>
    </div>
  );
}

function rowsToMap(rows: KvRow[]): Record<string, string> | undefined {
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.trim()) map[row.key.trim()] = row.value;
  }
  return Object.keys(map).length ? map : undefined;
}

function mapToRows(map?: Record<string, string>): KvRow[] {
  if (!map) return [];
  return Object.entries(map).map(([key, value]) => ({ key, value }));
}

export default function McpDetailPage() {
  const { serverId } = useParams<{ serverId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["mcp"],
    queryFn: () => api.getMcpServers(),
  });

  const server: McpServer | undefined = (data?.servers || []).find(
    (s) => s.id === decodeURIComponent(serverId || "")
  );

  const queryClient = useQueryClient();

  const authQuery = useQuery({
    queryKey: ["mcp-auth", server?.id],
    queryFn: () => api.getMcpAuth(server!.id),
    enabled: !!server,
  });

  const [headerRows, setHeaderRows] = useState<KvRow[]>([]);
  const [envRows, setEnvRows] = useState<KvRow[]>([]);

  useEffect(() => {
    if (authQuery.data) {
      setHeaderRows(mapToRows(authQuery.data.headers));
      setEnvRows(mapToRows(authQuery.data.env));
    }
  }, [authQuery.data]);

  const [confirmFetchOpen, setConfirmFetchOpen] = useState(false);

  const toolsMutation = useMutation({
    mutationFn: () => api.getMcpTools(server!.id),
  });

  const saveAuthMutation = useMutation({
    mutationFn: (body: { headers?: Record<string, string>; env?: Record<string, string> }) =>
      api.setMcpAuth(server!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-auth", server?.id] });
    },
  });

  const clearAuthMutation = useMutation({
    mutationFn: () => api.clearMcpAuth(server!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-auth", server?.id] });
      setHeaderRows([]);
      setEnvRows([]);
    },
  });

  const [oauthState, setOauthState] = useState<"idle" | "starting" | "waiting" | "error">("idle");
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const fetchTools = () => {
    setConfirmFetchOpen(true);
  };

  const authorize = async () => {
    if (!server) return;
    setOauthState("starting");
    setOauthError(null);
    setOauthUrl(null);
    try {
      const res = await api.startMcpOAuth(server.id);
      if (res.authorized) {
        setOauthState("idle");
        toolsMutation.mutate();
        queryClient.invalidateQueries({ queryKey: ["mcp-auth", server.id] });
        return;
      }
      if (res.authorizationUrl) {
        setOauthUrl(res.authorizationUrl);
        setOauthState("waiting");
        window.open(res.authorizationUrl, "_blank", "noopener");
        pollStatus(server.id, 0);
        return;
      }
      setOauthState("error");
      setOauthError(res.error ?? "Authorization failed");
    } catch (err) {
      setOauthState("error");
      setOauthError(err instanceof Error ? err.message : String(err));
    }
  };

  const pollStatus = async (id: string, attempt: number) => {
    if (attempt > 30) {
      setOauthState("error");
      setOauthError("Timed out waiting for authorization. Try again.");
      return;
    }
    try {
      const res = await api.getMcpOAuthStatus(id);
      if (res.authorized) {
        setOauthState("idle");
        setOauthUrl(null);
        queryClient.invalidateQueries({ queryKey: ["mcp-auth", id] });
        toolsMutation.mutate();
        return;
      }
    } catch {
      // ignore transient errors and keep polling
    }
    window.setTimeout(() => pollStatus(id, attempt + 1), 2000);
  };

  if (isLoading) {
    return <div className="text-ink-dim">Loading...</div>;
  }

  if (!server) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="MCP Server Not Found"
          breadcrumbs={[
            { label: "MCP Servers", href: "/mcp" },
            { label: serverId || "" },
          ]}
        />
      </div>
    );
  }

  const envEntries = server.env ? Object.entries(server.env) : [];
  const headerEntries = server.headers ? Object.entries(server.headers) : [];
  const toolCount = server.tools
    ? server.tools.enabled.length + server.tools.disabled.length
    : 0;
  const oauthAuthorized = authQuery.data?.oauthAuthorized ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={server.name}
        description={`${server.agentName} · ${transportLabels[server.transport] ?? server.transport}`}
        breadcrumbs={[
          { label: "MCP Servers", href: "/mcp" },
          { label: server.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="accent" className="text-[11px]">
              {server.agentName}
            </Badge>
            <Badge
              variant={server.transport === "stdio" ? "default" : "warning"}
              className="text-[11px]"
            >
              {transportLabels[server.transport] ?? server.transport}
            </Badge>
            <Badge
              variant={server.scope === "project" ? "success" : "default"}
              className="text-[11px]"
            >
              {server.scope === "project"
                ? `project${server.projectName ? ` · ${server.projectName}` : ""}`
                : "global"}
            </Badge>
            {server.enabled === false && (
              <Badge variant="danger" className="text-[11px]">
                disabled
              </Badge>
            )}
          </div>
        }
      />

      <Card className="p-4 space-y-2.5">
        <ServerInfoRow
          icon={<FileCode2 size={13} />}
          label="Source"
          value={server.sourceFile}
          mono
        />
        {server.transport === "stdio" ? (
          <ServerInfoRow
            icon={<Terminal size={13} />}
            label="Command"
            value={`${server.command ?? ""}${server.args?.length ? ` ${server.args.join(" ")}` : ""}`}
            mono
          />
        ) : (
          <ServerInfoRow
            icon={<Globe size={13} />}
            label="URL"
            value={server.url ?? ""}
            mono
          />
        )}
        {server.cwd && (
          <ServerInfoRow
            icon={<FolderOpen size={13} />}
            label="cwd"
            value={server.cwd}
            mono
          />
        )}
        {server.type && (
          <ServerInfoRow
            icon={<Server size={13} />}
            label="type"
            value={server.type}
            mono
          />
        )}
        {server.enabled !== undefined && (
          <div className="text-xs text-ink-dim">
            enabled: {server.enabled ? "yes" : "no"}
          </div>
        )}
      </Card>

      {envEntries.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-dim">
            <KeyRound size={13} className="shrink-0" />
            env ({envEntries.length})
          </div>
          <div className="space-y-0.5">
            {envEntries.map(([key, value]) => (
              <div key={key} className="font-mono text-[11px] break-all">
                <span className="text-ink-muted">{key}</span>
                <span className="text-ink-dim">=</span>
                <span className="text-ink">{maskEnvValue(key, value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {headerEntries.length > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-dim">
            <ShieldCheck size={13} className="shrink-0" />
            headers ({headerEntries.length})
          </div>
          <div className="space-y-0.5">
            {headerEntries.map(([key, value]) => (
              <div key={key} className="font-mono text-[11px] break-all">
                <span className="text-ink-muted">{key}</span>
                <span className="text-ink-dim">:</span>
                <span className="text-ink"> {maskEnvValue(key, value)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {server.tools && toolCount > 0 && (
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-ink-dim">
            <Wrench size={13} className="shrink-0" />
            configured tools ({toolCount})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {server.tools.enabled.map((t) => (
              <Badge key={`e-${t}`} variant="success" className="text-[11px] font-mono">
                {t}
              </Badge>
            ))}
            {server.tools.disabled.map((t) => (
              <Badge key={`d-${t}`} variant="danger" className="text-[11px] font-mono">
                {t}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-ink-dim">
          <KeyRound size={13} className="shrink-0" />
          authentication
          {oauthAuthorized && (
            <Badge variant="success" className="text-[11px]">
              OAuth connected
            </Badge>
          )}
        </div>

        {(server.transport === "http" || server.transport === "sse") && (
          <div className="flex items-center justify-between rounded-md bg-surface-secondary p-3">
            <div className="text-xs text-ink-dim">
              {oauthAuthorized
                ? "OAuth tokens are stored for this server."
                : "This server may require OAuth. Start the browser authorization flow."}
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={authorize}
              disabled={oauthState === "starting" || oauthState === "waiting"}
            >
              {oauthState === "starting" || oauthState === "waiting" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LogIn size={13} />
              )}
              {oauthState === "waiting" ? "Waiting..." : oauthAuthorized ? "Re-authorize" : "Authorize"}
            </Button>
          </div>
        )}

        {oauthUrl && oauthState === "waiting" && (
          <div className="text-xs text-ink-dim">
            Waiting for authorization. If the browser did not open,{" "}
            <a
              href={oauthUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline inline-flex items-center gap-1"
            >
              open this link <ExternalLink size={11} />
            </a>
            .
          </div>
        )}

        {oauthError && <div className="text-xs text-danger">{oauthError}</div>}

        <div className="space-y-3">
          <div>
            <div className="text-xs text-ink-dim mb-1.5">override headers</div>
            <KeyValueEditor
              rows={headerRows}
              onChange={setHeaderRows}
              keyPlaceholder="Authorization"
              valuePlaceholder="Bearer …"
            />
          </div>
          <div>
            <div className="text-xs text-ink-dim mb-1.5">override env</div>
            <KeyValueEditor
              rows={envRows}
              onChange={setEnvRows}
              keyPlaceholder="API_KEY"
              valuePlaceholder="value"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() =>
                saveAuthMutation.mutate({
                  headers: rowsToMap(headerRows),
                  env: rowsToMap(envRows),
                })
              }
              disabled={saveAuthMutation.isPending}
            >
              {saveAuthMutation.isPending && <Loader2 size={13} className="animate-spin" />}
              Save credentials
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => clearAuthMutation.mutate()}
              disabled={clearAuthMutation.isPending}
            >
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-ink-dim">
            <WrenchIcon size={13} className="shrink-0" />
            discovered tools
            {toolsMutation.data && !toolsMutation.data.error && (
              <span className="text-ink">({toolsMutation.data.tools.length})</span>
            )}
          </div>
          {!toolsMutation.isPending && (
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchTools}
              disabled={toolsMutation.isPending}
            >
              {toolsMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {toolsMutation.isPending
                ? "Connecting..."
                : toolsMutation.data
                  ? "Refresh"
                  : "Fetch tools"}
            </Button>
          )}
        </div>

        {toolsMutation.isPending ? (
          <div className="flex items-center gap-2 text-xs text-ink-dim">
            <Loader2 size={13} className="animate-spin" />
            Connecting to server to list tools...
          </div>
        ) : toolsMutation.isError ? (
          <div className="text-xs text-danger">{toolsMutation.error.message}</div>
        ) : toolsMutation.data?.authRequired ? (
          <div className="rounded-md bg-surface-secondary p-3 space-y-2">
            <div className="text-xs text-ink">This server requires authorization.</div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={authorize} disabled={oauthState !== "idle"}>
                {oauthState === "starting" || oauthState === "waiting" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <LogIn size={13} />
                )}
                {oauthState === "waiting" ? "Waiting..." : "Authorize now"}
              </Button>
              {toolsMutation.data.authorizationUrl && (
                <a
                  href={toolsMutation.data.authorizationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent underline inline-flex items-center gap-1"
                >
                  open authorization URL <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        ) : toolsMutation.data?.error ? (
          <div className="text-xs text-danger">{toolsMutation.data.error}</div>
        ) : toolsMutation.data?.tools.length === 0 ? (
          <div className="text-xs text-ink-dim">No tools exposed by this server.</div>
        ) : (
          <div className="space-y-2">
            {toolsMutation.data?.tools.map((tool) => (
              <div key={tool.name} className="rounded-md bg-surface p-3">
                <div className="text-xs font-medium text-ink font-mono">{tool.name}</div>
                {tool.description && (
                  <div className="text-xs text-ink-dim mt-0.5">{tool.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div>
        <div className="text-xs font-medium text-ink-dim mb-1.5">Raw config entry</div>
        <pre className="rounded-md bg-surface-secondary p-3 text-[11px] text-ink-muted overflow-x-auto">
          {JSON.stringify(server.raw, null, 2)}
        </pre>
      </div>

      <ConfirmDialog
        open={confirmFetchOpen}
        onOpenChange={setConfirmFetchOpen}
        title="Run this MCP server?"
        description={
          <>
            Fetching tools will execute the following on this machine:
            <pre className="mt-2 rounded-md bg-surface-secondary p-2 text-[11px] text-ink font-mono break-all whitespace-pre-wrap">
              {server.transport === "stdio"
                ? `${server.command ?? "unknown"}${server.args?.length ? ` ${server.args.join(" ")}` : ""}`
                : server.url ?? "unknown"}
            </pre>
          </>
        }
        confirmLabel="Fetch tools"
        onConfirm={() => {
          setConfirmFetchOpen(false);
          toolsMutation.mutate();
        }}
      />
    </div>
  );
}
