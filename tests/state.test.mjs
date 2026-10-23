import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authFile, clearSession, prepareState, readSession, saveSession, stateDirectory, withStateLock } from '../skills/tongji-online/scripts/core/state.mjs';

test('renaming preserves configured state and prioritizes the new environment variable', () => {
  const current = join(tmpdir(), 'tongji-online-configured');
  const legacy = join(tmpdir(), 'tongji-legacy-configured');
  assert.equal(stateDirectory({ TONGJI_ONLINE_HOME: current, TONGJI_CAMPUS_HOME: legacy }), current);
  assert.equal(stateDirectory({ TONGJI_CAMPUS_HOME: legacy }), legacy);
  assert.throws(() => stateDirectory({ TONGJI_ONLINE_HOME: 'relative', TONGJI_CAMPUS_HOME: legacy }), { code: 'STATE_UNSAFE' });
  assert.throws(() => stateDirectory({ TONGJI_CAMPUS_HOME: 'relative' }), { code: 'STATE_UNSAFE' });
});

test('new installations use the new name while upgrades retain the existing state and lock', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tongji-rename-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const os of ['darwin', 'win32', 'linux']) {
    const home = join(root, os);
    const parent = os === 'darwin' ? join(home, 'Library', 'Application Support')
      : os === 'win32' ? join(home, 'AppData', 'Local')
      : join(home, '.local', 'share');
    const current = join(parent, 'tongji-online');
    const legacy = join(parent, 'tongji-campus');
    assert.equal(stateDirectory({}, { home, os }), current);
    await prepareState(legacy);
    await saveSession(legacy, { cookies: [], origins: [] });
    const reused = stateDirectory({}, { home, os });
    assert.equal(reused, legacy);
    assert.deepEqual(await readSession(reused), { cookies: [], origins: [], serviceData: {} });
    await withStateLock(legacy, async () => {
      await assert.rejects(withStateLock(reused, async () => {}), { code: 'SESSION_BUSY' });
    });
    await mkdir(current);
    assert.equal(stateDirectory({}, { home, os }), current);
  }
});

test('state is private, excludes third-party origins/cookies, and survives a new read', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tongji-test-'));
  t.after(() => rm(root, {recursive:true,force:true}));
  await prepareState(root);
  const cookie = (domain,value) => ({name:'session',value,domain,path:'/',expires:-1,httpOnly:true,secure:true,sameSite:'Lax'});
  await saveSession(root, {
    cookies:[cookie('canvas.tongji.edu.cn','CANVAS_PRIVATE'),cookie('iam.tongji.edu.cn','IAM_PRIVATE'),cookie('weixin.qq.com','WECHAT_PRIVATE')],
    origins:[{origin:'https://canvas.tongji.edu.cn',localStorage:[]},{origin:'https://evil.test',localStorage:[{name:'token',value:'EVIL_PRIVATE'}]}]
  });
  const result = await readSession(root);
  assert.deepEqual(result.cookies.map(c=>c.value), ['CANVAS_PRIVATE','IAM_PRIVATE']);
  const raw = await readFile(authFile(root),'utf8');
  assert.equal(raw.includes('WECHAT_PRIVATE'),false);
  assert.equal(raw.includes('EVIL_PRIVATE'),false);
  if (process.platform !== 'win32') {
    assert.equal((await stat(root)).mode & 0o777, 0o700);
    assert.equal((await stat(authFile(root))).mode & 0o777, 0o600);
  }
  assert.deepEqual(await clearSession(root),{cleared:true,hadSession:true,serverRevoked:false});
  assert.equal(await readSession(root),undefined);
});

test('exclusive operation lock rejects overlapping operations and releases after errors', async t => {
  const root = await mkdtemp(join(tmpdir(), 'tongji-lock-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  let release;
  let started;
  const ready = new Promise(r=>{started=r;});
  const first = withStateLock(root, async()=>{started();await new Promise(r=>{release=r;});return 'done';});
  await ready;
  await assert.rejects(withStateLock(root,async()=>{}),{code:'SESSION_BUSY'});
  release();
  assert.equal(await first,'done');
  await assert.rejects(withStateLock(root,async()=>{throw new Error('test failure');}));
  assert.equal(await withStateLock(root,async()=>42),42);
});

test('rejects symlink state files and directories without deleting their targets', async t => {
  if (process.platform === 'win32') return t.skip('symlink creation requires local privilege');
  const root = await mkdtemp(join(tmpdir(),'tongji-link-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const target = join(root,'target');
  await mkdir(target);
  await symlink(target,join(root,'alias'));
  await assert.rejects(prepareState(join(root,'alias')),{code:'STATE_UNSAFE'});
  await writeFile(join(root,'secret'),'not-a-session');
  await symlink(join(root,'secret'),authFile(target));
  await assert.rejects(readSession(target),{code:'STATE_UNSAFE'});
  await assert.rejects(clearSession(target),{code:'STATE_UNSAFE'});
  assert.equal(await readFile(join(root,'secret'),'utf8'),'not-a-session');
});

test('does not race to remove abandoned locks automatically', async t => {
  const root = await mkdtemp(join(tmpdir(),'tongji-stale-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await prepareState(root);
  await writeFile(join(root,'operation.lock'),'2147483647');
  await assert.rejects(withStateLock(root,async()=>{}),{code:'SESSION_STALE'});
  assert.equal(await readFile(join(root,'operation.lock'),'utf8'),'2147483647');
});

test('multiple service credentials roundtrip without preserving whole personal profiles', async t => {
  const root=await mkdtemp(join(tmpdir(),'tongji-services-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await prepareState(root);
  await saveSession(root,{cookies:[],origins:[{origin:'https://1.tongji.edu.cn',localStorage:[{name:'sessiondata',value:'PRIVATE_PROFILE'}]}],serviceData:{
    library:{jwt:'PRIVATE_LIBRARY_TOKEN',jwtHeader:'Authorization',name:'PRIVATE_NAME'},
    education:{sessionId:'PRIVATE_EDU_TOKEN',studentId:'PRIVATE_STUDENT'}
  }});
  const stored=await readSession(root);
  assert.deepEqual(stored.origins[0].localStorage,[]);
  assert.deepEqual(stored.serviceData,{library:{jwt:'PRIVATE_LIBRARY_TOKEN',jwtHeader:'Authorization'},education:{sessionId:'PRIVATE_EDU_TOKEN'}});
  const serialized=await readFile(authFile(root),'utf8');
  for(const value of ['PRIVATE_PROFILE','PRIVATE_NAME','PRIVATE_STUDENT'])assert.equal(serialized.includes(value),false);
});
