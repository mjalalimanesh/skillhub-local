import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, platform, tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';

// Run after npm run build. Never reads or writes a real harness home.
const cwd = process.cwd();
const env = { ...process.env };
const temporaryBase = resolve(tmpdir());
const root = await mkdtemp(join(temporaryBase, 'skillhub-harness-tests-'));
const exists = async p => access(p).then(() => true, () => false);
async function put(p, text) { await mkdir(dirname(p), { recursive: true }); await writeFile(p, text); }
async function bundle(p, name = 'fixture') { await put(join(p, 'SKILL.md'), `---\nname: ${name}\ndescription: Regression fixture\n---\n# ${name}`); }
let count = 0;
async function check(name, run) { await run(); console.log(`ok ${++count} - ${name}`); }
const link = (a, b) => symlink(a, b, platform() === 'win32' ? 'junction' : 'dir');
try {
  const home = join(root, 'home');
  await mkdir(home);
  process.env.HOME = home; process.env.USERPROFILE = home;
  process.env.PI_CODING_AGENT_DIR = join(home, 'custom-pi');
  process.env.DSH_HOME = join(home, 'custom-dsh');
  process.env.DSH_AGENTS_HOME = join(home, 'dsh-shared');
  assert.equal(homedir(), home, 'home must be isolated before service imports');
  if (platform() === 'win32') {
    // Exercise the real cmd shim transport in an isolated child, not a mock.
    // This echo CLI never downloads or installs anything.
    const bin = join(root, 'bin');
    await put(join(bin, 'echo-argv.cjs'), 'console.log(JSON.stringify(process.argv.slice(2)));');
    await put(join(bin, 'skills.cmd'), `@echo off\r\n"${process.execPath}" "%~dp0echo-argv.cjs" %*\r\n`);
    const originalPath = process.env.PATH;
    process.env.PATH = `${bin}${delimiter}${originalPath || ''}`;
    delete process.env.SKILLHUB_SKILLS_VERSION;
    await check('Windows batch transport preserves spaced option-like arguments', async () => {
      const cli = await import('../packages/backend/dist/services/cli.js');
      const args = ['add', 'owner/repo', '--skill', 'demo --global', '--agent', 'universal', '--copy'];
      const result = await cli.runSkillsCLI(args);
      assert.equal(result.exitCode, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout.trim()), args);
      await assert.rejects(cli.runSkillsCLI(['find', 'unsafe%NAME%']), /Unsafe character/);
    });
    process.env.PATH = originalPath;
  }
  const paths = await import('../packages/backend/dist/services/paths.js');
  const scanner = await import('../packages/backend/dist/services/scanner.js');
  const instructions = await import('../packages/backend/dist/services/instruction-scanner.js');
  const mcp = await import('../packages/backend/dist/services/mcp-scanner.js');
  const ops = await import('../packages/backend/dist/services/skill-operations.js');
  const pi = paths.getPiAgentDir(), dsh = paths.getDshHome(), dshShared = paths.getDshAgentsHome();
  const shared = join(home, '.agents', 'skills');
  const projects = join(root, 'projects'), project = join(projects, 'demo');
  await put(join(project, 'package.json'), '{}');
  await put(join(home, 'skillhub.config.json'), JSON.stringify({ projectDirs: [projects] }));
  await put(join(home, '.skillhub', 'trusted-dirs.json'), JSON.stringify([projects]));
  await check('environment overrides, tilde expansion and blank-home fallback', async () => {
    assert.equal(pi, process.env.PI_CODING_AGENT_DIR); assert.equal(dsh, process.env.DSH_HOME);
    process.env.DSH_HOME = '  '; assert.equal(paths.getDshHome(), join(home, '.dsh'));
    process.env.DSH_HOME = '~/alternate'; assert.equal(paths.getDshHome(), join(home, 'alternate'));
    process.env.DSH_HOME = dsh;
    process.env.DSH_AGENTS_HOME = ''; assert.equal(paths.getDshAgentsHome(), cwd);
    process.env.DSH_AGENTS_HOME = dshShared;
  });
  await bundle(join(shared, 'shared-pi'), 'shared-pi');
  await bundle(join(dshShared, 'skills', 'shared-dsh'), 'shared-dsh');
  await check('shared skills alone do not detect either harness', async () => {
    const agents = await scanner.detectAgents(); assert.equal(agents.length, 18);
    for (const id of ['pi', 'deepseek-harness']) assert.equal(agents.find(a => a.id === id).detected, false);
  });
  await bundle(join(pi, 'skills', 'native-pi'), 'native-pi');
  await bundle(join(dsh, 'skills', 'native-dsh'), 'native-dsh');
  await bundle(join(project, '.pi', 'skills', 'project-pi'), 'project-pi');
  await bundle(join(project, '.dsh', 'skills', 'project-dsh'), 'project-dsh');
  await bundle(join(project, '.agents', 'skills', 'project-shared'), 'project-shared');
  await bundle(join(dsh, 'skills', 'nested', 'not-loaded'), 'not-loaded');
  await bundle(join(dsh, 'skills', '.system', 'reserved'), 'reserved');
  await check('native/shared attribution, project scope, DSH direct-bundle rules and counts', async () => {
    assert.deepEqual((await scanner.scanAllSkills('pi')).map(s => s.name).sort(), ['native-pi', 'project-pi', 'project-shared', 'shared-pi'].sort());
    assert.deepEqual((await scanner.scanAllSkills('deepseek-harness')).map(s => s.name).sort(), ['native-dsh', 'project-dsh', 'project-shared', 'shared-dsh'].sort());
    for (const id of ['pi', 'deepseek-harness']) {
      const agent = (await scanner.detectAgents()).find(a => a.id === id);
      assert.equal(agent.detected, true); assert.equal(agent.skillCount, (await scanner.scanAllSkills(id)).length);
    }
    for (const dir of ['.pi/skills', '.dsh/skills', '.agents/skills']) assert.equal(await scanner.isUnderProjectSkillDir(join(project, dir, 'demo')), true);
    assert.equal(await scanner.isUnderKnownSkillDir(join(dsh, 'skills-evil', 'demo')), false);
  });
  await link(join(pi, 'skills', 'native-pi'), join(shared, 'pi-alias'));
  await link(join(project, '.dsh', 'skills', 'project-dsh'), join(project, '.agents', 'skills', 'dsh-alias'));
  await bundle(join(pi, 'skills', 'same-name'), 'same-name'); await bundle(join(shared, 'same-name'), 'same-name');
  await check('symlink deduplication and unique IDs for distinct same-name copies', async () => {
    const rows = await scanner.scanAllSkills('pi');
    assert.equal(rows.some(s => s.path === join(shared, 'pi-alias')), false);
    assert.equal(rows.filter(s => s.name === 'same-name').length, 2);
    assert.equal(new Set(rows.map(s => s.id)).size, rows.length);
    assert.equal((await scanner.scanAllSkills('deepseek-harness')).some(s => s.path === join(project, '.agents', 'skills', 'dsh-alias')), false);
    const all = await scanner.scanAllSkills();
    assert.equal(all.some(s => s.agentId === 'deepseek-harness' && s.path === join(project, '.agents', 'skills', 'dsh-alias')), false);
    assert.equal(all.filter(s => s.agentId === 'deepseek-harness').every(s => s.supportsUpdate === false), true);
    const projectOnly = join(projects, 'native-only');
    await put(join(projectOnly, 'package.json'), '{}');
    for (const [id, dir] of [['pi', '.pi'], ['deepseek-harness', '.dsh']]) {
      const native = join(projectOnly, dir, 'skills', `only-${id}`);
      await bundle(native, `only-${id}`);
      await mkdir(join(projectOnly, '.agents', 'skills'), { recursive: true });
      await link(native, join(projectOnly, '.agents', 'skills', `${id}-alias`));
    }
    // Temporarily remove both native global homes; only projects prove detection.
    const { rename } = await import('node:fs/promises');
    await rename(pi, `${pi}-saved`); await rename(dsh, `${dsh}-saved`);
    try {
      for (const id of ['pi', 'deepseek-harness']) assert.equal((await scanner.detectAgents()).find(a => a.id === id).detected, true);
    } finally {
      await rename(`${pi}-saved`, pi); await rename(`${dsh}-saved`, dsh);
      await rm(projectOnly, { recursive: true, force: true });
    }
  });
  await put(join(pi, 'AGENTS.md'), 'Pi global'); await put(join(pi, 'CLAUDE.md'), 'Pi fallback');
  await put(join(dsh, 'AGENTS.md'), 'DSH global'); await put(join(dsh, 'CLAUDE.md'), 'Not DSH global');
  for (const name of ['AGENTS.md', 'CLAUDE.md', 'AGENTS.local.md', 'CLAUDE.local.md']) await put(join(project, name), name);
  await check('Pi instruction precedence, DSH local overlays and safe global writes', async () => {
    const rows = await instructions.scanInstructions([projects]);
    assert.deepEqual(rows.filter(r => r.toolId === 'pi').map(r => r.path).sort(), [join(pi, 'AGENTS.md'), join(project, 'AGENTS.md')].sort());
    assert.equal(rows.filter(r => r.toolId === 'deepseek-harness').length, 5);
    await instructions.writeInstructionContent(join(pi, 'AGENTS.md'), 'updated');
    await instructions.writeInstructionContent(join(dsh, 'AGENTS.md'), 'updated');
    assert.equal(await instructions.readInstructionContent(join(dsh, 'AGENTS.md')), 'updated');
    await assert.rejects(instructions.writeInstructionContent(join(root, 'untrusted.md'), 'no'), /outside allowed roots/);
    await rm(join(pi, 'AGENTS.md'));
    assert.equal((await instructions.scanInstructions([])).find(r => r.toolId === 'pi').path, join(pi, 'CLAUDE.md'));
    await put(join(pi, 'AGENTS.override.md'), 'Modern Pi override');
    await put(join(project, 'AGENTS.override.md'), 'Modern project override');
    assert.deepEqual((await instructions.scanInstructions([projects])).filter(r => r.toolId === 'pi').map(r => r.path).sort(), [join(pi, 'AGENTS.override.md'), join(project, 'AGENTS.override.md')].sort());
    await instructions.writeInstructionContent(join(pi, 'AGENTS.override.md'), 'Updated override');
  });
  await put(join(pi, 'mcp.json'), JSON.stringify({ mcpServers: { local: { command: 'node', args: ['server.js'] } } }));
  await put(join(project, '.pi', 'mcp.json'), JSON.stringify({ mcpServers: { remote: { type: 'streamable-http', url: 'https://example.invalid/mcp' } } }));
  await put(join(dsh, 'mcp.json'), JSON.stringify({ mcpServers: { fake: { command: 'node' } } }));
  await check('modern Pi MCP discovery without speculative DSH configs', async () => {
    const rows = await mcp.detectMcpServers([projects]); const configs = rows.filter(r => r.agentId === 'pi');
    assert.equal(configs.length, 2); assert.equal(configs.find(r => r.name === 'local').transport, 'stdio');
    assert.equal(configs.find(r => r.name === 'remote').transport, 'http');
    assert.equal(configs.find(r => r.name === 'remote').projectRoot, project);
    assert.equal(rows.some(r => r.agentId === 'deepseek-harness'), false);
  });
  const source = join(root, 'source', 'copy-fixture'); await bundle(source, 'copy-fixture');
  const linked = join(root, 'source', 'link-fixture'); await bundle(linked, 'link-fixture');
  await check('copy/symlink into native roots and rescan', async () => {
    assert.equal((await scanner.copySkillToAgents(source, ['pi', 'deepseek-harness'], 'copy')).every(r => r.success), true);
    assert.equal((await scanner.copySkillToAgents(linked, ['pi', 'deepseek-harness'], 'symlink')).every(r => r.success), true);
    for (const id of ['pi', 'deepseek-harness']) assert.equal((await scanner.scanAllSkills(id)).some(s => s.name === 'link-fixture'), true);
  });
  const calls = [];
  async function fakeCLI(args, progress, staging, childEnv) {
    calls.push({ args, staging }); assert.equal(args.includes('deepseek-harness'), false);
    if (args.includes('universal')) {
      assert.equal(args.includes('--global'), false); assert.equal(args.includes('--copy'), true);
      if (childEnv) {
        assert.equal(childEnv.HOME.startsWith(staging), true);
        assert.equal(childEnv.USERPROFILE, childEnv.HOME);
      }
      const name = ops.sanitizeSkillDirectoryName(args[args.indexOf('--skill') + 1]);
      await bundle(join(staging, '.agents', 'skills', name), name);
    }
    progress?.('fixture progress'); return { stdout: 'CLI fixture', stderr: '', exitCode: 0 };
  }
  await check('DSH universal staging, durable copy, cleanup and existing-target refusal', async () => {
    const options = { source: 'owner/repo', skill: 'Store Fixture', agents: ['deepseek-harness'] };
    assert.equal((await ops.installSkills(options, undefined, fakeCLI)).exitCode, 0);
    assert.equal(await exists(join(dsh, 'skills', 'store-fixture', 'SKILL.md')), true);
    assert.equal(await exists(calls.at(-1).staging), false);
    const before = calls.length; assert.equal((await ops.installSkills(options, undefined, fakeCLI)).exitCode, 1); assert.equal(calls.length, before);
  });
  await check('option-like skill values never reach the CLI runner', async () => {
    const cli = await import('../packages/backend/dist/services/cli.js');
    for (const name of ['--global', ' --global', '']) assert.equal(cli.validateSkillName(name), false);
    const before = calls.length;
    const bad = await ops.installSkills({ source: 'owner/repo', skill: '--global', agents: ['deepseek-harness'] }, undefined, fakeCLI);
    assert.notEqual(bad.exitCode, 0); assert.equal(calls.length, before);
  });
  await check('mixed install filters unsupported IDs and reports partial failures', async () => {
    assert.equal((await ops.installSkills({ source: 'owner/repo', skill: 'mixed', agents: ['pi', 'deepseek-harness'], copy: true }, undefined, fakeCLI)).results.length, 2);
    assert.equal(calls.at(-2).args.includes('--global'), true);
    const partial = await ops.installSkills({ source: 'owner/repo', skill: 'partial', agents: ['pi', 'deepseek-harness'] }, undefined,
      (args, progress, staging) => args.includes('pi') ? Promise.resolve({ stdout: '', stderr: 'normal failed', exitCode: 2 }) : fakeCLI(args, progress, staging));
    assert.equal(partial.exitCode, 2); assert.match(partial.stderr, /normal failed/);
    assert.equal(await exists(join(dsh, 'skills', 'partial', 'SKILL.md')), true);
    let stage;
    const failed = await ops.installSkills({ source: 'owner/repo', skill: 'failed', agents: ['deepseek-harness'] }, undefined,
      async (_args, _progress, staging) => { stage = staging; return { stdout: '', stderr: 'download failed', exitCode: 3 }; });
    assert.equal(failed.exitCode, 3); assert.equal(await exists(stage), false); assert.equal(await exists(join(dsh, 'skills', 'failed')), false);
  });
  await check('DSH removal avoids CLI, handles missing targets and preserves canonical links', async () => {
    const before = calls.length;
    assert.equal((await ops.removeSkills({ skill: 'Store Fixture', agents: ['deepseek-harness'] }, undefined, fakeCLI)).exitCode, 0);
    assert.equal(calls.length, before); assert.equal(await exists(join(dsh, 'skills', 'store-fixture')), false);
    assert.equal((await ops.removeSkills({ skill: 'absent', agents: ['deepseek-harness'] }, undefined, fakeCLI)).results[0].skipped, true);
    assert.equal((await ops.removeSkills({ skill: 'link-fixture', agents: ['deepseek-harness'] }, undefined, fakeCLI)).exitCode, 0);
    assert.equal(await exists(join(linked, 'SKILL.md')), true);
    await assert.rejects(ops.removeSkills({ skill: 'copy-fixture', agents: ['deepseek-harness'], skillPath: source }, undefined, fakeCLI), ops.InvalidSkillPathError);
    const mixed = await ops.removeSkills({ skill: 'mixed', agents: ['pi', 'deepseek-harness'] }, undefined, fakeCLI);
    assert.equal(mixed.results.length, 2); assert.equal(mixed.exitCode, 0); assert.equal(await exists(join(dsh, 'skills', 'mixed')), false);
  });
  await check('mixed shared removal also cleans native DSH copy without crossing project scope', async () => {
    const native = join(dsh, 'skills', 'double-copy'), sharedCopy = join(dshShared, 'skills', 'double-copy');
    await bundle(native, 'double-copy'); await bundle(sharedCopy, 'double-copy');
    const removed = await ops.removeSkills({ skill: 'double-copy', agents: ['pi', 'deepseek-harness'], skillPath: sharedCopy }, undefined, fakeCLI);
    assert.equal(removed.exitCode, 0); assert.equal(await exists(native), false); assert.equal(await exists(sharedCopy), false);
    const local = join(project, '.agents', 'skills', 'scope-fixture');
    const untouched = join(dsh, 'skills', 'scope-fixture');
    await bundle(local, 'scope-fixture'); await bundle(untouched, 'scope-fixture');
    const before = calls.length;
    const scoped = await ops.removeSkills({ skill: 'scope-fixture', agents: ['pi', 'deepseek-harness'], skillPath: local }, undefined, fakeCLI);
    assert.equal(scoped.exitCode, 0); assert.equal(calls.length, before);
    assert.equal(await exists(local), false); assert.equal(await exists(untouched), true);
    assert.equal(scoped.results.some(row => row.skipped), true);
  });
  process.chdir(project);
  await check('project installs/removals target native .dsh directories', async () => {
    const options = { source: 'owner/repo', skill: 'project-store', agents: ['deepseek-harness'], global: false };
    assert.equal((await ops.installSkills(options, undefined, fakeCLI)).exitCode, 0);
    assert.equal(await exists(join(project, '.dsh', 'skills', 'project-store', 'SKILL.md')), true);
    assert.equal((await ops.removeSkills(options, undefined, fakeCLI)).exitCode, 0);
  });
  process.chdir(cwd);
  await check('route validation and native DSH removal', async () => {
    const { default: Fastify } = await import('fastify');
    const routes = (await import('../packages/backend/dist/routes/skills.js')).default;
    const app = Fastify(); app.wsBroadcast = () => {};
    try {
      await app.register(routes);
      assert.equal((await app.inject({ method: 'POST', url: '/api/skills/install', payload: { source: 'owner/repo', skill: 'demo', agents: ['unknown'] } })).statusCode, 400);
      assert.equal((await app.inject({ method: 'POST', url: '/api/skills/remove', payload: { skill: 'copy-fixture', agents: ['deepseek-harness'], skillPath: join(dsh, 'skills', 'copy-fixture') } })).statusCode, 200);
      assert.equal(await exists(join(dsh, 'skills', 'copy-fixture')), false);
    } finally { await app.close(); }
  });
  console.log(`\n${count} harness regression checks passed.`);
} finally {
  process.chdir(cwd);
  assert.equal(dirname(root), temporaryBase); assert.match(root.split(/[\\/]/).at(-1), /^skillhub-harness-tests-/);
  await rm(root, { recursive: true, force: true });
  for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name];
  Object.assign(process.env, env);
}
