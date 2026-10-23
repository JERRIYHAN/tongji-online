import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { login } from '../skills/tongji-campus/scripts/core/auth.mjs';
import { CampusError } from '../skills/tongji-campus/scripts/core/errors.mjs';
import { prepareState, readSession } from '../skills/tongji-campus/scripts/core/state.mjs';
import { LOGIN_URLS } from '../skills/tongji-campus/scripts/core/services.mjs';
import { fakeRequest } from './helpers.mjs';

const state={cookies:[],origins:[],serviceData:{
  library:{jwt:'PRIVATE_LIBRARY',jwtHeader:'Authorization'},education:{sessionId:'PRIVATE_EDUCATION'}
}};
const route={canvas:'/api/v1/users/self/profile',library:'/oga/userinfo',education:'/api/sessionservice/session/getSessionUser'};
const response={canvas:{id:1,name:'PRIVATE_NAME'},library:{success:true,errCode:200,data:{name:'PRIVATE_NAME'}},education:{code:200,data:{user:{name:'PRIVATE_NAME'}}}};
const options=service=>({home:'/unused-by-mocks',service,timeout:30,method:'qr',browser:'auto'});

for(const service of ['canvas','library','education'])test(`${service}: a valid saved login succeeds even when browser startup is unavailable`,async()=>{
  const request=fakeRequest({[route[service]]:{data:response[service]}});
  let browserCalls=0,events=0;
  const result=await login(options(service),{emit:()=>events++},{
    client:async(_options,action)=>action(request,state),
    browser:async()=>{browserCalls++;throw new CampusError('BROWSER_FAILED');}
  });
  assert.deepEqual(result,{service,authenticated:true,reused:true});
  assert.equal(request.calls.length,1);
  assert.equal(browserCalls,0);
  assert.equal(events,0);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
});

test('only an authentication rejection falls through to browser login',async()=>{
  const request=fakeRequest({[route.education]:{status:401}});
  const order=[];
  await assert.rejects(login(options('education'),{}, {
    client:async(_options,action)=>{order.push('check');return action(request,state);},
    browser:async opts=>{order.push('browser');assert.equal(opts.headed,true);throw new CampusError('BROWSER_FAILED');}
  }),{code:'BROWSER_FAILED'});
  assert.deepEqual(order,['check','browser']);
});

test('network, permission, rate limit, server, schema and local-state failures never open a login browser',async()=>{
  const cases=[
    ['NETWORK_ERROR',new Error('PRIVATE_NETWORK_DETAILS')],
    ['PERMISSION_DENIED',{status:403}],['RATE_LIMITED',{status:429}],
    ['SERVICE_UNAVAILABLE',{status:503}],['PAGE_CHANGED',{type:'text/html',body:'PRIVATE_BODY'}]
  ];
  let browserCalls=0;
  for(const [code,spec] of cases){
    const request=fakeRequest({[route.education]:spec});
    await assert.rejects(login(options('education'),{}, {
      client:async(_options,action)=>action(request,state),browser:async()=>{browserCalls++;}
    }),{code});
  }
  for(const code of ['STATE_IO','STATE_UNSAFE','SESSION_BUSY','SESSION_STALE','DEPENDENCY_MISSING']){
    await assert.rejects(login(options('education'),{}, {
      client:async()=>{throw new CampusError(code);},browser:async()=>{browserCalls++;}
    }),{code});
  }
  assert.equal(browserCalls,0);
});

test('a genuinely missing local session proceeds to the browser rather than claiming reuse',async t=>{
  const home=await mkdtemp(join(tmpdir(),'tongji-auth-missing-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  let browserCalls=0;
  await assert.rejects(login({...options('canvas'),home},{},{browser:async()=>{
    browserCalls++;throw new CampusError('BROWSER_UNAVAILABLE');
  }}),{code:'BROWSER_UNAVAILABLE'});
  assert.equal(browserCalls,1);
});

test('browser recovery obtains a fresh service credential and preserves the other service',async t=>{
  const home=await mkdtemp(join(tmpdir(),'tongji-auth-recover-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  await prepareState(home);
  const expired=fakeRequest({[route.library]:{status:401}});
  const recovered=fakeRequest({[route.library]:{data:response.library}});
  let navigated,captures=0;
  const page={
    isClosed:()=>false,url:()=> 'https://webpac.tongji.edu.cn/s12/',
    goto:async url=>{navigated=url;},
    locator:()=>({first:()=>({waitFor:async()=>{}})}),
    evaluate:async()=>({jwt:++captures===1?'PRIVATE_LIBRARY':'PRIVATE_FRESH_LIBRARY',jwtHeader:'Authorization'})
  };
  const context={newPage:async()=>page,pages:()=>[page],request:recovered,storageState:async()=>({cookies:[],origins:[]})};
  const result=await login({...options('library'),home},{},{
    client:async(_options,action)=>action(expired,state),browser:async(_options,action)=>action(context,state)
  });
  assert.deepEqual(result,{service:'library',authenticated:true,reused:false});
  assert.equal(navigated,LOGIN_URLS.library);
  assert.equal(captures,2);
  assert.equal(recovered.calls.length,1);
  assert.equal(recovered.calls[0].options.headers.Authorization,'PRIVATE_FRESH_LIBRARY');
  const saved=await readSession(home);
  assert.deepEqual(saved.serviceData.education,state.serviceData.education);
  assert.equal(saved.serviceData.library.jwt,'PRIVATE_FRESH_LIBRARY');
  assert.equal(state.serviceData.library.jwt,'PRIVATE_LIBRARY');
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
});
