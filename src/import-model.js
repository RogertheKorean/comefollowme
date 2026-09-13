/* Pure metadata extraction for pasted bilingual lesson Markdown. */
(function(root){
 'use strict';
 const TITLE_LIMIT=160,DATE_LIMIT=100;
 const MONTHS={january:1,jan:1,february:2,feb:2,march:3,mar:3,april:4,apr:4,may:5,june:6,jun:6,july:7,jul:7,august:8,aug:8,september:9,sep:9,october:10,oct:10,november:11,nov:11,december:12,dec:12};

 function text(value){return typeof value==='string'?value:'';}
 function compact(value){return text(value).replace(/\r\n?/g,'\n').replace(/\\([\\`*_{}\[\]()#+.!~:-])/g,'$1').replace(/[~—–]/g,'–').replace(/\s+/g,' ').trim();}
 function cleanMarkdown(value){return compact(text(value).replace(/!?(?:\[([^\]]*)\]\([^)]*\))/g,'$1').replace(/<https?:\/\/[^>]+>/gi,'').replace(/<[^>]*>/g,'').replace(/^[>#\s]+/,'').replace(/[*_`]/g,'')).replace(/^[“"'‘]+|[”"'’]+$/g,'').trim();}
 function limited(value,limit){return text(value).trim().slice(0,limit);}
 function validDate(year,month,day){const d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day;}
 function iso(year,month,day){return validDate(year,month,day)?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:'';}
 function invalidDate(raw,warnings){if(warnings)warnings.add('invalid-date');return raw;}
 function normalizeDate(value,warnings){
  const raw=compact(value).replace(/\s*–\s*/g,'–');
  let m=raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s*(?:\/|–|to)\s*(\d{4})-(\d{2})-(\d{2}))?$/i);
  if(m){const start=iso(+m[1],+m[2],+m[3]),end=m[4]?iso(+m[4],+m[5],+m[6]):'';return start&&(!m[4]||end)&&(!end||start<=end)?(end?`${start}/${end}`:start):invalidDate(raw,warnings);}
  m=raw.match(/^(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일?(?:\s*[–-]\s*(?:(\d{4})\s*년\s*)?(?:(\d{1,2})\s*월\s*)?(\d{1,2})\s*일?)?$/);
  if(m){
   let startYear=m[1]?+m[1]:0,endYear=m[4]?+m[4]:0;const startMonth=+m[2],startDay=+m[3],endMonth=m[5]?+m[5]:startMonth,endDay=m[6]?+m[6]:0;
   if(endDay&&startYear&&!endYear)endYear=endMonth<startMonth?startYear+1:startYear;
   if(endDay&&!startYear&&endYear&&startMonth>endMonth)startYear=endYear-1;
   if(startYear&&(!endDay||endYear)){const start=iso(startYear,startMonth,startDay),end=endDay?iso(endYear,endMonth,endDay):'';if(start&&(!endDay||end)&&(!end||start<=end))return end?`${start}/${end}`:start;return invalidDate(raw,warnings);}
   if((startMonth<1||startMonth>12||startDay<1||startDay>new Date(Date.UTC(2024,startMonth,0)).getUTCDate())||(endDay&&(endMonth<1||endMonth>12||endDay<1||endDay>new Date(Date.UTC(2024,endMonth,0)).getUTCDate())))invalidDate(raw,warnings);
   if(endYear||startYear)return raw;
   return `${startMonth}월 ${startDay}일${endDay?`–${endMonth===startMonth?'':`${endMonth}월 `}${endDay}일`:''}`;
  }
  m=raw.match(/^([A-Za-z.]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?\s*[–-]\s*([A-Za-z.]+)?\s*(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if(m&&MONTHS[m[1].replace('.','').toLowerCase()]&&MONTHS[(m[4]||m[1]).replace('.','').toLowerCase()]){
   const sm=MONTHS[m[1].replace('.','').toLowerCase()],em=MONTHS[(m[4]||m[1]).replace('.','').toLowerCase()];let sy=m[3]?+m[3]:0,ey=m[6]?+m[6]:0;
   if(sy&&!ey)ey=em<sm?sy+1:sy;
   if(!sy&&ey)sy=sm>em?ey-1:ey;
   if(sy&&ey){const start=iso(sy,sm,+m[2]),end=iso(ey,em,+m[5]);if(start&&end&&start<=end)return `${start}/${end}`;return invalidDate(raw,warnings);}
   return `${m[1].replace(/\.$/,'')} ${+m[2]}–${m[4]?`${m[4].replace(/\.$/,'')} `:''}${+m[5]}`;
  }
  m=raw.match(/^([A-Za-z.]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
  if(m&&MONTHS[m[1].replace('.','').toLowerCase()]){const year=m[3]?+m[3]:0,month=MONTHS[m[1].replace('.','').toLowerCase()],result=year&&iso(year,month,+m[2]);return year?(result||invalidDate(raw,warnings)):`${m[1].replace(/\.$/,'')} ${+m[2]}`;}
  return raw;
 }
 function splitFrontmatter(markdown){
  const source=text(markdown),m=source.match(/^\s*---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);if(!m)return {front:{},body:source};
  const front={},parents=[];
  for(const line of m[1].split('\n')){const item=line.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*?)\s*$/);if(!item||item[2]==='---')continue;const depth=Math.floor(item[1].replace(/\t/g,'  ').length/2);parents.length=depth;const key=item[2].toLowerCase(),value=item[3].replace(/^['"]|['"]$/g,'');if(value){front[[...parents,key].join('.')]=value;}else parents[depth]=key;}
  return {front,body:source.slice(m[0].length)};
 }
 function frontValue(front,keys){for(const key of keys){if(front[key]!==undefined)return front[key];}return '';}
 function labeled(lines,pattern){for(const line of lines){const m=cleanMarkdown(line).match(pattern);if(m&&m[1])return m[1];}return '';}
 function datedTitle(lines,warnings){
  for(const line of lines){
   const value=cleanMarkdown(line);let m=value.match(/^(\d{4}-\d{2}-\d{2}(?:\s*(?:\/|–|-)\s*\d{4}-\d{2}-\d{2})?)\s*[:：]\s*(.+)$/);
   if(!m)m=value.match(/^((?:(?:\d{4}\s*년\s*)?\d{1,2}\s*월\s*\d{1,2}\s*일?(?:\s*[–-]\s*(?:(?:\d{4}\s*년\s*)?(?:\d{1,2}\s*월\s*)?\d{1,2}\s*일?)?)?))\s*[:：]\s*(.+)$/);
   if(!m)m=value.match(/^((?:[A-Za-z.]+\s+\d{1,2}(?:,?\s*\d{4})?(?:\s*[–-]\s*(?:[A-Za-z.]+\s*)?\d{1,2}(?:,?\s*\d{4})?)?))\s*:\s*(.+)$/);
   if(m){const date=normalizeDate(m[1],warnings),title=cleanMarkdown(m[2]);if(date&&title)return {date,title};}
  }
  return {date:'',title:''};
 }
 function linkOnlyHeading(raw){const value=raw.replace(/^\s*#\s+/,'').trim();return /\[[^\]]+\]\([^)]*\)/.test(value)&&!value.replace(/\[[^\]]+\]\([^)]*\)/g,'').replace(/[;,.\s]/g,'');}
 function headingTitle(lines){for(const raw of lines){if(!/^\s*#\s+/.test(raw)||linkOnlyHeading(raw))continue;const value=cleanMarkdown(raw);if(value)return value;}return '';}
 function validSource(value){try{const url=new URL(text(value).trim());return url.protocol==='https:'&&!url.username&&!url.password?url.toString():'';}catch{return '';}}
 function firstUrl(value){const match=text(value).match(/https:\/\/[^\s)>\]]+/i);return match?match[0]:'';}
 function labeledSource(lines){for(const line of lines){const m=cleanMarkdown(line).match(/^(?:source(?:\s*url)?|출처|자료\s*주소|(?:공과\s*)?원문\s*(?:url|주소))\s*[:：]\s*(.+)$/i);if(m)return firstUrl(line)||m[1];}return '';}
 function clearLessonManual(lines){
  for(const raw of lines){const url=validSource(firstUrl(raw));if(!url)continue;const parsed=new URL(url),path=parsed.pathname.toLowerCase();
   const standalone=cleanMarkdown(raw)===url||/\b(this|this week'?s) lesson\b|(?:이번|이)\s*공과/i.test(cleanMarkdown(raw));
   const churchHost=parsed.hostname==='churchofjesuschrist.org'||parsed.hostname.endsWith('.churchofjesuschrist.org');
   if(standalone&&churchHost&&/^\/study\/manual\/come-follow-me-[^/]+\/\d+\/?$/.test(path)&&!parsed.searchParams.has('id')&&!parsed.hash)return url;
  }return '';
 }
 function sourceFrom(front,lines,warnings){
  const explicit=frontValue(front,['sourceurl','source_url','source-url','source.url','lesson.sourceurl','lesson.source_url'])||labeledSource(lines);
  if(explicit){const url=validSource(firstUrl(explicit)||explicit);if(url)return url;warnings.add('invalid-source-url');}
  return clearLessonManual(lines);
 }
 function parseLanguage(markdown,language,warnings){
  const parsed=splitFrontmatter(markdown),lines=parsed.body.split('\n'),front=parsed.front;
  const titleKeys=language==='ko'?['title.ko','title_ko','title-korean','korean.title','title']:['title.en','title_en','title-english','english.title','title'];
  const explicitTitle=frontValue(front,titleKeys)||labeled(lines,language==='ko'?/^(?:제목|공과\s*제목)\s*[:：]\s*(.+)$/:/^(?:(?:lesson\s+)?title)\s*[:：]\s*(.+)$/i);
  const explicitDate=frontValue(front,['date','lesson.date','lesson_date','lesson-date','period','lesson.period','lesson_period'])||labeled(lines,/^(?:date|lesson\s*date|날짜|공과\s*(?:날짜|기간)|기간)\s*[:：]\s*(.+)$/i);
  const dated=datedTitle(lines,warnings),title=cleanMarkdown(explicitTitle)||dated.title||headingTitle(lines),date=normalizeDate(explicitDate,warnings)||dated.date;
  return {title:limited(title,TITLE_LIMIT),date:limited(date,DATE_LIMIT),source:sourceFrom(front,lines,warnings)};
 }
 function extractMetadata(input){
  const warnings=new Set(),ko=parseLanguage(input&&input.ko,'ko',warnings),en=parseLanguage(input&&input.en,'en',warnings);
  if(/^\d{4}-\d{2}-\d{2}(?:\/\d{4}-\d{2}-\d{2})?$/.test(ko.date)&&/^\d{4}-\d{2}-\d{2}(?:\/\d{4}-\d{2}-\d{2})?$/.test(en.date)&&ko.date!==en.date)warnings.add('ambiguous-date');
  return {title:{ko:ko.title,en:en.title},date:ko.date||en.date,sourceUrl:ko.source||en.source,warnings:[...warnings]};
 }
 const api={extractMetadata};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogetherImportModel=api;
})(typeof window!=='undefined'?window:globalThis);
