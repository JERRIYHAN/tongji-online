import { CampusError } from '../core/errors.mjs';
import { CANVAS, getList, verifyCanvas } from '../core/canvas-http.mjs';

export function id(value) {
  const s = String(value);
  if (!/^[1-9]\d{0,19}$/.test(s) || (typeof value === 'number' && !Number.isSafeInteger(value))) throw new CampusError('PAGE_CHANGED');
  return s;
}

function text(value) {
  if (typeof value !== 'string' || !value.trim()) throw new CampusError('PAGE_CHANGED');
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
}

export function normalizeCourse(raw) {
  if (!raw || typeof raw !== 'object') throw new CampusError('PAGE_CHANGED');
  const courseId = id(raw.id);
  return {
    id: courseId, name: text(raw.name),
    code: typeof raw.course_code === 'string' ? text(raw.course_code) : null,
    term: typeof raw.term?.name === 'string' ? text(raw.term.name) : null,
    url: `${CANVAS}/courses/${courseId}`
  };
}

export function shanghaiTime(iso) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date(iso)).replace(' ', 'T') + '+08:00';
}

export function normalizeAssignment(raw, courseId) {
  if (!raw || typeof raw !== 'object' || !Object.hasOwn(raw, 'due_at')) throw new CampusError('PAGE_CHANGED');
  if (raw.course_id !== undefined && id(raw.course_id) !== id(courseId)) throw new CampusError('PAGE_CHANGED');
  const assignmentId = id(raw.id);
  let dueAt = null;
  if (raw.due_at !== null) {
    // Require a timezone; never guess how to interpret a timezone-free server timestamp.
    if (typeof raw.due_at !== 'string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(raw.due_at) || !Number.isFinite(Date.parse(raw.due_at))) {
      throw new CampusError('PAGE_CHANGED');
    }
    dueAt = new Date(raw.due_at).toISOString();
  }
  const state = raw.submission?.workflow_state;
  const known = ['unsubmitted', 'submitted', 'pending_review', 'graded'];
  return {
    id: assignmentId, courseId: id(courseId), name: text(raw.name), dueAt,
    dueAtShanghai: dueAt ? shanghaiTime(dueAt) : null,
    submitted: known.includes(state) ? state !== 'unsubmitted' : null,
    url: `${CANVAS}/courses/${id(courseId)}/assignments/${assignmentId}`
  };
}

function unique(items) {
  const ids = new Set();
  return items.filter(item => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
}

export async function courses(request) {
  await verifyCanvas(request);
  const rows = await getList(request, '/api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=term&per_page=100');
  return { service: 'canvas', scope: 'active-student-enrollments', courses: unique(rows.map(normalizeCourse)) };
}

export async function assignments(request, courseId) {
  const course = id(courseId);
  const rows = await getList(request, `/api/v1/courses/${course}/assignments?per_page=100&include[]=submission&override_assignment_dates=true`);
  const normalized = unique(rows.map(row => normalizeAssignment(row, course)));
  normalized.sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999') || a.id.localeCompare(b.id));
  return { service: 'canvas', courseId: course, timeZone: 'Asia/Shanghai', assignments: normalized };
}

export async function upcoming(request, days = 7, now = new Date()) {
  const start = now.getTime();
  const end = start + days * 86_400_000;
  const enrolled = await courses(request);
  if (enrolled.courses.length > 30) throw new CampusError('RESULT_TOO_LARGE');
  const items = [];
  let undatedCount = 0;
  // Sequential, bounded reads. A failed course fails the whole operation: no misleading partial list.
  for (const course of enrolled.courses) {
    const data = await assignments(request, course.id);
    for (const assignment of data.assignments) {
      if (assignment.dueAt === null) { undatedCount++; continue; }
      const due = Date.parse(assignment.dueAt);
      if (due >= start && due < end) items.push({ ...assignment, courseName: course.name });
    }
  }
  items.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.courseId.localeCompare(b.courseId));
  return {
    service: 'canvas', timeZone: 'Asia/Shanghai', from: now.toISOString(), untilExclusive: new Date(end).toISOString(),
    scannedCourses: enrolled.courses.length, undatedCount, assignments: items
  };
}
