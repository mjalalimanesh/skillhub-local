import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Keeps the frontend/backend sub-package versions in lock-step with the root
// skillhub-local CLI package, so npm's build/dev script headers and the UI
// version badge never drift out of sync. The root package.json is the single
// source of truth.
const root = dirname(dirname(fileURLToPath(import.meta.url)));

const SUB_PACKAGES = ["packages/frontend", "packages/backend"];

async function readJson(p) {
  return JSON.parse(await readFile(p, "utf-8"));
}

async function writeJson(p, data) {
  await writeFile(p, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

const rootPkg = await readJson(join(root, "package.json"));
const version = rootPkg.version;

let changed = false;

for (const dir of SUB_PACKAGES) {
  const pkgPath = join(root, dir, "package.json");
  const lockPath = join(root, dir, "package-lock.json");

  const pkg = await readJson(pkgPath);
  if (pkg.version !== version) {
    pkg.version = version;
    await writeJson(pkgPath, pkg);
    changed = true;
  }

  let lock;
  try {
    lock = await readJson(lockPath);
  } catch {
    continue;
  }

  let lockChanged = false;
  if (lock.version !== version) {
    lock.version = version;
    lockChanged = true;
  }
  if (lock.packages?.[""] && lock.packages[""].version !== version) {
    lock.packages[""].version = version;
    lockChanged = true;
  }
  if (lockChanged) {
    await writeJson(lockPath, lock);
    changed = true;
  }
}

if (changed) {
  console.log(`sync-versions: sub-package versions synced to v${version}`);
} else {
  console.log(`sync-versions: all sub-packages already at v${version}`);
}
