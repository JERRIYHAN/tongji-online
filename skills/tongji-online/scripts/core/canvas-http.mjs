import { CampusError, networkError } from './errors.mjs';

export const CANVAS = 'https://canvas.tongji.edu.cn';
const PATH = /^\/api\/v1\/(?:users\/self\/profile|courses|courses\/[1-9]\d*\/assignments)$/;
const QUERY = new Set(['per_page', 'page', 'enrollment_state', 'enrollment_type', 'include[]', 'override_assignment_dates']);

export function allowedApiUrl(input) {
  let u;
  try { u = new URL(input, CANVAS); } catch { throw new CampusError('UNSAFE_RESPONSE'); }
  if (u.origin !== CANVAS || u.username || u.password || u.hash || !PATH.test(u.pathname)) throw new CampusError('UNSAFE_RESPONSE');
  for (const [key, value] of u.searchParams) {
    if (!QUERY.has(key) || value.length > 100 || !/^[\w.-]+$/.test(value)) throw new CampusError('UNSAFE_RESPONSE');
  }
  return u;
}

export function nextPage(link, current) {
  if (!link) return null;
  // Canvas uses angle-bracket links; commas can appear inside opaque URLs.
  const entries = [...link.matchAll(/<([^>]+)>\s*((?:;\s*[^,<>]+)*)/g)];
  for (const entry of entries) {
    if (!/;\s*rel\s*=\s*"?next"?(?:\s|;|$)/i.test(entry[2])) continue;
    const u = allowedApiUrl(entry[1]);
    if (u.pathname !== new URL(current, CANVAS).pathname) throw new CampusError('UNSAFE_RESPONSE');
    return u.href;
  }
  if (/rel\s*=\s*"?next/i.test(link)) throw new CampusError('UNSAFE_RESPONSE');
  return null;
}

export async function getJson(request, input) {
  const u = allowedApiUrl(input);
  let response;
  try {
    response = await request.get(u.href, {
      headers: { Accept: 'application/json' }, timeout: 20_000, maxRedirects: 0, maxRetries: 0
    });
  } catch (e) { throw networkError(e); }
  try {
    const status = response.status();
    if (status === 401 || (status >= 300 && status < 400)) throw new CampusError('LOGIN_REQUIRED');
    if (status === 403) throw new CampusError('PERMISSION_DENIED');
    if (status === 429) throw new CampusError('RATE_LIMITED');
    if (status >= 500) throw new CampusError('SERVICE_UNAVAILABLE');
    if (status !== 200) throw new CampusError('PAGE_CHANGED');
    const headers = response.headers();
    const type = headers['content-type'] || '';
    if (!type.includes('json')) throw new CampusError('PAGE_CHANGED');
    const body = await response.body();
    if (body.byteLength > 5_000_000) throw new CampusError('RESULT_TOO_LARGE');
    let data;
    try { data = JSON.parse(body.toString('utf8').replace(/^while\(1\);\s*/, '')); }
    catch { throw new CampusError('PAGE_CHANGED'); }
    return { data, link: headers.link || '' };
  } finally { await response.dispose(); }
}

export async function getList(request, input, { maxPages = 10 } = {}) {
  let url = allowedApiUrl(input).href;
  const visited = new Set();
  const all = [];
  while (url) {
    if (visited.has(url)) throw new CampusError('PAGE_CHANGED');
    if (visited.size >= maxPages) throw new CampusError('RESULT_TOO_LARGE');
    visited.add(url);
    const result = await getJson(request, url);
    if (!Array.isArray(result.data)) throw new CampusError('PAGE_CHANGED');
    all.push(...result.data);
    url = nextPage(result.link, url);
  }
  return all;
}

export async function verifyCanvas(request) {
  const { data } = await getJson(request, '/api/v1/users/self/profile');
  if (!data || typeof data !== 'object' || !/^[1-9]\d*$/.test(String(data.id))) throw new CampusError('PAGE_CHANGED');
  return { service: 'canvas', authenticated: true };
}
