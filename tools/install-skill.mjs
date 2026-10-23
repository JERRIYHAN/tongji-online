import { copyFile, lstat, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { skillFiles, skillRoot } from './skill-files.mjs';

const parent = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'skills');
const destination = join(parent, 'tongji-online');
await mkdir(parent, { recursive: true });
let found = false;
try { await lstat(destination); found = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (found) {
  console.error('目标 skill 已存在，未覆盖。请先检查并自行备份，再决定如何更新。');
  process.exitCode = 1;
} else {
  const stage = await mkdtemp(join(parent, '.tongji-online-install-'));
  try {
    for (const file of await skillFiles()) {
      const target = join(stage, file);
      await mkdir(dirname(target), { recursive: true });
      await copyFile(join(skillRoot, file), target);
    }
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(command, ['ci', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(tmpdir(), 'tongji-online-npm-cache')], { cwd: stage, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) throw new Error('依赖安装失败，未安装 skill。');
    await rename(stage, destination);
    console.log(`已安装：${destination}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
