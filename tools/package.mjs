import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { projectRoot, skillRoot, skillFiles } from './skill-files.mjs';

const files = await skillFiles();
const dist = join(projectRoot, 'dist');
await mkdir(dist, { recursive: true });
const stage = await mkdtemp(join(dist, '.package-'));
const { version } = JSON.parse(await readFile(join(skillRoot, 'package.json'), 'utf8'));
const archive = join(dist, `tongji-online-${version}.zip`);
try {
  for (const file of files) {
    const dest = join(stage, 'tongji-online', file);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(join(skillRoot, file), dest);
  }
  await rm(archive, { force: true });
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Compress-Archive -LiteralPath tongji-online -DestinationPath $env:TONGJI_ARCHIVE'], { cwd: stage, env: { ...process.env, TONGJI_ARCHIVE: archive }, encoding: 'utf8' })
    : spawnSync('zip', ['-q', '-r', archive, 'tongji-online'], { cwd: stage, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('ZIP creation failed; install zip or use Windows PowerShell.');
  const content = await readFile(archive);
  const sha256 = createHash('sha256').update(content).digest('hex');
  await writeFile(archive + '.sha256', `${sha256}  tongji-online-${version}.zip\n`);
  console.log(JSON.stringify({ archive, bytes: content.length, files: files.length, sha256 }, null, 2));
} finally { await rm(stage, { recursive: true, force: true }); }
