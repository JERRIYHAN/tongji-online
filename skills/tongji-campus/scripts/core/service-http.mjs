import { CampusError, networkError } from './errors.mjs';
import { privateCredentials } from './services.mjs';

const RULES = {
  library: { origin:'https://webpac.tongji.edu.cn', routes: {
    '/find/homePage/getGroupCode':'POST', '/find/unify/search':'POST',
    '/find/physical/groupitems':'POST', '/find/searchResultDetail/getBookDetail':'GET',
    '/oga/userinfo':'GET', '/find/loanInfo/loanList':'POST'
  } },
  education: { origin:'https://1.tongji.edu.cn', routes: {
    '/api/sessionservice/session/getSessionUser':'GET',
    '/api/baseresservice/schoolCalendar/currentTermCalendar':'GET',
    '/api/electionservice/reportManagement/findStudentTimetab':'GET'
  } }
};

export async function serviceJson(request, service, path, { method='GET', params, data, credentials } = {}) {
  const rule = RULES[service];
  if (!rule || rule.routes[path] !== method) throw new CampusError('UNSAFE_RESPONSE');
  const url = new URL(path, rule.origin);
  if (params) for (const [key,value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const headers = { Accept:'application/json' };
  if (service === 'library') {
    Object.assign(headers, { mappingPath:'s12', groupCode:'201571', 'x-lang':'CHI', 'content-language':'zh_CN' });
    const value = privateCredentials({library:credentials}).library;
    if (value?.jwt) headers[value.jwtHeader] = value.jwt;
  } else {
    const value = privateCredentials({education:credentials}).education;
    if (!value?.sessionId) throw new CampusError('LOGIN_REQUIRED');
    headers['X-Token'] = value.sessionId;
  }
  let response;
  try { response = await request.fetch(url.href, { method, headers, ...(data === undefined ? {} : {data}), maxRedirects:0, maxRetries:0, timeout:20000 }); }
  catch(e) { throw networkError(e); }
  try {
    const status = response.status();
    if (status === 401 || (status >= 300 && status < 400)) throw new CampusError('LOGIN_REQUIRED');
    if (status === 403) throw new CampusError('PERMISSION_DENIED');
    if (status === 429) throw new CampusError('RATE_LIMITED');
    if (status >= 500) throw new CampusError('SERVICE_UNAVAILABLE');
    if (status !== 200 || !(response.headers()['content-type'] ?? '').includes('json')) throw new CampusError('PAGE_CHANGED');
    const body = await response.body();
    if (body.byteLength > 5_000_000) throw new CampusError('RESULT_TOO_LARGE');
    let result;
    try { result = JSON.parse(body.toString('utf8')); } catch { throw new CampusError('PAGE_CHANGED'); }
    const code = Number(service === 'library' ? result?.errCode : result?.code);
    if (code === 401 || code === 403) throw new CampusError(code === 401 ? 'LOGIN_REQUIRED' : 'PERMISSION_DENIED');
    if (code === 429) throw new CampusError('RATE_LIMITED');
    if (service === 'library' ? result?.success !== true : code !== 200) throw new CampusError('PAGE_CHANGED');
    return result.data;
  } finally { await response.dispose(); }
}
