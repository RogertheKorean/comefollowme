/* Content setup, import/export, universal in-app link routing. No network fetches. */
'use strict';
let libraryFilter='all',libraryQuery='',registerPreview=null,registerPrefill=null;
const renderBeforeLibrary=render,navBeforeLibrary=navEntries,previewBeforeAudit=previewImport;
navEntries=function(){const a=navBeforeLibrary();return [...a,["library","link",E('참조자료 관리','Reference library')]];};
function internalizeLinks(root=document){
 for(const a of $$('a[href]',root)){
  if(a.hasAttribute('download')||a.dataset.explicitExternal==='true')continue;
  const raw=a.dataset.refUrl||a.getAttribute('href');if(!raw||raw.startsWith('blob:')||raw.startsWith('data:'))continue;
  if(!a.dataset.refUrl&&!/^https?:|^\/study\//.test(raw))continue;
  const u=RE.cleanURL(raw);if(!u)continue;a.dataset.refUrl=u.href;a.setAttribute('href','#reference');a.removeAttribute('target');a.title=E('이 화면 옆에서 읽기','Read in the side panel');
 }
}
function auditLinks(raw,base){
 const rawLinks=RE.extractLinks(raw,base),map=new Map();
 for(const r of rawLinks){
  const language=r.language||lang();const expanded=r.kind==='scripture'&&r.chapters.length>1?r.chapters.map(ch=>({...r,key:r.key.split('/').slice(0,2).join('/')+'/'+ch,sourceURL:referenceURL(r.key.split('/').slice(0,2).join('/')+'/'+ch,[],language),chapter:ch,chapters:[ch],label:refBookName(r.key,language)+' '+ch,targets:{ids:[],ranges:[],invalid:false},verses:[]})):[r];
  for(const link of expanded){
   const id=link.key;if(!map.has(id))map.set(id,{key:id,kind:link.kind,parsed:link,labels:[],links:[],count:0});
   const item=map.get(id);item.count++;item.links.push({...link,language});if(!item.labels.includes(link.label))item.labels.push(link.label);
  }
 }
 return [...map.values()].map(item=>{const statuses={};for(const language of ['ko','en']){const b=recordFor(item.key,language);const matches=item.links.filter(l=>l.language===language);let missing=[];if(b)for(const r of matches){const result=RE.resolveTargets(r.targets,Object.values(b.rows));missing.push(...result.missing);if(result.invalid)missing.push('invalid-selector');}statuses[language]={coverage:b?.coverage||'missing',missing:[...new Set(missing)],title:b?.title||item.labels[0],registered:!!b};}return {...item,statuses};});
}
function currentAudit(){const l=currentLesson();return auditLinks([l.raw?.ko||l.blocks.map(b=>b.ko).join('\n\n'),l.raw?.en||l.blocks.map(b=>b.en||'').join('\n\n')].join('\n\n'),l.sourceUrl[lang()]);}
function languageStatus(s,label){return `<span class="audit-lang"><b>${label}</b><span class="ref-status ${s.coverage}">${coverageName(s.coverage)}${s.missing.length?' · '+E('일부 위치 미확인','positions missing'):''}</span></span>`;}
function auditTable(items,{compact=false}={}){
 if(!items.length)return `<div class="empty-state"><h3>${E('참조 링크가 없습니다.','No reference links.')}</h3><p>${E('Markdown 링크를 넣으면 이곳에 나타납니다.','Add Markdown links to see them here.')}</p></div>`;
 return `<div class="audit-list">${items.map(r=>`<article class="audit-row" data-audit-key="${esc(r.key)}"><div class="audit-type-icon">${icon(r.kind==='image'?'image':r.kind==='pdf'?'note':r.kind==='conference'?'chat':'book')}</div><div class="audit-main"><div class="audit-kicker">${typeName(r.kind)} · ${r.count} ${E('회 참조','links')}</div><strong>${esc(r.statuses[lang()].title)}</strong><small>${esc(r.key)}</small><div class="audit-languages">${languageStatus(r.statuses.ko,'KO')}${languageStatus(r.statuses.en,'EN')}</div></div><div class="audit-actions"><button class="btn sm" data-v3="open-reference" data-url="${esc(r.parsed.sourceURL)}" data-label="${esc(r.labels[0])}">${icon('split','small')}${E('읽기','Read')}</button><button class="text-btn" data-v3="register-url" data-url="${esc(r.parsed.sourceURL)}" data-label="${esc(r.statuses[lang()].title)}">${E('본문 넣기','Add text')}</button></div></article>`).join('')}</div>`;
}
function libraryHTML(){
 const all=currentAudit();const items=all.filter(r=>(libraryFilter==='all'||(libraryFilter==='attention'?['ko','en'].some(l=>r.statuses[l].coverage==='missing'||r.statuses[l].missing.length):r.kind===libraryFilter))&&(!libraryQuery||[r.key,...r.labels,r.statuses.ko.title,r.statuses.en.title].join(' ').toLowerCase().includes(libraryQuery.toLowerCase())));
 const stats={full:all.filter(r=>r.statuses[lang()].coverage==='full').length,excerpt:all.filter(r=>r.statuses[lang()].coverage==='excerpt').length,summary:all.filter(r=>r.statuses[lang()].coverage==='summary').length,missing:all.filter(r=>r.statuses[lang()].coverage==='missing').length};
 return `<main class="workspace library-workspace"><div class="library-intro">${pageIntro(E('링크는 자동으로. 읽기는 한곳에서.','Linked automatically. Read together.'),E('공과에 있는 주소를 분석하고, 등록된 본문과 연결합니다.','Lesson links are matched with text in your reference library.'),`<button class="btn primary" data-v3="register-new">${icon('plus')}${E('참조 본문 등록','Register reference')}</button>`)}</div><div class="library-summary"><div><span>${E('이 공과의 참조자료','Lesson references')}</span><strong>${all.length}</strong></div><div><span>${E('전문','Full text')}</span><strong>${stats.full}</strong></div><div><span>${E('발췌','Excerpts')}</span><strong>${stats.excerpt}</strong></div><div><span>${E('학습 요약','Summaries')}</span><strong>${stats.summary}</strong></div><div><span>${E('본문 필요','Needs text')}</span><strong>${stats.missing}</strong></div></div><div class="library-steps"><span>01 ${E('공과의 링크 추출','Extract links')}</span>${icon('chevron','small')}<span>02 ${E('주소·언어·위치 확인','Identify source and position')}</span>${icon('chevron','small')}<span>03 ${E('등록 본문 연결','Match registered text')}</span>${icon('chevron','small')}<span>04 ${E('옆에서 읽기','Read in the panel')}</span></div><div class="library-notice">${icon('info')}<div><strong>${E('자동 연결 ≠ 외부 본문 자동 수집','Automatic linking ≠ automatic downloading')}</strong><p>${E('연차대회 4편은 시연용 요약입니다. 사용할 수 있는 전문을 등록하면 같은 링크가 해당 본문을 엽니다. 부족한 본문과 위치는 숨기지 않습니다.','Four talks use labeled demo summaries. Register permitted full text to have the same links open it. Missing text and positions remain visible.')}</p></div></div><div class="library-toolbar"><div class="library-tabs">${[['all',E('전체','All')],['conference',E('연차대회','Talks')],['scripture',E('성구','Scriptures')],['manual',E('교재','Manuals')],['attention',E('준비 필요','Needs attention')]].map(([v,t])=>`<button data-v3="library-filter" data-filter="${v}" class="${libraryFilter===v?'active':''}">${t}</button>`).join('')}</div><label class="library-search">${icon('search','small')}<input id="librarySearch" value="${esc(libraryQuery)}" placeholder="${E('자료 검색','Search references')}" aria-label="${E('참조자료 검색','Search references')}"></label></div><div id="libraryResults">${auditTable(items)}</div><section class="content-pack-panel"><div><h2>${E('다른 기기에도 같은 본문을 보여 주려면','Make the same content available on every device')}</h2><p>${E('이 화면에서 넣은 본문은 현재 브라우저에만 저장됩니다. 콘텐츠 팩을 내보내 ZIP 안의 content/deployment-content.json을 교체한 뒤 GitHub에 올리세요. Vercel이 빌드할 때 포함합니다.','Browser imports are local. Export a content pack, replace content/deployment-content.json in your repository, and push to GitHub. The next build bundles it for every reader.')}</p><small>${E('콘텐츠 팩에는 개인 기록·댓글·캡처·형광펜이 포함되지 않습니다.','Content packs exclude personal notes, replies, captures and highlights.')}</small></div><div class="buttons"><button class="btn" data-v3="export-content">${icon('download')}${E('콘텐츠 팩 내보내기','Export content pack')}</button><label class="btn file-button">${icon('upload')}${E('팩 불러오기','Import pack')}<input id="contentPackFile" type="file" accept=".json,application/json" hidden></label></div></section></main>`;
}
function addReaderLaunch(){
 const host=$('.flow-strip');if(!host||$('.v3-launch'))return;
 host.insertAdjacentHTML('afterend',`<section class="v3-launch"><div><span class="eyebrow">LINKED READING · v3</span><strong>${E('연차대회 말씀도, 읽던 자리에서.','Conference messages, without losing your place.')}</strong><p>${E('옆에서 읽고 · 문장을 표시하고 · 생각을 나누세요.','Read beside the lesson. Highlight a thought. Share an insight.')}</p></div><div class="buttons"><button class="btn primary" data-v3="demo-talk">${icon('split')}${E('연차대회 패널 체험','Try a conference reference')}</button><button class="btn" data-v3="library">${icon('link')}${E('연결 상태 보기','Review linked content')}</button></div></section>`);
}
render=function(){renderBeforeLibrary();internalizeLinks();if(state.view==='library')$('#floatingHint').hidden=true;};
previewImport=function(){previewBeforeAudit();if(!importPreview)return;const items=auditLinks($('#importKO').value+'\n\n'+$('#importEN').value,$('#importURL').value);$('#importPreview').insertAdjacentHTML('afterbegin',`<section class="import-audit"><h3>${E('자동으로 찾은 참조자료','Automatically discovered references')} <span class="pill">${items.length}</span></h3><p>${E('공과를 적용하기 전 본문·언어·정확한 위치의 준비 상태를 확인하세요.','Check text, language and exact positions before applying the lesson.')}</p>${auditTable(items,{compact:true})}</section>`);internalizeLinks($('#importPreview'));};
function parseReferenceText(text,format='markdown'){
 if(typeof text!=='string'||text.length>600000)throw Error(E('600,000자 이하의 본문을 넣어 주세요.','Limit the input to 600,000 characters.'));
 let chunks=[];
 if(format==='html'){
  const doc=new DOMParser().parseFromString(text,'text/html');doc.querySelectorAll('script,style,iframe,object,embed,form,input,button,svg,link,meta,base,template,noscript,img,video,audio,source').forEach(el=>el.remove());
  function toText(node){if(node.nodeType===Node.TEXT_NODE)return node.textContent;if(node.nodeType!==Node.ELEMENT_NODE)return '';if(node.tagName==='BR')return '\n';const inner=[...node.childNodes].map(toText).join('');if(node.tagName==='A'){const u=RE.cleanURL(node.getAttribute('href')||'', $('#refURL')?.value||RE.CHURCH);return u?'['+inner+']('+u.href+')':inner;}return inner;}
  const candidates=[...doc.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,[data-aid][id]')].filter(el=>!el.querySelector('p,li,h1,h2,h3,h4,blockquote'));
  chunks=(candidates.length?candidates:[doc.body]).map(el=>({id:el.id||null,text:toText(el).trim(),type:/^H[1-4]$/.test(el.tagName)?'heading':'paragraph'})).filter(b=>b.text);
 }else{
  chunks=text.replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(raw=>{
   let id=null;let value=raw.trim();const marker=value.match(/^(?:<!--\s*anchor:([A-Za-z][\w-]*)\s*-->|\{#([A-Za-z][\w-]*)\})\s*/);
   if(marker){id=marker[1]||marker[2];value=value.slice(marker[0].length);}
   const type=/^#{1,6}\s/.test(value)?'heading':'paragraph';value=value.replace(/^#{1,6}\s/,'');return {id,text:value.trim(),type};
  }).filter(b=>b.text);
 }
 const ids=new Set();return chunks.map((b,i)=>{const id=b.id||'local-'+RE.fingerprint(b.text).slice(0,10)+'-'+(i+1);if(ids.has(id))throw Error(E('문단 ID가 중복됩니다: ','Duplicate paragraph ID: ')+id);ids.add(id);return {id,markdown:b.text,type:b.type,sourceId:!!b.id};});
}
function showRegister(url='',title='',language=reference.open?reference.language:lang()){
 registerPreview=null;registerPrefill={url,title,language};const p=url?RE.parse(url,title):null,b=p?recordFor(p.key,language):null;
 showModal(modalHead(E('참조 본문을 연결하세요','Connect a reference text'),E('주소는 그대로, 읽을 본문은 이 공간에.','Keep the URL. Add the text to this reading space.'))+`<div class="modal-body reference-register"><div class="fields-two"><label class="field"><span>${E('원본 주소','Source URL')}</span><input id="refURL" type="url" value="${esc(url)}" placeholder="https://www.churchofjesuschrist.org/study/…" maxlength="4096"></label><label class="field"><span>${E('자료 제목','Reference title')}</span><input id="refTitle" value="${esc(b?.title||title)}" maxlength="500"></label></div><div class="fields-two"><label class="field"><span>${E('저자 / 연사','Author / speaker')}</span><input id="refAuthor" value="${esc(b?.author||'')}" maxlength="300"></label><label class="field"><span>${E('본문 언어','Text language')}</span><select id="refLanguage"><option value="ko" ${language==='ko'?'selected':''}>한국어</option><option value="en" ${language==='en'?'selected':''}>English</option></select></label></div><div class="fields-two"><label class="field"><span>${E('수록 범위','Included content')}</span><select id="refCoverage"><option value="full">${E('전문 — 전체 본문을 등록하는 경우','Full text — the entire document')}</option><option value="excerpt">${E('발췌 — 일부만 등록하는 경우','Excerpt — only part of the source')}</option><option value="summary">${E('학습 요약 — 원문이 아닌 경우','Study summary — not the original text')}</option></select></label><label class="field"><span>${E('입력 형식','Input format')}</span><select id="refFormat"><option value="markdown">Markdown / ${E('일반 텍스트','plain text')}</option><option value="html">HTML ${E('파일의 본문만 추출','text extraction only')}</option></select></label></div><label class="field"><span>${E('본문 붙여 넣기','Paste the text')}</span><textarea id="refBody" class="code-area" placeholder="${E('문단 사이에 빈 줄을 넣어 주세요.\n\n원래 위치가 p19라면 문단 앞에 {#p19}를 붙이세요.\n\n{#p19}\n해당 문단 본문…','Separate paragraphs with a blank line.\n\nTo preserve an original ID, prefix the paragraph:\n{#p19}\nThe source paragraph…')}"></textarea></label><label class="field"><span>${E('또는 파일 선택','Or choose a file')}</span><input id="refBodyFile" type="file" accept=".md,.txt,.html,.htm,text/plain,text/markdown,text/html"></label><p class="help">${E('HTML의 실행 코드·그림은 제거하고 텍스트와 링크만 가져옵니다. 원문 ID가 없으면 로컬 ID를 만들며, 공식 문단 위치와 일치한다고 표시하지 않습니다. 언어별로 따로 등록하세요.','HTML scripts and media are removed. Text, safe links and paragraph IDs are retained. Without original IDs, local IDs are generated; they are never presented as official positions. Register each language separately.')}</p><div class="reference-import-warning">${E('붙여 넣은 내용은 현재 브라우저에만 저장됩니다. 다른 기기에도 배포하려면 콘텐츠 팩으로 내보내 GitHub에 반영하세요.','This import is local. To distribute it to other devices, export the content pack and commit it to GitHub.')}</div><label class="checkline"><input id="refRights" type="checkbox"><span>${E('내용과 수록 범위를 확인했고, 이 자료를 사용할 수 있는지 확인했습니다.','I reviewed the content, coverage label and permission to use this material.')}</span></label><div id="refImportError" class="alert error" role="alert" hidden></div><div id="refImportPreview"></div></div><footer class="modal-footer"><button class="btn" data-v3="reference-preview">${icon('eye')}${E('미리 보기 · 링크 검사','Preview and inspect links')}</button><button class="btn primary" data-v3="reference-save">${icon('check')}${E('이 브라우저에 연결','Connect in this browser')}</button></footer>`,{kind:'reference-register',size:'wide'});
 $('#refBodyFile').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>2_000_000)throw Error(E('2 MB 이하 파일을 선택해 주세요.','Choose a file smaller than 2 MB.'));$('#refBody').value=await f.text();$('#refFormat').value=/\.html?$/i.test(f.name)?'html':'markdown';registerPreview=null;toast(E('파일을 읽었습니다. 미리 보기를 눌러 확인하세요.','File loaded. Preview it before saving.'));}catch(err){registerError(err.message);}});
}
function registerError(message){const el=$('#refImportError');if(el){el.textContent=message;el.hidden=false;}else toast(message,true);}
function readRegister(){
 const result=RE.validateDocument({url:$('#refURL').value,title:$('#refTitle').value,author:$('#refAuthor').value,language:$('#refLanguage').value,coverage:$('#refCoverage').value,edition:E('사용자가 등록한 자료 · 내용 검증 필요','User-registered text · verify content'),provenance:E('사용자가 본문을 붙여 넣었습니다. 이 앱이 공식 출처에서 자동 검증한 자료가 아닙니다.','Text pasted by a user, not automatically verified against the official source.'),blocks:parseReferenceText($('#refBody').value,$('#refFormat').value)});return result;
}
function previewReferenceRegistration(){try{const d=readRegister();registerPreview=d;$('#refImportError').hidden=true;const count=d.blocks.filter(b=>b.sourceId).length;const linked=auditLinks(d.blocks.map(b=>b.markdown).join('\n\n'),d.url);$('#refImportPreview').innerHTML=`<div class="reference-import-preview"><div class="badges"><span class="pill">${d.blocks.length} ${E('문단','paragraphs')}</span><span class="pill">${count} ${E('개 원문 ID','original IDs')}</span><span class="pill gold">${coverageName(d.coverage)}</span></div><div class="register-preview-reading">${d.blocks.slice(0,20).map(b=>`<section><small>${esc(b.id)}${b.sourceId?' · source':' · local'}</small><p>${inline(b.markdown,d.url)}</p></section>`).join('')}</div>${d.blocks.length>20?`<p>${E('미리보기는 첫 20문단만 표시합니다. 전체는 저장됩니다.','Preview shows the first 20 paragraphs. All are saved.')}</p>`:''}<p>${E('본문 안에서 찾은 참조자료','Nested references found')}: ${linked.length}</p></div>`;}catch(e){registerError(e.message);}}
function saveReferenceRegistration(){
 try{const doc=readRegister();if(!registerPreview||registerPreview.revision!==doc.revision)throw Error(E('최신 입력 내용으로 미리 보기를 먼저 확인해 주세요.','Preview the current text before saving.'));if(!$('#refRights').checked)throw Error(E('내용·수록 범위·자료 이용 확인을 선택해 주세요.','Confirm the content, coverage and permission review.'));
  const before=state.referenceDocuments;
  // Keep previous versions so old highlights and quotes never silently move.
  state.referenceDocuments=[...before.filter(d=>!(d.key===doc.key&&d.language===doc.language&&d.revision===doc.revision)),doc];
  if(!saveState()){state.referenceDocuments=before;throw Error(E('저장 공간이 부족합니다. 기존 본문은 유지했습니다. 기록을 내보내고 다시 시도하세요.','Storage failed. Previous text was retained. Export your data and try again.'));}
  const origin=reference.origin||openingOrigin(null);closeModal(false);openReference(RE.parse(doc.url,doc.title),origin,{language:doc.language});toast(E('본문을 연결했습니다. 같은 주소의 링크가 이제 이 본문을 엽니다.','Connected. Links to this address now open the registered text.'));if(state.view==='library'){const scroll=$('#referenceBody').scrollTop;render();$('#referenceBody').scrollTop=scroll;}
 }catch(e){registerError(e.message);}
}
function downloadJSON(name,payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function contentPack(){return {schema:'together-content-pack-v3',exportedAt:iso(),notice:'Content only. No notes, comments, highlights, queue or captured images. Verify permission before redistribution.',documents:state.referenceDocuments,lessons:state.customLessons};}
function validateLesson(l){return RE.validateLesson(l);}
function importPack(pack,{persist=true}={}){
 if(!pack||pack.schema!=='together-content-pack-v3'||!Array.isArray(pack.documents)||!Array.isArray(pack.lessons)||pack.documents.length>300||pack.lessons.length>30)throw Error(E('올바른 v3 콘텐츠 팩이 아닙니다.','Invalid v3 content pack.'));
 const docs=pack.documents.map(RE.validateDocument),ls=pack.lessons.map(validateLesson),beforeDocs=state.referenceDocuments,beforeLessons=state.customLessons;
 state.referenceDocuments=[...beforeDocs];for(const d of docs){state.referenceDocuments=state.referenceDocuments.filter(x=>!(x.key===d.key&&x.language===d.language&&x.revision===d.revision));state.referenceDocuments.push(d);}
 state.customLessons=[...beforeLessons];for(const l of ls){if(l.id===BASE.id&&l.version===BASE.version)continue;state.customLessons=state.customLessons.filter(x=>lessonKey(x)!==lessonKey(l));state.customLessons.push(l);}
 if(persist&&!saveState()){state.referenceDocuments=beforeDocs;state.customLessons=beforeLessons;throw Error(E('저장에 실패했습니다. 기존 콘텐츠를 유지했습니다.','Storage failed. Existing content was retained.'));}
}
function demoTalk(){
 if($('#modal').open)closeModal();if(state.view!=='read')navigate('read');
 const url=RE.CHURCH+'/study/general-conference/2015/04/therefore-they-hushed-their-fears?lang='+(lang()==='ko'?'kor':'eng');
 const a=$$('.source-text a').find(a=>(a.dataset.refUrl||'').includes('therefore-they-hushed'));
 a?.closest('.passage')?.scrollIntoView({block:'center',behavior:'instant'});openReference(RE.parse(url,E('그러므로 그들이 두려움을 가라앉히고','Therefore They Hushed Their Fears')),openingOrigin(a));
}
const previousGuide=showGuide;
showGuide=function(){previousGuide();const items=$('.demo-guide-flow');items?.insertAdjacentHTML('afterbegin',`<div class="demo-guide-item"><span class="step-no">0</span><div><strong>${E('새 기능 · 연차대회도 오른쪽에서','New · conference reading on the right')}</strong><p>${E('연차대회 시연용 요약을 열고 문단을 선택하세요. 본문 속 성구를 누른 뒤 ‘이전 자료’로 돌아오면 읽던 위치가 유지됩니다. 참조자료 관리에서 전문도 직접 등록할 수 있습니다.','Open a labeled conference summary and select a paragraph. Follow its scripture link, then return using Previous reference. Register full text in the reference library.')}</p><button class="btn sm primary" data-v3="demo-talk">${E('연차대회 패널 열기','Open conference reference')}</button></div></div>`);const heading=$('.modal-head h2');if(heading)heading.textContent=E('오늘, 이렇게 보여 주세요.','Your demonstration walkthrough');};
// Window capture precedes all document listeners and any native anchor navigation.
window.addEventListener('click',event=>{
 const v=event.target.closest?.('[data-v3]');
 if(v){event.preventDefault();event.stopImmediatePropagation();if(v.disabled)return;switch(v.dataset.v3){
  case 'library':if($('#modal').open)closeModal();navigate('library');break;
  case 'demo-talk':demoTalk();break;
  case 'ref-back':backReference();break;
  case 'reference-language':reference.language=v.dataset.language;reference.pinnedRevision=null;clearSelection();renderReference();break;
  case 'reference-chapter':{const chapters=[...reference.chapters],key=reference.key.split('/').slice(0,2).join('/')+'/'+v.dataset.chapter;const p=RE.parse(referenceURL(key,[],reference.language));p.chapters=chapters;openReference(p,reference.origin,{language:reference.language,pushHistory:false});break;}
  case 'register-current':showRegister(reference.sourceURL,currentRecord()?.title||reference.parsed?.label||'',reference.language);break;
  case 'register-url':showRegister(v.dataset.url,v.dataset.label);break;
  case 'register-new':showRegister();break;
  case 'reference-preview':previewReferenceRegistration();break;
  case 'reference-save':saveReferenceRegistration();break;
  case 'open-reference':openReference(RE.parse(v.dataset.url,v.dataset.label),openingOrigin(null));break;
  case 'library-filter':libraryFilter=v.dataset.filter;render();break;
  case 'export-content':downloadJSON('deployment-content.json',contentPack());toast(E('개인 기록을 제외한 콘텐츠 팩을 내보냈습니다.','Exported content only, without personal records.'));break;
  case 'copy-source':{const u=reference.sourceURL;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(u).then(()=>toast(E('원본 주소를 복사했습니다.','Source URL copied.'))).catch(()=>prompt(E('원본 주소','Source URL'),u));else prompt(E('원본 주소','Source URL'),u);break;}
 }return;}
 const a=event.target.closest?.('a');if(!a||a.hasAttribute('download')||a.dataset.explicitExternal==='true')return;
 const raw=a.dataset.refUrl||a.getAttribute('href');if(!raw||raw.startsWith('blob:')||raw.startsWith('data:'))return;
 if(!a.dataset.refUrl&&!/^https?:|^\/study\//.test(raw))return;
 event.preventDefault();event.stopImmediatePropagation();const inside=!!a.closest('#referenceDrawer'),parsed=RE.parse(raw,a.textContent,inside?reference.sourceURL:currentLesson().sourceUrl[lang()]);
 if(parsed){const origin=openingOrigin(a);if($('#modal').open)closeModal();openReference(parsed,origin,{language:inside?reference.language:lang()});}else toast(E('안전하지 않거나 지원하지 않는 주소입니다.','Unsafe or unsupported URL.'),true);
},true);
document.addEventListener('input',event=>{
 if(event.target.id==='librarySearch'){libraryQuery=event.target.value;const position=event.target.selectionStart;render();$('#librarySearch').focus();$('#librarySearch').setSelectionRange(position,position);}
 if(event.target.closest('.reference-register')&&event.target.id!=='refRights')registerPreview=null;
});
document.addEventListener('change',async event=>{if(event.target.id!=='contentPackFile')return;const f=event.target.files?.[0];if(!f)return;try{if(f.size>4_000_000)throw Error(E('4 MB 이하 팩을 선택해 주세요.','Choose a content pack smaller than 4 MB.'));const pack=JSON.parse(await f.text());importPack(pack);render();toast(E('콘텐츠 팩을 이 브라우저에 적용했습니다.','Content pack applied in this browser.'));}catch(e){toast(e.message,true);}});
// Ensure scripts exported from localStorage cannot become executable HTML. All rendering escapes inputs.
try{
 const localPack={schema:'together-content-pack-v3',documents:state.referenceDocuments.map(RE.validateDocument),lessons:state.customLessons.map(RE.validateLesson)};
 state.referenceDocuments=[];state.customLessons=[];
 importPack(DEPLOYED,{persist:false});
 // Retain browser-local edits as the newest version instead of replacing them on reload.
 importPack(localPack,{persist:false});
}catch(e){state.referenceDocuments=[];state.customLessons=[];importPack(DEPLOYED,{persist:false});toast(E('일부 로컬 콘텐츠의 형식을 확인할 수 없어 배포된 자료를 열었습니다.','Some local content was invalid; deployed content was retained.'),true);}
render();
window.TogetherPrototype={...window.TogetherPrototype,version:'3.0.0',parseReference,openReference,backReference,recordFor,currentAudit,auditLinks,contentPack,importPack,parseReferenceText,readRegister,referenceAnchor,captureReadingRegion,goToAnchor,libraryHTML,RE,getState:()=>state};
