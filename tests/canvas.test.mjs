import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { allowedApiUrl, CANVAS, getJson, getList, nextPage, verifyCanvas } from '../skills/tongji-campus/scripts/core/canvas-http.mjs';
import { assignments, courses, normalizeAssignment, normalizeCourse, upcoming } from '../skills/tongji-campus/scripts/adapters/canvas.mjs';
import { failure } from '../skills/tongji-campus/scripts/core/errors.mjs';
import { fakeRequest } from './helpers.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/canvas.json', import.meta.url), 'utf8'));
function service(overrides = {}) {
  return fakeRequest({
    '/api/v1/users/self/profile': { data: fixture.profile },
    '/api/v1/courses': { data: fixture.courses },
    '/api/v1/courses/101/assignments': { data: fixture.assignments['101'] },
    '/api/v1/courses/202/assignments': { data: fixture.assignments['202'] }, ...overrides
  });
}

test('only known HTTPS read endpoints and bounded query keys are accepted', () => {
  assert.equal(allowedApiUrl('/api/v1/courses').origin, CANVAS);
  for (const u of [
    'http://canvas.tongji.edu.cn/api/v1/courses', 'https://canvas.tongji.edu.cn.evil.test/api/v1/courses',
    'https://evil.test/api/v1/courses', 'https://password@canvas.tongji.edu.cn/api/v1/courses',
    '/api/v1/courses?access_token=PRIVATE_TOKEN', '/api/v1/courses/101/assignments/1/submissions',
    '/api/v1/courses#PRIVATE_TOKEN', '/api/v1/courses/../accounts', '/api/v1/courses?page=1%0aCookie:secret'
  ]) assert.throws(() => allowedApiUrl(u), { code: 'UNSAFE_RESPONSE' });
});

test('HTTP failures and HTML are not treated as empty results; bodies and headers stay private', async () => {
  for (const [status, expected] of [[401,'LOGIN_REQUIRED'],[302,'LOGIN_REQUIRED'],[403,'PERMISSION_DENIED'],[429,'RATE_LIMITED'],[503,'SERVICE_UNAVAILABLE'],[404,'PAGE_CHANGED']]) {
    const request = fakeRequest({ '/api/v1/courses': { status, body: 'PRIVATE_TOKEN' } });
    await assert.rejects(getJson(request, '/api/v1/courses'), { code: expected });
    assert.equal(request.calls[0].disposed, true);
    assert.equal(request.calls[0].options.maxRedirects, 0);
    assert.equal(request.calls[0].options.maxRetries, 0);
  }
  await assert.rejects(getJson(fakeRequest({ '/api/v1/courses': { type: 'text/html', body: '<html>login</html>' } }), '/api/v1/courses'), {code:'PAGE_CHANGED'});
  await assert.rejects(getJson(fakeRequest({ '/api/v1/courses': { body: 'PRIVATE_TOKEN' } }), '/api/v1/courses'), {code:'PAGE_CHANGED'});
  const privateError = new Error('Cookie: PRIVATE_TOKEN https://school/?ticket=PRIVATE_TICKET');
  await assert.rejects(getJson(fakeRequest(() => privateError), '/api/v1/courses'), {code:'NETWORK_ERROR'});
  assert.equal(JSON.stringify(failure(privateError)).includes('PRIVATE_'), false);
});

test('paginates without silent truncation, rejects cycles and external next links', async () => {
  const request = fakeRequest(url => url.searchParams.get('page') === '2'
    ? { data: [{id: 2}] }
    : { data: [{id: 1}], link: `<${CANVAS}/api/v1/courses?page=2>; rel="next"` });
  assert.deepEqual(await getList(request, '/api/v1/courses'), [{id:1}, {id:2}]);
  await assert.rejects(getList(request, '/api/v1/courses', {maxPages:1}), {code:'RESULT_TOO_LARGE'});
  const cyclic = fakeRequest(() => ({data:[],link:`<${CANVAS}/api/v1/courses>; rel="next"`}));
  await assert.rejects(getList(cyclic, '/api/v1/courses'), {code:'PAGE_CHANGED'});
  assert.throws(() => nextPage('<https://evil.test/api/v1/courses>; rel="next"', `${CANVAS}/api/v1/courses`), {code:'UNSAFE_RESPONSE'});
  assert.throws(() => nextPage(`<${CANVAS}/api/v1/courses/1/assignments>; rel="next"`, `${CANVAS}/api/v1/courses`), {code:'UNSAFE_RESPONSE'});
  assert.equal(nextPage(`<${CANVAS}/api/v1/courses?page=1>; rel="current"`, `${CANVAS}/api/v1/courses`), null);
});

test('authenticated empty results differ from unauthenticated or changed formats', async () => {
  assert.deepEqual(await verifyCanvas(service()), {service:'canvas',authenticated:true});
  const empty = await courses(service({'/api/v1/courses':{data:[]}}));
  assert.deepEqual(empty.courses, []);
  await assert.rejects(courses(service({'/api/v1/courses':{data:{error:'changed'}}})), {code:'PAGE_CHANGED'});
  await assert.rejects(courses(service({'/api/v1/users/self/profile':{status:401}})), {code:'LOGIN_REQUIRED'});
});

test('course and assignment output excludes identity, grades, body and unsafe URLs', async () => {
  const result = { courses: await courses(service()), assignments: await assignments(service(), '101') };
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('PRIVATE_'), false);
  assert.equal(serialized.includes('不应输出的姓名'), false);
  assert.equal(result.assignments.assignments[1].dueAtShanghai, '2026-10-23T00:00:00+08:00');
  assert.equal(result.assignments.assignments.find(a => a.id === '11').submitted, true);
  assert.equal(result.assignments.assignments.find(a => a.id === '13').submitted, null);
  assert.equal(result.assignments.assignments.at(-1).dueAt, null);
});

test('upcoming uses exact time interval, local timezone and counts undated assignments', async () => {
  const result = await upcoming(service(), 7, new Date('2026-10-22T04:00:00Z'));
  assert.deepEqual(result.assignments.map(a => a.id), ['22', '11', '21']);
  assert.equal(result.undatedCount, 1);
  assert.equal(result.scannedCourses, 2);
  assert.equal(result.untilExclusive, '2026-10-29T04:00:00.000Z');
  assert.equal(result.assignments[0].dueAtShanghai, '2026-10-22T12:00:00+08:00');
  // If a single course is inaccessible the whole query fails, never an incomplete success.
  await assert.rejects(upcoming(service({'/api/v1/courses/202/assignments':{status:403}}),7,new Date('2026-10-22')), {code:'PERMISSION_DENIED'});
});

test('schema drift does not silently remove deadlines or corrupt identifiers', () => {
  assert.throws(() => normalizeAssignment({id:1,name:'changed'},101), {code:'PAGE_CHANGED'});
  assert.throws(() => normalizeAssignment({id:1,name:'bad time',due_at:'2026-10-22 12:00:00'},101), {code:'PAGE_CHANGED'});
  assert.throws(() => normalizeAssignment({id:1,course_id:202,name:'wrong course',due_at:null},101), {code:'PAGE_CHANGED'});
  assert.throws(() => normalizeCourse({id:9007199254740993,name:'unsafe numeric id'}), {code:'PAGE_CHANGED'});
  assert.throws(() => normalizeCourse({id:1,title:'changed name field'}), {code:'PAGE_CHANGED'});
});
