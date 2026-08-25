import { join, resolve } from "node:path";
import { homedir, platform } from "node:os";

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
