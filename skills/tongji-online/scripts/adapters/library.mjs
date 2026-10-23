import { CampusError } from '../core/errors.mjs';
import { serviceJson } from '../core/service-http.mjs';
import { id } from './canvas.mjs';

const BASE = 'https://webpac.tongji.edu.cn/s12/';
const clean = value => typeof value === 'string' ? value.replace(/<[^>]*>/g,'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,1200) : null;
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;

export function normalizeBook(row) {
  if (!row || !clean(row.title)) throw new CampusError('PAGE_CHANGED');
  return { id:id(row.recordId), title:clean(row.title), author:clean(row.author), publisher:clean(row.publisher),
    year:clean(row.publishYear), isbn:clean(row.isbn), callNumbers:Array.isArray(row.callNo)?row.callNo.map(clean).filter(Boolean):[],
    physicalCopies:count(row.physicalCount), onShelfCount:count(row.onShelfCountI),
    url:`${BASE}#/searchList/bookDetails/${id(row.recordId)}/${id(row.docCode ?? 1)}` };
}

export async function search(request, query, { field='keyword', page=1, limit=10 } = {}) {
  const fields = {keyword:'keyWord',title:'title',author:'author',isbn:'isbn'};
  if (!fields[field] || typeof query !== 'string' || !query.trim() || query.length > 200) throw new CampusError('INVALID_ARGUMENT');
  const data = await serviceJson(request,'library','/find/unify/search',{method:'POST',data:{
    searchField:fields[field],searchFieldContent:query.trim(),matchMode:'2',docCode:[null],
    page,rows:limit,sortField:'relevance',sortClause:'asc'
  }});
  if (!Array.isArray(data?.searchResult) || count(data.numFound) === null) throw new CampusError('PAGE_CHANGED');
  return {service:'library',query,field,page,limit,total:data.numFound,hasMore:page*limit<data.numFound,
    books:data.searchResult.map(normalizeBook), availabilityNote:'上架数来自检索索引，具体状态请查询单册馆藏。'};
}

export function normalizeHolding(row) {
  if (!row || !clean(row.callNo) || !clean(row.processType)) throw new CampusError('PAGE_CHANGED');
  return {callNumber:clean(row.callNo),location:clean(row.locationName),currentLocation:clean(row.curLocationName),
    floor:clean(row.locationAddress),status:clean(row.processType)};
}

export async function item(request, recordId) {
  const record = id(recordId);
  const detail = await serviceJson(request,'library','/find/searchResultDetail/getBookDetail',{params:{recordId:record}});
  if (!Array.isArray(detail?.bean2List)) throw new CampusError('PAGE_CHANGED');
  const holdingPage = await serviceJson(request,'library','/find/physical/groupitems',{
    method:'POST',data:{recordId:record,entrance:null,isUnify:true,page:1,rows:100,year:null,processType:null,locationId:null}
  });
  const holdings=Array.isArray(holdingPage)?holdingPage:holdingPage?.list;
  if (!Array.isArray(holdings)) throw new CampusError('PAGE_CHANGED');
  if (holdings.length >= 100 || (Number.isFinite(holdingPage?.totalCount)&&holdingPage.totalCount>holdings.length)) throw new CampusError('RESULT_TOO_LARGE');
  // Detail responses omit docCode, which the site's deep link requires. Do not invent it.
  return {service:'library',id:record,url:BASE,
    details:detail.bean2List.filter(r=>['cnb01','cnb03','cnb04','cnb10','cnb14','cnb48','cnb62','cnb67','cnb71','cnb74','cnb96'].includes(r.key))
      .map(r=>({label:clean(r.description),value:clean(r.fieldVal)})),holdings:holdings.map(normalizeHolding)};
}

export async function verifyLibrary(request, credentials) {
  if (!credentials?.jwt) throw new CampusError('LOGIN_REQUIRED');
  const data = await serviceJson(request,'library','/oga/userinfo',{credentials});
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) throw new CampusError('PAGE_CHANGED');
  return {service:'library',authenticated:true};
}

export function normalizeLoan(row) {
  const title = clean(row.title ?? row.bookName);
  const due = clean(row.normReturnDate ?? row.dueDate);
  if (!title || !due) throw new CampusError('PAGE_CHANGED');
  return {title,dueDate:due,borrowDate:clean(row.loanDate ?? row.lendDate),callNumber:clean(row.callNo),location:clean(row.locationName ?? row.libName)};
}

export async function loans(request, credentials) {
  await verifyLibrary(request,credentials);
  const data = await serviceJson(request,'library','/find/loanInfo/loanList',{method:'POST',credentials,data:{page:1,rows:100,searchType:1,searchContent:'',sortType:0,startDate:null,endDate:null}});
  const list = data?.searchResult;
  if (!Array.isArray(list) || count(data.numFound)===null) throw new CampusError('PAGE_CHANGED');
  if (list.length >= 100 || data.numFound>list.length) throw new CampusError('RESULT_TOO_LARGE');
  return {service:'library',loans:list.map(normalizeLoan)};
}
