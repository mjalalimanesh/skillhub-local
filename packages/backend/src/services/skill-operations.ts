import { access, cp, lstat, mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { platform, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { runSkillsCLI, validateSkillName, type CLIResult } from "./cli.js";
import { AGENT_DEFINITIONS, expandHome, isUnderKnownSkillDir, isUnderProjectSkillDir } from "./scanner.js";
import { loadConfig } from "./plugins.js";
import { discoverProjects } from "./projects.js";

const HARNESS_AGENT = "deepseek-harness";

export interface SkillOperationOptions {
  skill: string;
  agents: string[];
  global?: boolean;
}

export interface AgentOperationResult extends CLIResult {
  agents: string[];
  path?: string;
  removed?: boolean;
  skipped?: boolean;
  scope?: "global" | "project";
}

export interface SkillOperationsResult extends CLIResult {
  results: AgentOperationResult[];
}

export type SkillOperationProgress = (message: string, agent?: string) => void;
export type SkillsCLIRunner = typeof runSkillsCLI;

export class InvalidSkillPathError extends Error {}

// Match the skills CLI installer: names are not necessarily their directory names.
export function sanitizeSkillDirectoryName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._]+/g, "-")
    .replace(/^[.\-]+|[.\-]+$/g, "").substring(0, 255) || "unnamed-skill";
}

function harnessBase(global = true): string {
  const agent = AGENT_DEFINITIONS.find((entry) => entry.id === HARNESS_AGENT);
  if (!agent) throw new Error("DeepSeek Harness agent definition is unavailable");
  return resolve(global ? expandHome(agent.globalDir) : join(process.cwd(), agent.projectDir));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failure(agents: string[], error: unknown): AgentOperationResult {
  return { agents, stdout: "", stderr: errorMessage(error), exitCode: 1 };
}

function aggregate(results: AgentOperationResult[]): SkillOperationsResult {
  const failed = results.find((result) => result.exitCode !== 0);
  return {
    results,
    stdout: results.map((result) => result.stdout).filter(Boolean).join("\n"),
    stderr: results.map((result) => result.stderr).filter(Boolean).join("\n"),
    exitCode: results.length === 0 ? 1 : failed ? failed.exitCode : 0,
  };
}

async function runForAgents(
  args: string[],
  agents: string[],
  onProgress: SkillOperationProgress | undefined,
  runCLI: SkillsCLIRunner
): Promise<AgentOperationResult> {
  try {
    const result = await runCLI(args, (message) => onProgress?.(message, agents.length === 1 ? agents[0] : undefined));
    return { ...result, agents };
  } catch (error) {
    return failure(agents, error);
  }
}

async function installHarnessSkill(
  options: SkillOperationOptions & { source: string; copy?: boolean },
  onProgress: SkillOperationProgress | undefined,
  runCLI: SkillsCLIRunner
): Promise<AgentOperationResult> {
  let staging: string | undefined;
  let result: AgentOperationResult = { agents: [HARNESS_AGENT], stdout: "", stderr: "", exitCode: 1 };
  let target: string | undefined;
  let createdTarget = false;
  try {
    const base = harnessBase(options.global !== false);
    const directoryName = sanitizeSkillDirectoryName(options.skill);
    target = join(base, directoryName);
    try {
      await lstat(target);
      throw new Error(`Skill already exists at ${target}; remove it before reinstalling`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    staging = await mkdtemp(join(tmpdir(), "skillhub-dsh-"));
    // Defense in depth: a misparsed/upstream global install must not reach the
    // real user's shared skills while running the temporary staging command.
    const isolatedHome = join(staging, "home");
    await mkdir(isolatedHome);
    let source = options.source;
    // Keep local sources relative to the original cwd, not the temporary project.
    // A local alias avoids introducing shell metacharacters from absolute paths.
    if (isAbsolute(source) || source === "." || source === ".." || source.startsWith("./") || source.startsWith("../")) {
      await symlink(resolve(source), join(staging, "source"), platform() === "win32" ? "junction" : "dir");
      source = "./source";
    }
    onProgress?.("Staging skill for DeepSeek Harness via the universal agent (project-local copy)", HARNESS_AGENT);
    // Never pass the unsupported harness ID to the upstream CLI or stage globally.
    const downloaded = await runCLI(
      ["add", source, "--skill", options.skill, "--agent", "universal", "--yes", "--copy"],
      (message) => onProgress?.(message, HARNESS_AGENT),
      staging,
      { HOME: isolatedHome, USERPROFILE: isolatedHome, XDG_CONFIG_HOME: join(isolatedHome, ".config") }
    );
    result = { ...downloaded, agents: [HARNESS_AGENT], path: target };
    if (downloaded.exitCode !== 0) return result;

    const canonical = join(staging, ".agents", "skills", directoryName);
    await access(join(canonical, "SKILL.md"));
    onProgress?.(options.copy
      ? `Copying skill to DeepSeek Harness native directory: ${target}`
      : `Using a durable copy for DeepSeek Harness (temporary staging cannot be a symlink target): ${target}`,
    HARNESS_AGENT);
    await mkdir(base, { recursive: true });
    // Reserve the leaf exclusively: do not overwrite an existing directory or a
    // symlink into another agent's shared assets, even on a concurrent install.
    await mkdir(target);
    createdTarget = true;
    await cp(canonical, target, { recursive: true, dereference: true, force: false, errorOnExist: true });
    result.stdout += `\nInstalled DeepSeek Harness skill at ${target} (copy)`;
    return result;
  } catch (error) {
    result = {
      ...result,
      agents: [HARNESS_AGENT],
      path: target,
      exitCode: 1,
      stderr: [result.stderr, errorMessage(error)].filter(Boolean).join("\n"),
    };
    if (createdTarget && target) {
      try {
        await rm(target, { recursive: true, force: true });
      } catch (cleanupError) {
        result.stderr += `\nCould not clean up partial installation: ${errorMessage(cleanupError)}`;
      }
    }
    return result;
  } finally {
    if (staging) {
      try {
        await rm(staging, { recursive: true, force: true });
      } catch (error) {
        const warning = `Could not clean up DeepSeek Harness staging directory: ${errorMessage(error)}`;
        result.stderr = [result.stderr, warning].filter(Boolean).join("\n");
        onProgress?.(warning, HARNESS_AGENT);
      }
    }
  }
}

export async function installSkills(
  options: SkillOperationOptions & { source: string; copy?: boolean },
  onProgress?: SkillOperationProgress,
  runCLI: SkillsCLIRunner = runSkillsCLI
): Promise<SkillOperationsResult> {
  // Helpers are also called directly: validate before any normal or staging CLI.
  if (typeof options.skill !== "string" || !validateSkillName(options.skill)) {
    return aggregate([failure(options.agents, new Error("Invalid skill name"))]);
  }
  const results: AgentOperationResult[] = [];
  const normalAgents = options.agents.filter((agent) => agent !== HARNESS_AGENT);
  if (normalAgents.length) {
    const args = ["add", options.source, "--skill", options.skill, "--yes"];
    for (const agent of normalAgents) args.push("--agent", agent);
    if (options.global !== false) args.push("--global");
    if (options.copy) args.push("--copy");
    results.push(await runForAgents(args, normalAgents, onProgress, runCLI));
  }
  if (options.agents.includes(HARNESS_AGENT)) {
    results.push(await installHarnessSkill(options, onProgress, runCLI));
  }
  return aggregate(results);
}

async function validateExplicitSkillPath(path: string): Promise<{ path: string; project: boolean }> {
  const resolved = resolve(path);
  try {
    await access(join(resolved, "SKILL.md"));
  } catch {
    throw new InvalidSkillPathError("Invalid skill path: not a skill directory");
  }
  const project = await isUnderProjectSkillDir(resolved);
  if (!project && !(await isUnderKnownSkillDir(resolved))) {
    throw new InvalidSkillPathError("Invalid skill path: not under a known skill directory");
  }
  return { path: resolved, project };
}

function isWithin(base: string, path: string): boolean {
  const rel = relative(base, path);
  return rel === "" || (!isAbsolute(rel) && rel !== ".." && !rel.startsWith("../") && !rel.startsWith("..\\"));
}

async function isHarnessSkillPath(path: string): Promise<boolean> {
  const agent = AGENT_DEFINITIONS.find((definition) => definition.id === HARNESS_AGENT);
  if (!agent) return false;
  const bases = [expandHome(agent.globalDir), ...(agent.extraDirs || []).map(expandHome)];
  const projectRoots = [process.cwd()];
  try {
    const config = await loadConfig();
    projectRoots.push(...(await discoverProjects(config.projectDirs || [])).map((project) => project.path));
  } catch {
    // Global and current-project paths remain recognizable without discovery.
  }
  for (const root of projectRoots) {
    for (const dir of [agent.projectDir, ...(agent.extraProjectDirs || [])]) bases.push(join(root, dir));
  }
  return bases.some((base) => isWithin(resolve(base), path));
}

async function removeHarnessSkill(options: SkillOperationOptions): Promise<AgentOperationResult> {
  const agents = [HARNESS_AGENT];
  let target: string | undefined;
  try {
    const base = harnessBase(options.global !== false);
    target = join(base, sanitizeSkillDirectoryName(options.skill));
    let entry;
    try {
      entry = await lstat(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return {
        agents, path: target, exitCode: 0, stderr: "", removed: false, skipped: true,
        stdout: `No native DeepSeek Harness skill installed at ${target}; native removal skipped`,
      };
    }

    // A native-root alias to shared assets must not turn a name-only remove into
    // shared deletion. Explicit skillPath remains the opt-in for shared removal.
    const agent = AGENT_DEFINITIONS.find((definition) => definition.id === HARNESS_AGENT)!;
    const sharedBases = [
      ...(agent.extraDirs || []).map(expandHome),
      ...(agent.extraProjectDirs || []).map((dir) => join(process.cwd(), dir)),
    ];
    const actualBase = await realpath(base);
    for (const shared of sharedBases) {
      const actualShared = await realpath(shared).catch(() => resolve(shared));
      if (isWithin(actualShared, actualBase)) {
        throw new Error("Native DeepSeek Harness directory resolves inside shared skills; provide an explicit skillPath to remove shared assets");
      }
    }
    // Unlinking a leaf symlink is safe (including a dangling one); never resolve
    // the leaf and recursively remove its shared canonical target.
    if (!entry.isSymbolicLink()) await access(join(target, "SKILL.md"));
    await rm(target, { recursive: true, force: false });
    return { agents, path: target, removed: true, exitCode: 0, stderr: "", stdout: `Removed DeepSeek Harness skill at ${target}` };
  } catch (error) {
    return { ...failure(agents, error), path: target, removed: false };
  }
}

export async function removeSkills(
  options: SkillOperationOptions & { skillPath?: string },
  onProgress?: SkillOperationProgress,
  runCLI: SkillsCLIRunner = runSkillsCLI
): Promise<SkillOperationsResult> {
  if (typeof options.skill !== "string" || !validateSkillName(options.skill)) {
    return aggregate([failure(options.agents, new Error("Invalid skill name"))]);
  }
  if (options.skillPath !== undefined && (typeof options.skillPath !== "string" || !options.skillPath.trim())) {
    throw new InvalidSkillPathError("Invalid skill path");
  }
  const explicit = options.skillPath !== undefined ? await validateExplicitSkillPath(options.skillPath) : undefined;
  const hasHarness = options.agents.includes(HARNESS_AGENT);
  const normalAgents = options.agents.filter((agent) => agent !== HARNESS_AGENT);
  const results: AgentOperationResult[] = [];
  const explicitForHarness = hasHarness && !!explicit &&
    (normalAgents.length === 0 || await isHarnessSkillPath(explicit.path));
  // Shared directories are readable by Harness but are not its native target.
  // A mixed request skips native removal only for this exact requested target.
  const explicitIsNativeTarget = hasHarness && !!explicit && relative(
    join(harnessBase(options.global !== false), sanitizeSkillDirectoryName(options.skill)),
    explicit.path
  ) === "";
  if (explicit) {
    // A mixed request's concrete path is not automatically a Harness install.
    // Unattributed directory rows avoid claiming another agent was removed.
    const agents = !hasHarness ? options.agents : explicitForHarness ? [HARNESS_AGENT] : [];
    try {
      await rm(explicit.path, { recursive: true, force: false });
      const message = `Removed skill directory at ${explicit.path}`;
      onProgress?.(message, agents.length === 1 ? agents[0] : undefined);
      results.push({
        agents, path: explicit.path, removed: true, exitCode: 0, stdout: message, stderr: "",
        scope: explicit.project ? "project" : "global",
      });
    } catch (error) {
      results.push({
        ...failure(agents, error), path: explicit.path, removed: false,
        scope: explicit.project ? "project" : "global",
      });
    }
    // A discovered project's concrete path does not select a complete CLI cwd
    // or native target. Preserve explicit-only project removal for every mix;
    // never fall through to unrelated global/server-CWD name-based removal.
    if (explicit.project) {
      const message = "Explicit project skill path only: name-based agent removals were skipped; global and server-current-directory skills were not removed";
      results.push({
        agents: options.agents, scope: "project", removed: false, skipped: true,
        exitCode: 0, stdout: message, stderr: "",
      });
      onProgress?.(message);
      return aggregate(results);
    }
    if (results[0].exitCode !== 0) return aggregate(results);
  }
  const needsNativeRemoval = hasHarness && (!explicit || (normalAgents.length > 0 && !explicitIsNativeTarget));
  if (needsNativeRemoval) {
    const result = await removeHarnessSkill(options);
    results.push(result);
    onProgress?.(result.exitCode === 0 ? result.stdout : result.stderr, HARNESS_AGENT);
  }
  if (normalAgents.length) {
    const args = ["remove", "--skill", options.skill, "--yes"];
    for (const agent of normalAgents) args.push("--agent", agent);
    if (options.global !== false) args.push("--global");
    results.push(await runForAgents(args, normalAgents, onProgress, runCLI));
  }
  return aggregate(results);
}
