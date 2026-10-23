import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { projectRoot, skillFiles, skillRoot } from './skill-files.mjs';

const files = await skillFiles();
for (const file of files.filter(f => f.endsWith('.mjs'))) {
  const result = spawnSync(process.execPath, ['--check', join(skillRoot, file)], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`Syntax check failed: ${file}`);
}
const skill = await readFile(join(skillRoot, 'SKILL.md'), 'utf8');
if (/\[TODO|FIXME|placeholder/i.test(skill)) throw new Error('Unfinished skill template');
for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) await readFile(join(skillRoot, match[1]));
const pkg = JSON.parse(await readFile(join(skillRoot, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(join(skillRoot, 'package-lock.json'), 'utf8'));
if (lock.packages[''].dependencies['playwright-core'] !== pkg.dependencies['playwright-core']) throw new Error('Lockfile mismatch');
const help = spawnSync(process.execPath, [join(skillRoot,'scripts','run.mjs'),'help'], { cwd:projectRoot, encoding:'utf8' });
if (help.status !== 0 || JSON.parse(help.stdout).data.version !== pkg.version) throw new Error('Version/help mismatch');
console.log(`通过：${files.length} 个分发文件、脚本语法、引用、锁文件与命令入口。`);
