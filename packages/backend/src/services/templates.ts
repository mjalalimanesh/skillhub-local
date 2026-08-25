import { readFile, writeFile, readdir, mkdir, rm, access, stat } from "node:fs/promises";
import { join, resolve, normalize, extname } from "node:path";
import { homedir } from "node:os";
import matter from "gray-matter";
import { expandHome } from "./scanner.js";
import { getTrustedDirs } from "./trusted-dirs.js";
import { discoverProjects } from "./projects.js";

export interface Template {
  id: string;
  name: string;
  description: string;
  content: string;
  builtin: boolean;
  updatedAt?: string;
}

export class TemplateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateConflictError";
  }
}

const TEMPLATE_DIR = join(homedir(), ".skillhub", "templates");

export const BUILT_IN_TEMPLATES: Template[] = [
  {
    id: "minimal-agent-rules",
    name: "Minimal agent rules",
    description:
      "A minimal set of engineering rules for coding agents working in this repository.",
    content: `- Do not preserve backward compatibility. Remove obsolete paths instead of adding compatibility layers, fallbacks, or migrations.
- Choose the simplest implementation that fully meets the current requirements. Avoid speculative abstractions, configuration, and indirection.
- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Keep components modular and concerns clearly separated.
- Prefer established, well-maintained libraries when they reduce overall complexity or improve reliability. Do not reimplement common functionality without a clear reason.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.
`,
    builtin: true,
  },
];

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "template";
}

function isCustomTemplateFile(name: string): boolean {
  return extname(name).toLowerCase() === ".md";
}

function serializeTemplate(template: {
  name: string;
  description: string;
  content: string;
}): string {
  return matter.stringify(template.content, {
    name: template.name,
    description: template.description,
  });
}

async function ensureTemplateDir(): Promise<void> {
  await mkdir(TEMPLATE_DIR, { recursive: true });
}

async function templatePath(id: string): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
    throw new Error("Invalid template id");
  }
  return join(TEMPLATE_DIR, `${id}.md`);
}

async function readCustomTemplate(filePath: string, fileName: string): Promise<Template | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);
    return {
      id: fileName.replace(/\.md$/i, ""),
      name: (data.name as string) || fileName.replace(/\.md$/i, ""),
      description: (data.description as string) || "",
      content,
      builtin: false,
      updatedAt: data.updatedAt as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<Template[]> {
  let custom: Template[] = [];
  try {
    await access(TEMPLATE_DIR);
    const entries = await readdir(TEMPLATE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !isCustomTemplateFile(entry.name)) continue;
      const template = await readCustomTemplate(
        join(TEMPLATE_DIR, entry.name),
        entry.name
      );
      if (template) custom.push(template);
    }
  } catch {
    // no custom templates yet
  }
  custom.sort((a, b) => a.name.localeCompare(b.name));
  return [...BUILT_IN_TEMPLATES, ...custom];
}

export async function getTemplateById(id: string): Promise<Template | undefined> {
  const builtin = BUILT_IN_TEMPLATES.find((t) => t.id === id);
  if (builtin) return builtin;
  try {
    return (await readCustomTemplate(await templatePath(id), `${id}.md`)) ?? undefined;
  } catch {
    return undefined;
  }
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
}

export async function createTemplate(input: CreateTemplateInput): Promise<Template> {
  const id = slugify(input.name);
  if (BUILT_IN_TEMPLATES.some((t) => t.id === id)) {
    throw new TemplateConflictError(`"${input.name}" conflicts with a built-in template`);
  }
  const filePath = await templatePath(id);
  try {
    await access(filePath);
    throw new TemplateConflictError(`A template with id "${id}" already exists`);
  } catch (err) {
    if (err instanceof TemplateConflictError) throw err;
  }
  await ensureTemplateDir();
  const updatedAt = new Date().toISOString();
  await writeFile(
    filePath,
    serializeTemplate({
      name: input.name,
      description: input.description || "",
      content: input.content,
    }),
    "utf-8"
  );
  return { id, name: input.name, description: input.description || "", content: input.content, builtin: false, updatedAt };
}

export async function updateTemplate(
  id: string,
  input: CreateTemplateInput
): Promise<Template> {
  const existing = await getTemplateById(id);
  if (!existing) throw new Error("Template not found");
  if (existing.builtin) throw new Error("Built-in templates cannot be modified");
  const updatedAt = new Date().toISOString();
  await writeFile(
    await templatePath(id),
    serializeTemplate({ name: input.name, description: input.description || "", content: input.content }),
    "utf-8"
  );
  return { ...existing, name: input.name, description: input.description || "", content: input.content, updatedAt };
}

export async function deleteTemplate(id: string): Promise<void> {
  const existing = await getTemplateById(id);
  if (!existing) throw new Error("Template not found");
  if (existing.builtin) throw new Error("Built-in templates cannot be deleted");
  await rm(await templatePath(id));
}

// Writes are limited to trusted directories (configured project dirs and
// projects discovered inside them), mirroring instruction writes.
async function getAllowedWriteRoots(): Promise<string[]> {
  const trusted = await getTrustedDirs();
  const roots = [...trusted];
  const projects = await discoverProjects(trusted);
  for (const proj of projects) roots.push(proj.path);
  return roots;
}

function validatePath(dirPath: string, allowedRoots: string[]): boolean {
  const resolvedTarget = resolve(normalize(dirPath));
  return allowedRoots.some((root) => {
    const rr = resolve(normalize(root));
    return resolvedTarget === rr || resolvedTarget.startsWith(rr + "/") || resolvedTarget.startsWith(rr + "\\");
  });
}

export interface ApplyTemplateInput {
  targetPath: string;
  alsoClaude?: boolean;
  force?: boolean;
}

export interface ApplyTemplateResult {
  written: string[];
}

export async function applyTemplate(
  template: Pick<Template, "name" | "content">,
  input: ApplyTemplateInput
): Promise<ApplyTemplateResult> {
  const targetDir = resolve(normalize(expandHome(input.targetPath)));

  let dirStat;
  try {
    dirStat = await stat(targetDir);
  } catch {
    throw new Error("Target directory does not exist");
  }
  if (!dirStat.isDirectory()) throw new Error("Target path is not a directory");

  const allowedRoots = await getAllowedWriteRoots();
  if (!validatePath(targetDir, allowedRoots)) {
    throw new Error("Path outside allowed roots — add this directory under Settings → Project Directories first");
  }

  const targets = [join(targetDir, "AGENTS.md")];
  if (input.alsoClaude) targets.push(join(targetDir, "CLAUDE.md"));

  if (!input.force) {
    for (const file of targets) {
      try {
        await access(file);
        throw new TemplateConflictError(
          `${file.split(/[\\/]/).pop()} already exists in ${targetDir}. Overwrite it?`
        );
      } catch (err) {
        if (err instanceof TemplateConflictError) throw err;
      }
    }
  }

  for (const file of targets) {
    await writeFile(file, template.content, "utf-8");
  }
  return { written: targets };
}
