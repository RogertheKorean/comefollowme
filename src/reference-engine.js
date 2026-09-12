/* Shared, dependency-free reference resolver. Runs in browsers and Node tests.
 * It classifies and links registered content; it does NOT fetch or scrape sites.
 */
(function (global) {
 'use strict';
 const CHURCH = 'https://www.churchofjesuschrist.org';
 const HOSTS = new Set(['www.churchofjesuschrist.org','churchofjesuschrist.org','www.lds.org','lds.org']);
 function cleanURL(value, base=CHURCH) {
  if (typeof value !== 'string' || value.length>4096 || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
   const v=value.trim().replace(/\\&/g,'&').replace(/&amp;|&#0*38;|&#x0*26;/gi,'&');
   if (!v) return null;
   const u=new URL(v,base);
   if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;
   if(HOSTS.has(u.hostname)){u.protocol='https:';u.hostname='www.churchofjesuschrist.org';u.port='';}
   return u;
  }catch{return null;}
 }
 function fingerprint(text) { // Deterministic content version, not a security signature.
  let h=0xcbf29ce484222325n;
  for(const ch of String(text)){h^=BigInt(ch.codePointAt(0));h=BigInt.asUintN(64,h*0x100000001b3n);}
  return h.toString(16).padStart(16,'0');
 }
 function targetSpec(value) {
  const result={ids:[],ranges:[],invalid:false};
  if(!value)return result;
  for(const raw of value.split(',')){
   const s=raw.trim();
   const numeric=s.match(/^p(\d+)(?:-p?(\d+))?$/);
   if(numeric){const a=+numeric[1],b=+(numeric[2]||a);if(a<1||b<a||b>500||b-a>200){result.invalid=true;continue;}for(let n=a;n<=b;n++)result.ids.push('p'+n);continue;}
   // Opaque paragraph IDs are ordered by the registered document, NOT alphabetically.
   const opaque=s.match(/^(p_[A-Za-z0-9]+)-(p_[A-Za-z0-9]+)$/);
   if(opaque){result.ranges.push([opaque[1],opaque[2]]);continue;}
   if(/^[A-Za-z][A-Za-z0-9_-]{0,100}$/.test(s)){result.ids.push(s);continue;}
   result.invalid=true;
  }
  result.ids=[...new Set(result.ids)];return result;
 }
 function parse(url,label='',base=CHURCH) {
  const u=cleanURL(url,base);if(!u)return null;
  const church=u.hostname==='www.churchofjesuschrist.org';
  const path=u.pathname.replace(/\/+$/,'')||'/';
  const sm=church&&path.match(/^\/study\/scriptures\/([^/]+)\/([^/]+)\/(\d+)$/);
  let kind='article',key=church?path:u.origin+path+u.search;
  if(sm){kind='scripture';key=sm.slice(1).join('/');}
  else if(church&&path.startsWith('/study/general-conference/'))kind='conference';
  else if(church&&path.startsWith('/study/manual/'))kind='manual';
  else if(church&&/^\/study\/magazines\/[^/]+$/.test(path))kind='collection';
  else if(/\.pdf$/i.test(path))kind='pdf';
  else if(/\.(png|jpe?g|webp|gif)$/i.test(path)||path.startsWith('/imgs/'))kind='image';
  const lang=u.searchParams.get('lang');
  let fragment='';try{fragment=decodeURIComponent(u.hash.slice(1));}catch{fragment=u.hash.slice(1);}
  const targets=targetSpec(u.searchParams.get('id')||fragment);
  const chapter=sm?+sm[3]:null;
  let chapters=chapter?[chapter]:[];
  if(chapter&&!targets.ids.length&&!targets.ranges.length&&!label.includes(':')){
   const m=label.replace(/\\/g,'').match(/(\d+)\s*[~∼–−-]\s*(\d+)/);
   if(m&&+m[1]===chapter&&+m[2]>=chapter&&+m[2]-chapter<=30)chapters=Array.from({length:+m[2]-chapter+1},(_,i)=>chapter+i);
  }
  const canonical=new URL(u.href);canonical.hash='';
  if(church){canonical.search='';} // Church content identity excludes position and language.
  return {key,kind,label:String(label).replace(/\*\*/g,'').replace(/\\([~&])/g,'$1'),sourceURL:u.href,canonicalURL:canonical.href,language:lang==='eng'?'en':lang==='kor'?'ko':null,targets,chapter,chapters,verses:kind==='scripture'?targets.ids.filter(id=>/^p\d+$/.test(id)).map(id=>+id.slice(1)):[]};
 }
 function resolveTargets(targets,blocks) {
  const ordered=blocks.map(b=>b.id),ids=[...targets.ids],missing=[];
  for(const [from,to]of targets.ranges){const a=ordered.indexOf(from),b=ordered.indexOf(to);if(a<0||b<a){missing.push(from+'–'+to);}else ids.push(...ordered.slice(a,b+1));}
  const unique=[...new Set(ids)];for(const id of unique)if(!ordered.includes(id))missing.push(id);
  return {ids:unique.filter(id=>ordered.includes(id)),missing,invalid:targets.invalid};
 }
 function extractLinks(md,base=CHURCH) {
  const text=String(md||''),out=[];let i=0;
  // Balanced labels/URLs allow escaped punctuation, nested brackets and URL parentheses.
  while(i<text.length){
   if(text[i]!=='['||text[i-1]==='\\'){i++;continue;}
   const start=i;let j=i+1,depth=1;
   for(;j<text.length&&depth;j++){if(text[j]==='\\'){j++;continue;}if(text[j]==='[')depth++;if(text[j]===']')depth--;}
   if(depth||text[j]!=='('){i++;continue;}
   const label=text.slice(i+1,j-1);let k=j+1,p=1;
   for(;k<text.length&&p;k++){if(text[k]==='\\'&&text[k+1]!=='&'){k++;continue;}if(text[k]==='(')p++;if(text[k]===')')p--;}
   if(p){i++;continue;}
   const raw=text.slice(j+1,k-1).trim().replace(/^<|>$/g,'');
   const ref=parse(raw,label,base);if(ref)out.push({...ref,start,end:k});
   i=k;
  }
  // Autolinks and bare http(s) addresses, without double-counting Markdown links.
  const re=/https?:\/\/[^\s<>"']+/g;let m;
  while((m=re.exec(text))){if(out.some(l=>m.index>=l.start&&m.index<l.end))continue;const raw=m[0].replace(/[).,;]+$/,'');const ref=parse(raw,raw,base);if(ref)out.push({...ref,start:m.index,end:m.index+raw.length});}
  return out.sort((a,b)=>a.start-b.start);
 }
 function validateDocument(doc) {
  if(!doc||typeof doc!=='object')throw Error('Invalid reference document.');
  const parsed=parse(doc.url,doc.title);if(!parsed)throw Error('A valid http(s) source URL is required.');
  if(typeof doc.title!=='string'||!doc.title.trim()||doc.title.length>500)throw Error('A title of 1–500 characters is required.');
  if(!['ko','en'].includes(doc.language))throw Error('Language must be ko or en.');
  if(!['full','excerpt','summary'].includes(doc.coverage))throw Error('Coverage must be full, excerpt or summary.');
  if(!Array.isArray(doc.blocks)||!doc.blocks.length||doc.blocks.length>2000)throw Error('Include 1–2,000 text blocks.');
  const seen=new Set();let count=0;
  const blocks=doc.blocks.map(b=>{
   if(!b||!/^([A-Za-z][A-Za-z0-9_-]{0,100})$/.test(b.id)||seen.has(b.id))throw Error('Block IDs must be safe and unique.');
   if(typeof b.markdown!=='string'||!b.markdown.trim()||b.markdown.length>30000)throw Error('Each block needs 1–30,000 characters.');
   seen.add(b.id);count+=b.markdown.length;
   return {id:b.id,markdown:b.markdown,type:b.type==='heading'?'heading':'paragraph',sourceId:b.sourceId===true};
  });
  if(count>500000)throw Error('A reference language version is limited to 500,000 characters.');
  const v={key:parsed.key,kind:parsed.kind,url:parsed.canonicalURL,title:doc.title.trim(),author:String(doc.author||'').slice(0,300),date:String(doc.date||'').slice(0,80),language:doc.language,coverage:doc.coverage,edition:String(doc.edition||'사용자 등록 자료 / User supplied').slice(0,200),provenance:String(doc.provenance||'User supplied; independently verify text and permissions.').slice(0,1500),blocks};
  v.revision=fingerprint(JSON.stringify(v));return v;
 }
 function validateLesson(l) {
  const id=v=>typeof v==='string'&&/^[-\w]{1,100}$/.test(v);
  const txt=(v,max=1000)=>typeof v==='string'&&v.length<=max;
  if(!l||!id(l.id)||!id(l.version)||!txt(l.title?.ko,500)||!l.title.ko.trim()||!txt(l.title.en||'',500)||!cleanURL(l.sourceUrl?.ko)||!Array.isArray(l.blocks)||!l.blocks.length||l.blocks.length>2000||!Array.isArray(l.sections)||!l.sections.length||l.sections.length>200)throw Error('Invalid lesson content.');
  const sectionIds=new Set();const sections=l.sections.map(s=>{if(!id(s.id)||sectionIds.has(s.id)||!txt(s.ko)||!txt(s.en||''))throw Error('Invalid lesson section.');sectionIds.add(s.id);return {id:s.id,ko:s.ko,en:s.en||''};});
  const ids=new Set();let total=0;const kinds=new Set(['text','media','title','references','credit','heading','quote']);
  const blocks=l.blocks.map(b=>{if(!id(b.id)||ids.has(b.id)||!sectionIds.has(b.sectionId)||!txt(b.ko,100000)||!txt(b.en||'',100000)||!kinds.has(b.kind))throw Error('Invalid lesson paragraph.');ids.add(b.id);total+=b.ko.length+(b.en||'').length;return {id:b.id,sectionId:b.sectionId,conceptId:typeof b.conceptId==='string'?b.conceptId.slice(0,250):l.id+'-'+b.id,kind:b.kind,ko:b.ko,en:b.en||''};});
  if(total>800000)throw Error('Lesson text exceeds 800,000 characters.');
  const sourceKO=cleanURL(l.sourceUrl.ko),sourceEN=l.sourceUrl.en?cleanURL(l.sourceUrl.en):null;if(l.sourceUrl.en&&!sourceEN)throw Error('Invalid English source URL.');
  if(!txt(l.date?.ko||'',200)||!txt(l.date?.en||'',200)||!txt(l.raw?.ko||'',400000)||!txt(l.raw?.en||'',400000))throw Error('Invalid lesson metadata.');
  // Whitelist fields. A content pack must never carry hidden journal fields in a lesson.
  return {id:l.id,version:l.version,title:{ko:l.title.ko,en:l.title.en||''},date:{ko:l.date?.ko||'',en:l.date?.en||''},sourceUrl:{ko:sourceKO.href,en:sourceEN?.href||''},sourceLabel:String(l.sourceLabel||'User supplied').slice(0,200),translationStatus:String(l.translationStatus||'user-provided-unverified').slice(0,120),alignment:String(l.alignment||'korean-only').slice(0,120),raw:{ko:l.raw?.ko||blocks.map(b=>b.ko).join('\n\n'),en:l.raw?.en||blocks.map(b=>b.en).join('\n\n')},sections,blocks};
 }
 const api={CHURCH,cleanURL,parse,targetSpec,resolveTargets,extractLinks,fingerprint,validateDocument,validateLesson};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;global.ReferenceEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
