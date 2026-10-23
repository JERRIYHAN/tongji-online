import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceJson } from '../skills/tongji-online/scripts/core/service-http.mjs';
import { privateCredentials } from '../skills/tongji-online/scripts/core/services.mjs';
import { normalizeBook, normalizeHolding, normalizeLoan, search, item, loans } from '../skills/tongji-online/scripts/adapters/library.mjs';
import { normalizeWeeks, normalizeTimetable, timetable } from '../skills/tongji-online/scripts/adapters/education.mjs';
import { parseArgs } from '../skills/tongji-online/scripts/run.mjs';
import { fakeRequest } from './helpers.mjs';

const libResponse=data=>({data:{success:true,errCode:200,data}});
const eduResponse=data=>({data:{code:200,data}});
const book={recordId:123,title:'机器学习',author:'测试作者',publisher:'测试出版社',publishYear:'2026',isbn:'123456',callNo:['TP181/TEST'],physicalCount:2,onShelfCountI:1,donatorName:'PRIVATE_DONATOR',positionUrl:'https://evil.test/PRIVATE_TOKEN'};

test('service transport restricts host/path/method and keeps authentication service-specific',async()=>{
  const req=fakeRequest({ '/find/unify/search':libResponse({}),'/api/sessionservice/session/getSessionUser':eduResponse({user:{}}) });
  await serviceJson(req,'library','/find/unify/search',{method:'POST',data:{searchFieldContent:'测试'}});
  assert.equal(new URL(req.calls[0].url).hostname,'webpac.tongji.edu.cn');
  assert.equal(req.calls[0].options.headers['X-Token'],undefined);
  assert.equal(req.calls[0].options.maxRedirects,0);
  await serviceJson(req,'education','/api/sessionservice/session/getSessionUser',{credentials:{sessionId:'PRIVATE_EDU'}});
  assert.equal(req.calls[1].options.headers['X-Token'],'PRIVATE_EDU');
  assert.equal(req.calls[1].options.headers.groupCode,undefined);
  for(const args of [ ['library','/find/lendbook/reNew',{method:'POST'}], ['education','/api/sessionservice/session/logout',{method:'POST'}], ['education','https://evil.test',{}], ['library','/find/unify/search',{method:'DELETE'}] ]) {
    await assert.rejects(serviceJson(req,...args),{code:'UNSAFE_RESPONSE'});
  }
  await assert.rejects(serviceJson(req,'education','/api/sessionservice/session/getSessionUser'),{code:'LOGIN_REQUIRED'});
});

test('business-level authentication errors do not masquerade as empty lists',async()=>{
  const req=fakeRequest({'/oga/userinfo':{data:{success:false,errCode:401,message:'PRIVATE_TOKEN'}}});
  await assert.rejects(serviceJson(req,'library','/oga/userinfo'),{code:'LOGIN_REQUIRED'});
  const changed=fakeRequest({'/find/unify/search':{data:{success:false,errCode:0,message:'PRIVATE_VALUE'}}});
  await assert.rejects(search(changed,'测试'),{code:'PAGE_CHANGED'});
});

test('library search has explicit pagination and does not conflate on-shelf with lendable',async()=>{
  const req=fakeRequest({'/find/unify/search':libResponse({numFound:42,searchResult:[book]})});
  const result=await search(req,'机器学习',{field:'title',page:2,limit:10});
  assert.equal(result.total,42);assert.equal(result.page,2);assert.equal(result.hasMore,true);
  assert.equal(req.calls[0].options.data.searchField,'title');
  assert.equal(req.calls[0].options.data.searchFieldContent,'机器学习');
  assert.equal(result.books[0].onShelfCount,1);
  assert.equal(Object.hasOwn(result.books[0],'lendable'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
  const empty=await search(fakeRequest({'/find/unify/search':libResponse({numFound:0,searchResult:[]})}),'无匹配');
  assert.deepEqual(empty.books,[]);
  await assert.rejects(search(fakeRequest({'/find/unify/search':libResponse({total:0,list:[]})}),'测试'),{code:'PAGE_CHANGED'});
});

test('library item returns only selected bibliographic fields and holdings',async()=>{
  const req=fakeRequest({
    '/find/searchResultDetail/getBookDetail':libResponse({bean2List:[{key:'cnb01',description:'题名',fieldVal:'机器学习'},{key:'PRIVATE',fieldVal:'PRIVATE_TOKEN'}]}),
    '/find/physical/groupitems':libResponse({totalCount:1,list:[{callNo:'TP181/TEST',locationName:'四平路校区',curLocationName:'计算机专架',locationAddress:'一楼',processType:'借出',barcode:'PRIVATE_BARCODE',donatorName:'PRIVATE_DONATOR'}]})
  });
  const result=await item(req,'123');
  assert.equal(result.holdings[0].status,'借出');
  assert.equal(result.url,'https://webpac.tongji.edu.cn/s12/');
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
  assert.throws(()=>normalizeBook({id:1,name:'改版'}),{code:'PAGE_CHANGED'});
  assert.throws(()=>normalizeHolding({callNo:'TEST'}),{code:'PAGE_CHANGED'});
});

test('loans require service authentication and omit identifiers and contact details',async()=>{
  const req=fakeRequest({
    '/oga/userinfo':libResponse({userId:'PRIVATE_ID',name:'PRIVATE_NAME'}),
    '/find/loanInfo/loanList':libResponse({searchResult:[{title:'测试图书',normReturnDate:'2026-11-01',returnDate:'2026-12-31',loanDate:'2026-10-01',barcode:'PRIVATE_BARCODE',userId:'PRIVATE_ID'}],numFound:1})
  });
  const result=await loans(req,{jwt:'PRIVATE_JWT',jwtHeader:'Authorization'});
  assert.equal(result.loans[0].dueDate,'2026-11-01');
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
  assert.throws(()=>normalizeLoan({title:'缺少应还日期'}),{code:'PAGE_CHANGED'});
  const oversized=fakeRequest({'/oga/userinfo':libResponse({id:1}),'/find/loanInfo/loanList':libResponse({searchResult:[],numFound:5})});
  await assert.rejects(loans(oversized,{jwt:'test',jwtHeader:'Authorization'}),{code:'RESULT_TOO_LARGE'});
});

test('education timetable selects self and calendar and never emits private session/profile',async()=>{
  const rows=[{courseName:'算法设计',courseCode:'CS001',classCode:'01',studentId:'PRIVATE_STUDENT',timeTableList:[{
    dayOfWeek:1,timeStart:3,timeEnd:4,weeks:[1,3,5],teacherName:'教师甲',roomIdI18n:'教学楼101',teacherCode:'PRIVATE_CODE'
  }]}];
  const req=fakeRequest({
    '/api/sessionservice/session/getSessionUser':eduResponse({user:{uid:'PRIVATE_STUDENT'},sessionid:'PRIVATE_TOKEN'}),
    '/api/baseresservice/schoolCalendar/currentTermCalendar':eduResponse({schoolCalendar:{id:'100',name:'2026秋'}}),
    '/api/electionservice/reportManagement/findStudentTimetab':eduResponse(rows)
  });
  const result=await timetable(req,{sessionId:'PRIVATE_TOKEN'},{week:3,weekday:1});
  assert.equal(result.courses.length,1);assert.equal(result.courses[0].meetings[0].periodStart,3);
  assert.equal(new URL(req.calls[2].url).searchParams.get('calendarId'),'100');
  assert.equal(new URL(req.calls[2].url).searchParams.has('studentCode'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
  assert.deepEqual(normalizeTimetable(rows,{week:2}),[]);
  assert.deepEqual(normalizeTimetable([]),[]);
  assert.throws(()=>normalizeTimetable([{courseName:'课程',timeTableList:[{dayOfWeek:9}]}]),{code:'PAGE_CHANGED'});
  assert.equal(normalizeTimetable([{courseName:'未排课',timeTableList:null}])[0].unscheduled,true);
});

test('week encoding is explicit and invalid or ambiguous formats fail closed',()=>{
  assert.deepEqual(normalizeWeeks('[1,3,5]'),[1,3,5]);
  assert.deepEqual(normalizeWeeks('1, 2, 3'),[1,2,3]);
  assert.deepEqual(normalizeWeeks('1-3'),[1,2,3]);
  assert.deepEqual(normalizeWeeks('1010000000'),[1,3]);
  assert.throws(()=>normalizeWeeks('1-16周（单）'),{code:'PAGE_CHANGED'});
  assert.throws(()=>normalizeWeeks([0,100]),{code:'PAGE_CHANGED'});
});

test('education uses a free-text room label when the standard room name is empty',()=>{
  const [course]=normalizeTimetable([{courseName:'测试课程',timeTableList:[{
    dayOfWeek:2,timeStart:1,timeEnd:2,weeks:[1,2],roomIdI18n:'',roomLable:'测试教学地点'
  }]}]);
  assert.equal(course.meetings[0].room,'测试教学地点');
});

test('credential sanitizer ignores arbitrary headers, extra identities and CRLF',()=>{
  const good=privateCredentials({library:{jwtHeader:'Authorization',jwt:'PRIVATE_JWT',userId:'PRIVATE_ID'},education:{sessionId:'PRIVATE_TOKEN',name:'PRIVATE_NAME'}});
  assert.deepEqual(Object.keys(good.library),['jwt','jwtHeader']);
  assert.deepEqual(Object.keys(good.education),['sessionId']);
  assert.deepEqual(privateCredentials({library:{jwtHeader:'Cookie',jwt:'x'}}),{});
  assert.deepEqual(privateCredentials({education:{sessionId:'a\r\nHost: evil'}}),{});
});

test('new commands reject arbitrary URLs, other-user IDs and write actions',()=>{
  assert.equal(parseArgs(['auth','login','--service','library']).options.service,'library');
  assert.equal(parseArgs(['education','timetable','--week','3']).options.week,3);
  for(const args of [['library','search'],['library','search','--query','test','--limit','500'],['library','renew'],['library','item','--id','https://evil.test'],['education','timetable','--student','PRIVATE_ID'],['education','timetable','--weekday','0']])assert.throws(()=>parseArgs(args),{code:'INVALID_ARGUMENT'});
});
