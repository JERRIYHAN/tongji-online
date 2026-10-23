import { CampusError } from '../core/errors.mjs';
import { serviceJson } from '../core/service-http.mjs';
import { id } from './canvas.mjs';

const clean = value => typeof value==='string' ? value.replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500) : null;

export async function verifyEducation(request, credentials) {
  const data = await serviceJson(request,'education','/api/sessionservice/session/getSessionUser',{credentials});
  if (!data?.user || typeof data.user!=='object') throw new CampusError('PAGE_CHANGED');
  return {service:'education',authenticated:true};
}

export function normalizeWeeks(input) {
  let weeks = input;
  if (typeof weeks==='string') {
    if (/^\s*\[/.test(weeks)) { try {weeks=JSON.parse(weeks);} catch {throw new CampusError('PAGE_CHANGED');} }
    else if (/^[01]{10,60}$/.test(weeks)) weeks=[...weeks].flatMap((v,i)=>v==='1'?[i+1]:[]);
    else if (/^\d+(?:\s*[,，]\s*\d+)*$/.test(weeks)) weeks=weeks.split(/[,，]/).map(Number);
    else if (/^\d+\s*-\s*\d+$/.test(weeks)) {
      const [start,end]=weeks.split('-').map(Number);
      if (end<start || end-start>59) throw new CampusError('PAGE_CHANGED');
      weeks=Array.from({length:end-start+1},(_,i)=>start+i);
    }
  }
  if (!Array.isArray(weeks) || weeks.some(w=>!Number.isInteger(Number(w))||Number(w)<1||Number(w)>60)) throw new CampusError('PAGE_CHANGED');
  return [...new Set(weeks.map(Number))].sort((a,b)=>a-b);
}

export function normalizeMeeting(row) {
  const weekday=Number(row?.dayOfWeek),start=Number(row?.timeStart),end=Number(row?.timeEnd);
  if (!Number.isInteger(weekday)||weekday<1||weekday>7||!Number.isInteger(start)||start<1||start>30||!Number.isInteger(end)||end<start||end>30) throw new CampusError('PAGE_CHANGED');
  return {weekday,periodStart:start,periodEnd:end,weeks:normalizeWeeks(row.weeks),
    teacher:clean(row.teacherName),room:clean(row.roomIdI18n)||clean(row.roomLable),
    campus:clean(row.campusI18n)};
}

export function normalizeTimetable(rows, options={}) {
  if (!Array.isArray(rows)) throw new CampusError('PAGE_CHANGED');
  return rows.map(row=>{
    const name=clean(row?.courseName);
    if (!name || (row.timeTableList!=null&&!Array.isArray(row.timeTableList))) throw new CampusError('PAGE_CHANGED');
    const meetings=(row.timeTableList??[]).map(normalizeMeeting).filter(m=>(!options.week||m.weeks.includes(options.week))&&(!options.weekday||m.weekday===options.weekday));
    return {name,courseCode:clean(row.courseCode),classCode:clean(row.classCode),campus:clean(row.campusI18n),
      unscheduled:!row.timeTableList?.length,meetings};
  }).filter(c=>!options.week&&!options.weekday||c.meetings.length>0);
}

export async function timetable(request, credentials, options={}) {
  await verifyEducation(request,credentials);
  const current=await serviceJson(request,'education','/api/baseresservice/schoolCalendar/currentTermCalendar',{credentials,params:{flag:0}});
  const calendar=current?.schoolCalendar;
  if (!calendar || !calendar.id) throw new CampusError('PAGE_CHANGED');
  const calendarId=options.term?id(options.term):id(calendar.id);
  const rows=await serviceJson(request,'education','/api/electionservice/reportManagement/findStudentTimetab',{credentials,params:{calendarId}});
  return {service:'education',calendarId,termName:options.term?null:clean(calendar.name??calendar.calendarName),
    week:options.week??null,weekday:options.weekday??null,periodUnit:'教学节次（不是小时）',
    courses:normalizeTimetable(rows,options),url:'https://1.tongji.edu.cn/#/studentTimeTable'};
}
