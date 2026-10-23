import { chmod, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CampusError } from './errors.mjs';
import { SCHOOL_HOSTS, privateCredentials } from './services.mjs';

export function stateDirectory(env = process.env, { home = homedir(), os = platform() } = {}) {
  const configured = env.TONGJI_ONLINE_HOME || env.TONGJI_CAMPUS_HOME;
  if (configured) {
    if (!isAbsolute(configured)) throw new CampusError('STATE_UNSAFE');
    return resolve(configured);
  }
  const parent = os === 'darwin' ? join(home, 'Library', 'Application Support')
    : os === 'win32' ? env.LOCALAPPDATA || join(home, 'AppData', 'Local')
    : env.XDG_DATA_HOME || join(home, '.local', 'share');
  const current = join(parent, 'tongji-online');
  const legacy = join(parent, 'tongji-campus');
  // Reuse the same state and lock when upgrading an existing installation.
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}

export async function exists(path) {
  try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
}

async function assertDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) {
    throw new CampusError('STATE_UNSAFE');
  }
  await chmod(path, 0o700);
}

export async function prepareState(root) {
  try {
    if (root === dirname(root) || root === homedir()) throw new CampusError('STATE_UNSAFE');
    await mkdir(root, { recursive: true, mode: 0o700 });
    await assertDirectory(root);
  } catch (e) { throw e instanceof CampusError ? e : new CampusError('STATE_IO'); }
}

export async function withStateLock(root, action) {
  await prepareState(root);
  const lock = join(root, 'operation.lock');
  let handle;
  try {
    handle = await open(lock, 'wx', 0o600);
    await handle.writeFile(String(process.pid));
  } catch (e) {
    // Do not automatically remove stale locks: competing recoverers could unlink a fresh lock.
    if (e.code === 'EEXIST') {
      const stat = await lstat(lock);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new CampusError('STATE_UNSAFE');
      const pid = Number(await readFile(lock, 'utf8'));
      if (Number.isInteger(pid) && pid > 0) {
        try { process.kill(pid, 0); } catch (cause) {
          if (cause.code === 'ESRCH') throw new CampusError('SESSION_STALE');
        }
      }
      throw new CampusError('SESSION_BUSY');
    }
    if (handle) { await handle.close().catch(() => {}); await rm(lock, { force: true }).catch(() => {}); }
    throw new CampusError('STATE_IO');
  }
  try { return await action(); }
  finally { await handle.close(); await rm(lock, { force: true }); }
}

export const authFile = root => join(root, 'session.json');

export async function readSession(root) {
  const path = authFile(root);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) {
      throw new CampusError('STATE_UNSAFE');
    }
    await chmod(path, 0o600);
    const state = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(state.cookies) || !Array.isArray(state.origins)) throw new CampusError('STATE_IO');
    return state;
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e instanceof CampusError ? e : new CampusError('STATE_IO');
  }
}

export async function saveSession(root, state) {
  const path = authFile(root);
  const temp = join(root, `.session-${randomUUID()}.tmp`);
  try {
    // Only explicitly supported school hosts; never persist WeChat or arbitrary third-party sites.
    const hosts = SCHOOL_HOSTS;
    const minimal = {
      cookies: state.cookies.filter(c => hosts.has(c.domain.replace(/^\./, ''))),
      origins: state.origins.filter(o => {
        try { const u = new URL(o.origin); return u.protocol === 'https:' && hosts.has(u.hostname); }
        catch { return false; }
      }).map(o=>({origin:o.origin,localStorage:o.localStorage.filter(v=>o.origin==='https://canvas.tongji.edu.cn'||o.origin==='https://iam.tongji.edu.cn')})),
      serviceData: privateCredentials(state.serviceData)
    };
    const handle = await open(temp, 'wx', 0o600);
    try { await handle.writeFile(JSON.stringify(minimal)); await handle.sync(); } finally { await handle.close(); }
    await rename(temp, path);
    await chmod(path, 0o600);
  } catch { throw new CampusError('STATE_IO'); }
  finally { await rm(temp, { force: true }).catch(() => {}); }
}

export async function clearSession(root) {
  const file = authFile(root);
  if (!(await exists(file))) return { cleared: true, hadSession: false, serverRevoked: false };
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new CampusError('STATE_UNSAFE');
  await rm(file);
  return { cleared: true, hadSession: true, serverRevoked: false };
}
