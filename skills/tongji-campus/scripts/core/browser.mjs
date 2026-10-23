import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CampusError } from './errors.mjs';
import { readSession, saveSession, withStateLock } from './state.mjs';

export function findBrowsers(env = process.env, platform = process.platform) {
  let paths;
  if (platform === 'darwin') paths = {
    chrome: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    edge: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
  };
  else if (platform === 'win32') {
    const roots = [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)']].filter(Boolean);
    paths = {
      chrome: roots.map(r => join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      edge: roots.map(r => join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
    };
  } else paths = {
    chrome: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome'],
    edge: ['/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/opt/microsoft/msedge/msedge']
  };
  return Object.entries(paths).filter(([, p]) => p.some(existsSync)).map(([id, p]) => ({ id, executablePath: p.find(existsSync) }));
}

export async function browserLibrary() {
  try { return await import('playwright-core'); } catch { throw new CampusError('DEPENDENCY_MISSING'); }
}

export async function withBrowser(options, action) {
  return withStateLock(options.home, async () => {
    const state = await readSession(options.home);
    if (!state && options.requireSession) throw new CampusError('LOGIN_REQUIRED');
    const available = findBrowsers();
    const selected = options.browser === 'auto' || !options.browser
      ? available[0] : available.find(b => b.id === options.browser);
    if (!selected) throw new CampusError('BROWSER_UNAVAILABLE');
    const { chromium } = await browserLibrary();
    let browser;
    try {
      browser = await chromium.launch({ executablePath: selected.executablePath, headless: !options.headed, chromiumSandbox: true });
    } catch { throw new CampusError('BROWSER_FAILED'); }
    let context;
    try {
      context = await browser.newContext({
        ...(state ? { storageState: {cookies:state.cookies,origins:state.origins} } : {}),
        viewport: { width: 1280, height: 900 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai',
        acceptDownloads: false, serviceWorkers: 'block'
      });
      const result = await action(context, state);
      // Auth code explicitly saves verified login state; readonly commands preserve cookie rotation.
      if (options.requireSession) await saveSession(options.home, { ...await context.storageState(), serviceData:state.serviceData });
      return result;
    } finally { await context?.close().catch(() => {}); await browser.close().catch(() => {}); }
  });
}

// Session checks and routine service reads use saved credentials without launching Chrome.
export async function withClient(options, action) {
  return withStateLock(options.home, async () => {
    const state = await readSession(options.home);
    if (!state) throw new CampusError('LOGIN_REQUIRED');
    const { request } = await browserLibrary();
    let client;
    try {
      client = await request.newContext({ storageState: {cookies:state.cookies,origins:state.origins}, timeout: 20_000, ignoreHTTPSErrors: false });
      const result = await action(client,state);
      const rotated = await client.storageState();
      await saveSession(options.home, { cookies: rotated.cookies, origins: state.origins, serviceData:state.serviceData });
      return result;
    } finally { await client?.dispose().catch(() => {}); }
  });
}

export async function withPublicClient(action) {
  const {request} = await browserLibrary();
  const client = await request.newContext({timeout:20000,ignoreHTTPSErrors:false});
  try { return await action(client); } finally { await client.dispose(); }
}
