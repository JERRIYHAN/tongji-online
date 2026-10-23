import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { main, parseArgs } from '../skills/tongji-campus/scripts/run.mjs';

test('login defaults to QR, password is a presentation preference, no secrets accepted', () => {
  assert.equal(parseArgs(['auth','login']).options.method,'qr');
  assert.equal(parseArgs(['auth','login','--method','password']).options.method,'password');
  for (const args of [
    ['auth','login','--password','PRIVATE_PASSWORD'],['auth','login','--cookie','PRIVATE_COOKIE'],
    ['auth','login','--method','anything'],['auth','login','--timeout','1'],
    ['canvas','assignments'],['canvas','assignments','--course','../secret'],
    ['canvas','upcoming','--days','10000'],['canvas','upcoming','--days','1','--days','2'],
    ['canvas','submit'],['canvas','courses','--url','https://evil.test']
  ]) assert.throws(()=>parseArgs(args),{code:'INVALID_ARGUMENT'});
});

test('missing session is an actionable failure; status does not claim a login', async t => {
  const root = await mkdtemp(join(tmpdir(),'tongji-cli-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  let raw='';
  const runtime={home:root,stdout:{write:s=>{raw+=s;}},stderr:{write:()=>{}}};
  assert.equal(await main(['auth','status'],runtime),0);
  assert.equal(JSON.parse(raw).data.authenticated,false);
  raw='';
  assert.equal(await main(['canvas','courses'],runtime),1);
  assert.equal(JSON.parse(raw).error.code,'LOGIN_REQUIRED');
});

test('process output is JSON and never repeats invalid secret arguments', () => {
  const path = new URL('../skills/tongji-campus/scripts/run.mjs',import.meta.url);
  const result = spawnSync(process.execPath,[path.pathname,'auth','login','--password','PRIVATE_PASSWORD'],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stdout).error.code,'INVALID_ARGUMENT');
  assert.equal((result.stdout+result.stderr).includes('PRIVATE_PASSWORD'),false);
});
