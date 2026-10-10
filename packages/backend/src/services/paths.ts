import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";

// Keep harness-specific config roots in one place so scanning, copying, and
// instruction write validation all honor the same environment overrides.
export function getPiAgentDir(): string {
  return expandHome(process.env.PI_CODING_AGENT_DIR || "~/.pi/agent");
}

export function getDshHome(): string {
  const configured = process.env.DSH_HOME;
  return expandHome(configured?.trim() ? configured : "~/.dsh");
}

export function getDshAgentsHome(): string {
  // DSH_AGENTS_HOME is resolved as a filesystem path by the harness, unlike
  // DSH_HOME it does not expand a tilde prefix.
  return process.env.DSH_AGENTS_HOME !== undefined
    ? resolve(process.env.DSH_AGENTS_HOME)
    : expandHome("~/.agents");
}

export function expandHome(p: string): string {
  if (p.startsWith("~")) {
    const rest = p.slice(1);
    // Hermes uses %LOCALAPPDATA% on Windows, ~/.hermes on Unix
    if ((rest.startsWith("/.hermes") || rest === "/.hermes") && platform() === "win32") {
      // ~/.hermes/* → ~/AppData/Local/hermes/*
      const hermesRest = rest.replace(/^\/\.hermes/, "/hermes");
      return join(homedir(), "AppData", "Local", hermesRest);
    }
    return join(homedir(), rest);
  }
  return resolve(p);
}
