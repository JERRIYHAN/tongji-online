import { setTimeout as delay } from 'node:timers/promises';
import { CampusError, networkError } from './errors.mjs';
import { CANVAS, verifyCanvas } from './canvas-http.mjs';
import { authFile, clearSession, exists, saveSession, withStateLock } from './state.mjs';
import { withBrowser, withClient } from './browser.mjs';
import { LOGIN_URLS, privateCredentials } from './services.mjs';
import { verifyLibrary } from '../adapters/library.mjs';
import { verifyEducation } from '../adapters/education.mjs';

export async function verifyService(request, service='canvas', serviceData={}) {
  if (service==='canvas') return verifyCanvas(request);
  if (service==='library') return verifyLibrary(request,serviceData.library);
  if (service==='education') return verifyEducation(request,serviceData.education);
  throw new CampusError('INVALID_ARGUMENT');
}

async function captureCredentials(context, service, existing={}) {
  if (service==='canvas') return existing;
  const origin=service==='library'?'https://webpac.tongji.edu.cn':'https://1.tongji.edu.cn';
  for (const page of context.pages()) {
    if (page.isClosed()) continue;
    try {
      if (new URL(page.url()).origin!==origin) continue;
      // Values stay inside the local process. Never emit them or return them to the model.
      const captured=await page.evaluate(service=>service==='education'
        ? {sessionId:sessionStorage.getItem('sessionid')||localStorage.getItem('sessionid')||''}
        : {jwt:sessionStorage.getItem('jwt')||'',jwtHeader:sessionStorage.getItem('jwtHeader')||''},service);
      if (service==='library'&&!captured.jwt) {
        const cookies=await context.cookies(origin);
        captured.jwt=cookies.find(c=>c.name==='jwt')?.value??'';
        captured.jwtHeader=cookies.find(c=>c.name==='jwtHeader')?.value??'';
      }
      const safe=privateCredentials({[service]:captured});
      if (service==='education'?safe.education?.sessionId:safe.library?.jwt) return {...existing,...safe};
    } catch { /* Redirect in progress: wait for the normal page flow to finish. */ }
  }
  return existing;
}

export async function loginPresentation(page, method) {
  let host;
  try { host = new URL(page.url()).hostname; } catch { return { qrVisible: false, passwordVisible: false }; }
  if (host !== 'iam.tongji.edu.cn') return { qrVisible: false, passwordVisible: false };
  const qr = page.locator('#tab12Con #wx_QRImage');
  const password = page.locator('#tab1Con input[type="password"]');
  const qrVisible = await qr.isVisible().catch(() => false);
  const passwordVisible = await password.isVisible().catch(() => false);
  if (method === 'qr' && qrVisible) await qr.scrollIntoViewIfNeeded().catch(() => {});
  if (method === 'password' && passwordVisible) await password.scrollIntoViewIfNeeded().catch(() => {});
  // Never inject login scripts, read input values, change auth parameters, or export a QR code.
  return { qrVisible, passwordVisible };
}

function landedOnCanvas(page) {
  if (page.isClosed()) return false;
  try {
    const u = new URL(page.url());
    return u.origin === CANVAS && !/(?:login|logout|oauth|openid|saml|authn)/i.test(u.pathname);
  } catch { return false; }
}

const serviceCredential = (service, data) => service==='library' ? data?.library?.jwt : service==='education' ? data?.education?.sessionId : undefined;

export async function login(options, { emit = () => {}, signal } = {}, { client=withClient, browser=withBrowser } = {}) {
  const service=options.service??'canvas';
  let rejectedCredential;
  try {
    const result=await client(options, (request,state)=>{
      rejectedCredential=serviceCredential(service,state.serviceData);
      return verifyService(request,service,state.serviceData);
    });
    return {...result,reused:true};
  } catch(e) {
    // A failed network, permission or local-state check is not a reason to log in again.
    if(e.code!=='LOGIN_REQUIRED')throw e;
  }
  return browser({ ...options, headed: true }, async (context,state) => {
    let serviceData=state?.serviceData??{};
    const rejected=new Set(rejectedCredential?[rejectedCredential]:[]);
    const credentialKey=()=>serviceCredential(service,serviceData);
    const save=async()=>saveSession(options.home,{...await context.storageState(),serviceData});
    if (rejectedCredential && credentialKey()===rejectedCredential) {
      serviceData={...serviceData};delete serviceData[service];
    }
    const page = await context.newPage();
    try { await page.goto(LOGIN_URLS[service], { waitUntil: 'domcontentloaded', timeout: 30_000 }); }
    catch (e) { if (page.isClosed()) throw new CampusError('LOGIN_CANCELLED'); throw networkError(e); }
    // School scripts initialize after DOM content is ready. Wait for visible known controls only.
    await page.locator('#tab12Con #wx_QRImage, #tab1Con input[type="password"], #global_nav_dashboard_link')
      .first().waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});
    const presentation = await loginPresentation(page, options.method);
    emit({ event: 'login_ready', service, preferredMethod: options.method, ...presentation,
      message: '正在通过学校页面恢复并验证会话；仅在页面要求时扫码或手动输入账号密码。不要在聊天里发送密码或二维码。' });
    const deadline = Date.now() + options.timeout * 1000;
    while (Date.now() < deadline) {
      if (signal?.aborted || context.pages().length === 0) throw new CampusError('LOGIN_CANCELLED');
      serviceData=await captureCredentials(context,service,serviceData);
      const ready=service==='canvas'?context.pages().some(landedOnCanvas)
        : service==='library'?Boolean(serviceData.library?.jwt):Boolean(serviceData.education?.sessionId);
      if (ready && (service==='canvas'||!rejected.has(credentialKey()))) {
        try {
          const result = await verifyService(context.request,service,serviceData);
          await save();
          return { ...result, reused: false };
        } catch(e) {
          if(service==='canvas'||e.code!=='LOGIN_REQUIRED')throw e;
          rejected.add(credentialKey());
          serviceData={...serviceData};delete serviceData[service];
        }
      }
      await delay(1000);
    }
    throw new CampusError('LOGIN_TIMEOUT');
  });
}

export async function authStatus(options) {
  const service=options.service??'canvas';
  if (!(await exists(authFile(options.home)))) return { service, authenticated: false, reason: 'session-missing' };
  try {
    return await withClient(options, (request,state) => verifyService(request,service,state.serviceData));
  } catch (e) {
    if (e.code === 'LOGIN_REQUIRED') return { service, authenticated: false, reason: 'session-missing-or-expired' };
    throw e;
  }
}

export async function logout(options) {
  return withStateLock(options.home, () => clearSession(options.home));
}
