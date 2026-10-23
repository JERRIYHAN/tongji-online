#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { CampusError, failure } from './core/errors.mjs';
import { stateDirectory } from './core/state.mjs';
import { browserLibrary, findBrowsers, withClient, withPublicClient } from './core/browser.mjs';
import { authStatus, login, logout } from './core/auth.mjs';
import { assignments, courses, upcoming } from './adapters/canvas.mjs';
import { verifyCanvas } from './core/canvas-http.mjs';
import { search, item, loans } from './adapters/library.mjs';
import { timetable } from './adapters/education.mjs';
import { SERVICES } from './core/services.mjs';

const COMMANDS = {
  'auth login': { method: 'value', browser: 'value', timeout: 'value', service:'value' },
  'auth status': {service:'value'},
  'auth logout': {},
  'canvas courses': {},
  'canvas assignments': { course: 'value' },
  'canvas upcoming': { days: 'value' },
  'library search': {query:'value',field:'value',page:'value',limit:'value'},
  'library item': {id:'value'},
  'library loans': {},
  'education timetable': {term:'value',week:'value',weekday:'value'},
  doctor: {}, help: {}
};

export function parseArgs(args) {
  const tokens = [...args];
  let command = tokens.shift() || 'help';
  if (command === '--help' || command === '-h') command = 'help';
  if (['auth', 'canvas','library','education'].includes(command)) command += ' ' + tokens.shift();
  if (!Object.hasOwn(COMMANDS, command)) throw new CampusError('INVALID_ARGUMENT');
  const options = { browser: 'auto', method: 'qr', timeout: 600, days: 7, headed: false,service:'canvas',field:'keyword',page:1,limit:10 };
  const seen = new Set();
  while (tokens.length) {
    const token = tokens.shift();
    if (!token.startsWith('--')) throw new CampusError('INVALID_ARGUMENT');
    const key = token.slice(2);
    const spec = COMMANDS[command][key];
    if (!spec || seen.has(key)) throw new CampusError('INVALID_ARGUMENT');
    seen.add(key);
    if (spec === 'flag') options[key] = true;
    else {
      const value = tokens.shift();
      if (!value || value.startsWith('--')) throw new CampusError('INVALID_ARGUMENT');
      options[key] = value;
    }
  }
  if (!['auto', 'chrome', 'edge'].includes(options.browser) || !['qr', 'password'].includes(options.method)||!SERVICES.includes(options.service)) throw new CampusError('INVALID_ARGUMENT');
  for (const [key, min, max] of [['timeout', 30, 1800], ['days', 1, 30]]) {
    if (!/^\d+$/.test(String(options[key]))) throw new CampusError('INVALID_ARGUMENT');
    options[key] = Number(options[key]);
    if (options[key] < min || options[key] > max) throw new CampusError('INVALID_ARGUMENT');
  }
  if (command === 'canvas assignments' && !/^[1-9]\d{0,19}$/.test(options.course ?? '')) throw new CampusError('INVALID_ARGUMENT');
  for (const [key,min,max] of [['page',1,100],['limit',1,20],['week',1,60],['weekday',1,7]]) {
    if (options[key]===undefined) continue;
    if (!/^\d+$/.test(String(options[key]))) throw new CampusError('INVALID_ARGUMENT');
    options[key]=Number(options[key]);
    if(options[key]<min||options[key]>max)throw new CampusError('INVALID_ARGUMENT');
  }
  if(command==='library search'&&(!options.query?.trim()||options.query.length>200||!['keyword','title','author','isbn'].includes(options.field)))throw new CampusError('INVALID_ARGUMENT');
  if(command==='library item'&&!/^[1-9]\d{0,19}$/.test(options.id??''))throw new CampusError('INVALID_ARGUMENT');
  if(options.term!==undefined&&!/^[1-9]\d{0,19}$/.test(options.term))throw new CampusError('INVALID_ARGUMENT');
  return { command, options };
}

export const help = {
  name: 'tongji-online', version: '0.3.0', readOnly: true,
  commands: [
    'doctor', 'auth login [--service canvas|library|education] [--method qr|password] [--browser auto|chrome|edge] [--timeout 600]',
    'auth status [--service canvas|library|education]', 'auth logout',
    'canvas courses', 'canvas assignments --course <课程ID>',
    'canvas upcoming [--days 7]',
    'library search --query <检索词> [--field keyword|title|author|isbn] [--page 1] [--limit 10]',
    'library item --id <书目ID>', 'library loans',
    'education timetable [--term <学期ID>] [--week <教学周>] [--weekday <1到7>]'
  ],
  notes: ['登录在学校页面手动完成，不接受密码或 Cookie 参数。', 'upcoming 查询未来 days×24 小时，包含已提交作业并标注状态；不包含无截止时间的作业。',
    '本地会话文件仅当前用户可读，未使用钥匙串加密；清除本机会话不会撤销其他副本。', '给 AI 的查询输出会进入其上下文；不含成绩、学号或登录凭据。']
};

export async function execute(command, options, runtime = {}) {
  if (command === 'help') return help;
  if (command === 'doctor') {
    let dependency = false;
    try { await browserLibrary(); dependency = true; } catch {}
    return { node: process.versions.node, nodeSupported: Number(process.versions.node.split('.')[0]) >= 22,
      dependencyInstalled: dependency, browsers: findBrowsers().map(b => b.id), supportedServices: SERVICES };
  }
  const resolved = { ...options, home: runtime.home || stateDirectory() };
  if (command === 'auth login') return login(resolved, runtime);
  if (command === 'auth status') return authStatus(resolved);
  if (command === 'auth logout') return logout(resolved);
  if(command==='library search')return withPublicClient(request=>search(request,options.query,options));
  if(command==='library item')return withPublicClient(request=>item(request,options.id));
  return withClient(resolved, async (request,state) => {
    if(command==='library loans')return loans(request,state.serviceData?.library);
    if(command==='education timetable')return timetable(request,state.serviceData?.education,options);
    if (command === 'canvas courses') return courses(request);
    if (command === 'canvas upcoming') return upcoming(request, options.days);
    await verifyCanvas(request);
    return assignments(request, options.course);
  });
}

export async function main(args = process.argv.slice(2), runtime = {}) {
  const out = runtime.stdout ?? process.stdout;
  const err = runtime.stderr ?? process.stderr;
  try {
    const { command, options } = parseArgs(args);
    const data = await execute(command, options, { ...runtime, emit: event => err.write(JSON.stringify(event) + '\n') });
    out.write(JSON.stringify({ ok: true, data }, null, 2) + '\n');
    return 0;
  } catch (e) { out.write(JSON.stringify(failure(e), null, 2) + '\n'); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Avoid browser debug messages containing request details even if inherited from an agent environment.
  delete process.env.DEBUG;
  delete process.env.PWDEBUG;
  process.umask(0o077);
  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());
  process.once('SIGTERM', () => controller.abort());
  process.exitCode = await main(process.argv.slice(2), { signal: controller.signal });
}
