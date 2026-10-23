import { lstat, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
export const skillRoot = join(projectRoot, 'skills', 'tongji-campus');

// Positive allowlist: state, tests, node_modules and project planning can never enter a release.
export async function skillFiles(root = skillRoot) {
  const result = [];
  async function visit(path) {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Skill sources must not contain symbolic links.');
    if (stat.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) await visit(join(path, entry));
    } else if (stat.isFile()) {
      const name = relative(root, path).replaceAll('\\', '/');
      const allowed = ['SKILL.md', 'LICENSE', 'package.json', 'package-lock.json', 'agents/openai.yaml'].includes(name)
        || /^scripts\/(?:[a-z-]+\/)*[a-z-]+\.mjs$/.test(name)
        || /^references\/[a-z-]+\.md$/.test(name);
      if (!allowed) throw new Error('Unexpected source file; refusing to package it.');
      result.push(name);
    }
  }
  for (const entry of ['SKILL.md', 'LICENSE', 'agents', 'scripts', 'references', 'package.json', 'package-lock.json']) await visit(join(root, entry));
  return result.sort();
}
