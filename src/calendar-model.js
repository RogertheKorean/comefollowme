/* Calendar rules shared by the browser and focused date/filter tests. */
(function(root){
 'use strict';
 const ZONE='Asia/Seoul';
 const ORGANIZATIONS=[['all','전 회원','All members'],['primary','초등회','Primary'],['relief','상호부조회','Relief Society'],['elders','장로 정원회','Elders quorum'],['youth','청소년','Youth'],['sunday-school','주일학교','Sunday School']];
 const ids=new Set(ORGANIZATIONS.map(x=>x[0]));
 function dayKey(value){const parts=new Intl.DateTimeFormat('en',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`;}
 function timeKey(value){return new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));}
 function toISO(date,time){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Invalid date or time');const d=new Date(`${date}T${time}:00+09:00`);if(!Number.isFinite(d.getTime())||dayKey(d)!==date)throw Error('Invalid date');return d.toISOString();}
 function monthRange(year,month){if(!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11)throw Error('Invalid month');const first=new Date(Date.UTC(year,month,1,0)-9*3600000),next=new Date(Date.UTC(year,month+1,1,0)-9*3600000);return {start:first.toISOString(),end:next.toISOString()};}
 function onDay(event,date){const start=new Date(toISO(date,'00:00')).getTime(),end=start+86400000;return new Date(event.starts_at).getTime()<end&&new Date(event.ends_at).getTime()>start;}
 function filterEvents(events,{organizations=[],includeAll=true,query=''}={}){const selected=organizations.filter(x=>ids.has(x)),q=query.trim().toLocaleLowerCase();return events.filter(e=>(!selected.length||e.organizations.some(o=>selected.includes(o))||(includeAll&&e.organizations.includes('all')))&&(!q||`${e.title} ${e.location} ${e.description||''}`.toLocaleLowerCase().includes(q)));}
 function canView(event,canManage){return event.status==='published'||event.status==='cancelled'||!!canManage;}
 function validateDraft(d){const orgs=[...new Set(d.organizations||[])];if(!d.title?.trim()||d.title.trim().length>160)throw Error('title');if(!d.location?.trim()||d.location.trim().length>300)throw Error('location');if(!orgs.length||orgs.some(x=>!ids.has(x)))throw Error('organizations');const starts_at=toISO(d.date,d.start),ends_at=toISO(d.endDate||d.date,d.end);if(ends_at<=starts_at)throw Error('time');if((d.description||'').length>5000)throw Error('description');return {title:d.title.trim(),description:(d.description||'').trim(),starts_at,ends_at,timezone:ZONE,location:d.location.trim(),organizations:orgs};}
 const api={ZONE,ORGANIZATIONS,dayKey,timeKey,toISO,monthRange,onDay,filterEvents,canView,validateDraft};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogetherCalendarModel=api;
})(typeof window!=='undefined'?window:globalThis);
