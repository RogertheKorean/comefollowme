/* Together v3: one local reading pane for scripture, conference and manuals.
 * Original source identity, language and content revisions stay on every anchor.
 * Numeric row indices are UI-only; unitId/blockId preserve actual paragraph IDs.
 */
'use strict';
const SCRIPTURES=JSON.parse(document.querySelector('#scripture-data').textContent).chapters;
const RE=ReferenceEngine;
const BUNDLED_REFS=JSON.parse(document.querySelector('#reference-data').textContent).documents.map(RE.validateDocument);
const DEPLOYED=JSON.parse(document.querySelector('#deployment-data').textContent);
state.referenceDocuments=Array.isArray(state.referenceDocuments)?state.referenceDocuments:[];
state.highlights=Array.isArray(state.highlights)?state.highlights:[];
if(state.view==='bridge')state.view='read';
const BOOK_NAMES={'ot/prov':['잠언','Proverbs'],'ot/eccl':['전도서','Ecclesiastes'],'nt/matt':['마태복음','Matthew'],'nt/mark':['마가복음','Mark'],'nt/john':['요한복음','John'],'nt/heb':['히브리서','Hebrews'],'bofm/2-ne':['니파이후서','2 Nephi'],'bofm/mosiah':['모사이야서','Mosiah']};
const reference={open:false,key:'',kind:'scripture',verses:[],chapters:[],language:'ko',mode:'context',origin:null,selected:[],history:[],sourceURL:'',returnFocus:null,lastVerse:null,parsed:null,pinnedRevision:null,resolved:null};
ICONS.highlight='m15 3 6 6-9 9H6v-6z M12 6l6 6 M3 21h8';
ICONS.split='M3 4h18v16H3z M14 4v16 M7 8h3 M7 12h3';
const oldRender=render,oldNavigate=navigate,oldLanguage=setLanguage,oldAnchorFromSelection=anchorFromSelection,oldApplyHighlights=applyHighlights,oldGoToAnchor=goToAnchor,oldCloseModal=closeModal,oldMineHTML=mineHTML,oldExportNotes=exportNotes,oldPresentation=renderPresentation;
const E=(ko,en)=>tr(ko,en);
const isRefAnchor=a=>a?.kind==='scripture'||a?.kind==='reference';
function allReferenceDocuments(){return [...BUNDLED_REFS,...state.referenceDocuments];}
function recordFor(key,language=reference.language,revision=null){
 const docs=allReferenceDocuments().filter(d=>d.key===key&&d.language===language&&(!revision||d.revision===revision));
 const d=docs.at(-1);
 if(d){const rows={};d.blocks.forEach((b,i)=>{rows[i+1]={...b,text:plain(b.markdown)};});return {key,kind:d.kind,title:d.title,author:d.author,date:d.date,language,coverage:d.coverage,edition:d.edition,revision:d.revision,source:d.url,provenance:d.provenance,rows,document:d};}
 const s=SCRIPTURES[key];if(!s||!s.verses[language]||(revision&&revision!==s.revision))return null;
 const rows={};for(const [v,text]of Object.entries(s.verses[language]))rows[v]={id:'p'+v,markdown:text,text,sourceId:true,type:'paragraph'};
 return {key,kind:'scripture',title:refBookName(key,language)+' '+s.chapter+(language==='ko'?'장':''),language,coverage:s.coverage==='full'?'full':'excerpt',edition:s.edition[language],revision:s.revision,source:s.source[language],rows,provenance:language==='ko'?'v2에 수록된 개역한글. 공과의 개역개정과 표현이 다를 수 있습니다.':'KJV scripture text retained from v2.'};
}
function currentRecord(){return recordFor(reference.key,reference.language,reference.pinnedRevision);}
function refBookName(key=reference.key,language=reference.language){return SCRIPTURES[key]?.book[language]||(BOOK_NAMES[key.split('/').slice(0,2).join('/')]||[key,key])[language==='ko'?0:1];}
function verseLabel(values){const a=[...new Set(values.map(Number).filter(n=>Number.isInteger(n)&&n>0))].sort((x,y)=>x-y);if(!a.length)return '';let out=[],start=a[0],end=start;for(let i=1;i<=a.length;i++){if(a[i]===end+1){end=a[i];continue;}out.push(start===end?''+start:start+'–'+end);start=end=a[i];}return out.join(', ');}
function refLabel(key=reference.key,verses=reference.verses,language=reference.language){
 if(/^\w[\w-]*\/[^/]+\/\d+$/.test(key))return `${refBookName(key,language)} ${Number(key.split('/').at(-1))}${verses.length?':'+verseLabel(verses):language==='ko'?'장':''}`;
 return recordFor(key,language)?.title||reference.parsed?.label||key.split('/').at(-1)||E('참조자료','Reference');
}
function anchorLabel(a,language=a?.language||lang()){
 if(isRefAnchor(a)){if(a.reference.title)return a.reference.title+(a.reference.coverage==='summary'?(language==='ko'?' · 학습 요약':' · study summary'):'');return refLabel(a.reference.key,a.reference.verses,language);}
 return sectionName(a?.sectionId,language,lessonForAnchor(a)||currentLesson());
}
function referenceURL(key,verses,language){
 const isScript=/^\w[\w-]*\/[^/]+\/\d+$/.test(key);
 const u=RE.cleanURL(isScript?RE.CHURCH+'/study/scriptures/'+key:key.startsWith('/')?RE.CHURCH+key:key);
 if(!u)return '';
 u.searchParams.set('lang',language==='ko'?'kor':'eng');
 if(verses?.length&&isScript){u.searchParams.set('id',verses.map(v=>'p'+v).join(','));u.hash='p'+verses[0];}
 return u.href;
}
function parseReference(url,label=''){return RE.parse(url,label,reference.open?reference.sourceURL:currentLesson().sourceUrl[lang()]);}
function readerPosition(){if(state.view!=='read')return null;const el=visibleBlock();return el?{id:el.dataset.block,top:el.getBoundingClientRect().top,y:scrollY}:null;}
function keepReaderPosition(p){if(!p)return;const el=document.getElementById('block-'+p.id);if(el)scrollBy({top:el.getBoundingClientRect().top-p.top,behavior:'instant'});}
function ensureReferenceShell(){if($('#referenceDrawer'))return;document.body.insertAdjacentHTML('beforeend','<div id="referenceBackdrop" class="reference-backdrop" data-enhance="ref-close" hidden></div><aside id="referenceDrawer" class="reference-drawer" aria-labelledby="referenceTitle" tabindex="-1" hidden></aside>');}
function openingOrigin(el){if(el?.closest?.('#referenceDrawer'))return reference.origin;const p=el?.closest?.('.passage');return {lessonKey:lessonKey(currentLesson()),lessonId:currentLesson().id,version:currentLesson().version,blockId:p?.dataset.block||visibleBlock()?.dataset.block||currentLesson().blocks[0].id,sectionId:p?.dataset.section||currentSection,language:lang()};}
function resolveReference(){
 const b=currentRecord(),blocks=b?Object.values(b.rows):[];
 const targets=reference.parsed?.targets||RE.targetSpec(reference.verses.map(v=>'p'+v).join(','));
 reference.resolved=RE.resolveTargets(targets,blocks);
 reference.verses=b?Object.keys(b.rows).map(Number).filter(n=>reference.resolved.ids.includes(b.rows[n].id)):[];
 return b;
}
function referenceSnapshot(){return {key:reference.key,kind:reference.kind,verses:[...reference.verses],chapters:[...reference.chapters],language:reference.language,mode:reference.mode,origin:reference.origin,selected:[...reference.selected],sourceURL:reference.sourceURL,parsed:structuredClone(reference.parsed),pinnedRevision:reference.pinnedRevision,scroll:$('#referenceBody')?.scrollTop||0,anchor:isRefAnchor(selectedAnchor)?structuredClone(selectedAnchor):null};}
function openReference(parsed,origin=null,{language=lang(),focus=true,fromAnchor=null,pushHistory=true}={}){
 if(!parsed)return;ensureReferenceShell();const pos=readerPosition();
 if(reference.open&&pushHistory)reference.history.push(referenceSnapshot());else if(!reference.open)reference.returnFocus=document.activeElement;
 clearSelection();Object.assign(reference,{open:true,key:parsed.key,kind:parsed.kind||'scripture',verses:parsed.verses||[],chapters:parsed.chapters||[],language,mode:'context',origin:origin||openingOrigin(null),selected:[],sourceURL:parsed.sourceURL||referenceURL(parsed.key,parsed.verses||[],language),parsed:structuredClone(parsed),pinnedRevision:fromAnchor?.reference.revision||null,lastVerse:null});
 const b=resolveReference();
 if(fromAnchor&&b){const ids=fromAnchor.reference.unitIds||fromAnchor.segments.map(s=>s.unitId||(/^verse-/.test(s.blockId)?'p'+s.verse:s.blockId));reference.parsed.targets={ids,ranges:[],invalid:false};resolveReference();}
 reference.mode=reference.kind==='scripture'&&reference.verses.length?'verses':'context';
 document.body.classList.add('scripture-open');renderReference();keepReaderPosition(pos);
 if(fromAnchor){transientAnchor=fromAnchor;applyReferenceHighlights();}
 if(reference.verses.length)scrollReferenceTo(reference.verses[0]);
 if(focus)$('#referenceDrawer').focus({preventScroll:true});setReferenceInert();
}
function backReference(){
 const last=reference.history.pop();if(!last){closeReference({origin:true});return;}
 clearSelection();Object.assign(reference,last,{open:true});renderReference();$('#referenceBody').scrollTop=last.scroll;selectedAnchor=last.anchor;reference.selected=last.selected;updateReferenceStatus();applyReferenceHighlights();
}
function setReferenceInert(){const mobile=reference.open&&innerWidth<=760;$('#app').inert=mobile||!$('#presentation').hidden;$('#referenceDrawer')?.setAttribute('role',mobile?'dialog':'complementary');if(mobile)$('#referenceDrawer').setAttribute('aria-modal','true');else $('#referenceDrawer')?.removeAttribute('aria-modal');$('#referenceBackdrop').hidden=!reference.open;$('#floatingInsight').hidden=state.view!=='read'||mobile;}
function closeReference({returnFocus=true,origin=false}={}){
 if(!reference.open)return;const p=readerPosition(),parent=reference.origin,f=reference.returnFocus;reference.open=false;reference.selected=[];reference.history=[];clearSelection();document.body.classList.remove('scripture-open');$('#referenceDrawer').hidden=true;$('#referenceBackdrop').hidden=true;$('#app').inert=false;$('#floatingInsight').hidden=state.view!=='read';keepReaderPosition(p);
 if(origin&&parent?.blockId){const b=$('#block-'+parent.blockId);if(b){b.scrollIntoView({block:'center',behavior:'instant'});b.classList.add('ref-origin-flash');setTimeout(()=>b.classList.remove('ref-origin-flash'),1600);}}
 if(returnFocus&&f?.isConnected)f.focus({preventScroll:true});
}
function typeName(kind){return ({scripture:E('성구','Scripture'),conference:E('연차대회','Conference'),manual:E('교재','Manual'),collection:E('자료 목록','Collection'),image:E('그림','Image'),pdf:'PDF',article:E('참조자료','Reference')})[kind]||E('참조자료','Reference');}
function coverageName(c){return ({full:E('전문 수록','Full text'),excerpt:E('발췌 수록','Excerpt'),summary:E('학습 요약','Study summary'),missing:E('본문 미등록','Not registered')})[c]||E('본문 미등록','Not registered');}
function sourceMetadata(b){return `<details class="reference-source v3-source"><summary>${E('출처 · 판본 · 연결 위치','Source · edition · position')}</summary><p>${esc(b?.provenance||E('본문이 등록되지 않았습니다. 주소만으로 내용을 생성하지 않습니다.','No text has been registered. Content is not generated from a URL.'))}</p><code>${esc(reference.sourceURL)}</code>${b?`<small>${E('저장 버전','Saved version')}: ${esc(b.revision)}</small>`:''}<div class="buttons"><button class="btn sm" data-v3="copy-source">${icon('link','small')}${E('원본 주소 복사','Copy original URL')}</button><button class="btn sm" data-v3="register-current">${icon('upload','small')}${E('본문 등록 / 교체','Register / replace text')}</button></div></details>`;}
function referenceOriginalLink(){
 const cleaned=RE.cleanURL(reference.sourceURL);if(!cleaned)return '';
 const url=new URL(cleaned.href);
 const official=url.hostname==='www.churchofjesuschrist.org'||url.hostname==='churchofjesuschrist.org';
 if(official)url.searchParams.set('lang',reference.language==='ko'?'kor':'eng');
 return `<a class="reference-original" data-explicit-external="true" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer"><span>${icon('external','small')}${official?E('공식 원문 열기','Open official source'):E('원문 사이트 열기','Open original source')}</span><small>${reference.language==='ko'?'한국어':'English'} · ${E('새 탭','New tab')}</small></a>`;
}
function renderReference(){
 if(!reference.open)return;ensureReferenceShell();const b=resolveReference(),nums=b?Object.keys(b.rows).map(Number):[],isScript=reference.kind==='scripture';
 const display=reference.mode==='verses'&&reference.verses.length?reference.verses:nums;
 const status=b?.coverage||'missing',missing=reference.resolved?.missing||[];let rows='',last=0;
 for(const n of display){const row=b.rows[n];if(isScript&&last&&n>last+1)rows+=`<div class="verse-gap">${E('… 중간 구절 미수록 또는 생략','… intervening verses unavailable or omitted')}</div>`;
  rows+=`<section class="verse-row ${reference.verses.includes(n)?'referred':''} ${reference.selected.includes(n)?'verse-selected':''} ${row.type==='heading'?'ref-section-heading':''}" data-verse="${n}" id="ref-verse-${n}"><button class="verse-number" data-enhance="ref-select-verse" data-verse="${n}" aria-label="${esc(isScript?E(n+'절 선택','Select verse '+n):E(n+'번 문단 선택','Select paragraph '+n))}" aria-pressed="${reference.selected.includes(n)}"><span class="snapshot-piece">${isScript?n:'¶'+n}</span></button><div class="scripture-text snapshot-piece" lang="${reference.language}" data-verse-text="${n}" data-unit-id="${esc(row.id)}">${inline(row.markdown,reference.sourceURL).replace(/\n/g,'<br>')}</div></section>`;last=n;
 }
 const caveat=status==='summary'?`<div class="reference-coverage summary-notice"><strong>${E('시연용 요약 · 공식 말씀 전문이 아닙니다','Demo summary · not the original talk')}</strong><p>${E('아래는 출처를 참고한 짧은 학습 요약입니다. 문단 번호는 요약 내부 위치이며 공식 말씀의 문단 번호가 아닙니다.','This short study summary has its own paragraph positions, distinct from the original talk.')}</p></div>`:status==='excerpt'?`<div class="reference-coverage">${E('발췌만 수록되어 있습니다. 장·말씀·교재 전체가 아닙니다.','An excerpt is included, not the entire chapter or document.')}</div>`:'';
 const targetNotice=missing.length||reference.resolved?.invalid?`<div class="reference-coverage target-warning">${E('링크가 지정한 위치 중 미수록 또는 확인할 수 없는 부분','Some linked positions are unavailable or invalid')}: ${esc(missing.join(', ')||E('잘못된 위치 표현','invalid selector'))}. ${E('다른 문단을 정확한 원문으로 표시하지 않습니다.','No different paragraph is presented as an exact match.')}</div>`:'';
 const empty=!rows;
 const emptyHTML=`<div class="reference-no-data">${icon(reference.kind==='image'?'image':'book')}<h3>${E(reference.kind==='collection'?'이 링크는 자료 목록입니다.':'이 본문은 아직 등록되지 않았어요.',reference.kind==='collection'?'This link is a collection.':'This text has not been registered.')}</h3><p>${E('링크와 자료 종류는 인식했습니다. 외부 페이지로 이동하거나 다른 내용으로 바꾸지 않습니다. 사용할 본문을 등록하면 이 링크에서 바로 읽을 수 있습니다.','The reference and its type were recognized. No external navigation or substitute text is used. Register text to read it here.')}</p><button class="btn primary" data-v3="register-current">${icon('upload')}${E('이 자료의 본문 넣기','Register this text')}</button><button class="text-btn" data-v3="library">${E('전체 연결 상태 확인','Review all references')}</button></div>`;
 const heading=b?.kind==='scripture'?refLabel(reference.key,reference.parsed?.verses||[],reference.language):b?.title||reference.parsed?.label||refLabel();
 $('#referenceDrawer').hidden=false;$('#referenceDrawer').dataset.kind=reference.kind;
 $('#referenceDrawer').innerHTML=`<header class="reference-head"><div class="reference-topline"><span class="reference-eyebrow">${icon('split','small')} ${typeName(reference.kind)} <span class="ref-status ${status}">${coverageName(status)}</span></span><button class="close-btn" data-enhance="ref-close" aria-label="${E('참조 패널 닫기','Close reference panel')}">${icon('close')}</button></div><h2 id="referenceTitle">${esc(heading)}</h2>${b?.author?`<p class="reference-author">${esc(b.author)} <span>· ${esc(b.date)}</span></p>`:''}${referenceOriginalLink()}<div class="reference-breadcrumb">${reference.history.length?`<button class="reference-back" data-v3="ref-back">${icon('back')}${E('이전 자료','Previous reference')}</button>`:''}<button class="reference-back" data-enhance="ref-origin">${icon(reference.history.length?'book':'back')}${E('공과로 돌아가기','Back to lesson')}</button><span>${reference.history.length+1} ${E('단계','level(s)')}</span></div><div class="reference-controls"><div class="ref-tabs" role="group" aria-label="${E('읽기 범위','Reading range')}">${isScript?`<button data-enhance="ref-mode" data-mode="verses" class="${reference.mode==='verses'?'active':''}" ${!reference.verses.length?'disabled':''}>${E('참조 구절','Referenced')}</button><button data-enhance="ref-mode" data-mode="context" class="${reference.mode==='context'?'active':''}">${status==='full'?E('장 전체','Whole chapter'):E('수록 문맥','Available text')}</button>`:`<span class="ref-reading-label">${E('문단을 선택하여 기록하세요','Select a paragraph to reflect')}</span>`}</div><div class="ref-language" role="group" aria-label="${E('참조자료 언어','Reference language')}"><button data-v3="reference-language" data-language="ko" class="${reference.language==='ko'?'active':''}" aria-pressed="${reference.language==='ko'}">한국어</button><button data-v3="reference-language" data-language="en" class="${reference.language==='en'?'active':''}" aria-pressed="${reference.language==='en'}">EN</button></div></div>${reference.chapters.length>1?`<div class="ref-chapters">${reference.chapters.map(c=>`<button data-v3="reference-chapter" data-chapter="${c}" class="${Number(reference.key.split('/').at(-1))===c?'active':''}">${c}${E('장','')}</button>`).join('')}</div>`:''}</header><div class="reference-body" id="referenceBody"><div class="reference-edition">${icon('book','small')}<span>${esc(b?.edition||E('아직 읽기 자료가 없습니다','No registered reading text'))}</span></div>${caveat}${targetNotice}${!empty?`<div class="reference-instruction">${E('문장을 드래그하거나 왼쪽 번호를 누르세요.','Select words, or tap the number on the left.')}<br>${E('형광펜과 인사이트는 이 자료의 위치를 기억합니다.','Highlights and insights remember this source position.')}</div>`:''}${rows||emptyHTML}${sourceMetadata(b)}</div><footer class="reference-footer"><div class="reference-selection-status" id="refSelectionStatus"></div><div class="buttons"><button class="btn" data-enhance="ref-highlight" ${empty?'disabled':''}><span class="highlight-dot"></span>${E('형광펜','Highlight')}</button><button class="btn primary" data-enhance="ref-insight" ${empty?'disabled':''}>${icon('spark')}${E('인사이트 첨부','Add insight')}</button></div></footer>`;
 applyReferenceHighlights();updateReferenceStatus();setReferenceInert();$('#referenceBody').addEventListener('scroll',()=>{$('#selectionToolbar').hidden=true;},{passive:true});
}
function updateReferenceStatus(){const el=$('#refSelectionStatus');if(!el)return;const a=isRefAnchor(selectedAnchor)&&selectedAnchor.reference.key===reference.key?selectedAnchor:null;el.innerHTML=a?`<strong>${esc(verseLabel(a.reference.verses))}${E(reference.kind==='scripture'?'절 · 선택한 내용':'번 문단 · 선택한 내용',' · selected')}</strong><button class="text-btn" data-enhance="ref-clear">${E('선택 해제','Clear')}</button>`:`<span>${E('선택 없이 누르면 지금 읽는 부분을 첨부해요.','No selection? Attach the part you are reading.')}</span>`;$$('.verse-row',$('#referenceDrawer')).forEach(el=>{const active=reference.selected.includes(+el.dataset.verse);el.classList.toggle('verse-selected',active);$('.verse-number',el).setAttribute('aria-pressed',String(active));});}
function referenceAnchor(verses,mode='selection',segments=null){
 const b=currentRecord();if(!b)return null;const nums=[...new Set(verses)].filter(n=>b.rows[n]).sort((a,b)=>a-b);if(!nums.length)return null;
 const ss=segments||nums.map(n=>({blockId:b.rows[n].id,unitId:b.rows[n].id,verse:n,start:0,end:b.rows[n].text.length,exact:b.rows[n].text,prefix:'',suffix:''}));
 const origin=reference.origin||openingOrigin(null);
 return {kind:b.kind==='scripture'?'scripture':'reference',lessonKey:origin.lessonKey,lessonId:origin.lessonId,version:b.revision,language:reference.language,sectionId:origin.sectionId,sourceUrl:b.source,churchSourceUrl:reference.sourceURL,mode,quote:ss.map(s=>s.exact).join('\n\n'),segments:ss,reference:{key:reference.key,kind:b.kind,verses:nums,unitIds:ss.map(s=>s.unitId),title:b.kind==='scripture'?refLabel(reference.key,nums,reference.language):b.title,coverage:b.coverage,edition:b.edition,revision:b.revision},origin:{...origin},offsetEncoding:'UTF-16 code units',confidence:'exact-local-text'};
}
function referenceAnchorFromSelection(){
 if(!reference.open)return null;const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed)return null;const range=sel.getRangeAt(0),panel=$('#referenceBody'),b=currentRecord();if(!panel||!b||!panel.contains(range.startContainer)||!panel.contains(range.endContainer))return null;
 const segments=[];for(const root of $$('[data-verse-text]',panel)){if(!range.intersectsNode(root))continue;const text=root.textContent;let start=0,end=text.length;if(root.contains(range.startContainer))start=measureRangeOffset(root,range.startContainer,range.startOffset);if(root.contains(range.endContainer))end=measureRangeOffset(root,range.endContainer,range.endOffset);if(end<=start||!text.slice(start,end).trim())continue;const n=+root.dataset.verseText;segments.push({blockId:b.rows[n].id,unitId:b.rows[n].id,verse:n,start,end,exact:text.slice(start,end),prefix:text.slice(Math.max(0,start-32),start),suffix:text.slice(end,end+32)});}
 return segments.length?referenceAnchor(segments.map(s=>s.verse),'selection',segments):null;
}
anchorFromSelection=function(){return referenceAnchorFromSelection()||oldAnchorFromSelection();};
function visibleReferenceAnchor(){const body=$('#referenceBody');if(!body)return null;const rect=body.getBoundingClientRect(),row=$$('.verse-row',body).find(el=>el.getBoundingClientRect().bottom>rect.top+20&&el.getBoundingClientRect().top<rect.bottom-10);return referenceAnchor(reference.mode==='verses'&&reference.verses.length?reference.verses:row?[+row.dataset.verse]:[],'viewport');}
function selectedReferenceAnchor(){return(isRefAnchor(selectedAnchor)&&selectedAnchor.reference.key===reference.key&&selectedAnchor.language===reference.language?selectedAnchor:null)||referenceAnchorFromSelection()||(reference.selected.length?referenceAnchor(reference.selected):null)||visibleReferenceAnchor();}
function scrollReferenceTo(v){const b=$('#referenceBody'),r=$('#ref-verse-'+v);if(b&&r)b.scrollTop+=r.getBoundingClientRect().top-b.getBoundingClientRect().top-30;}
function toggleVerse(v,shift=false){const b=currentRecord();if(!b?.rows[v])return;getSelection()?.removeAllRanges();if(shift&&reference.lastVerse){const a=Math.min(v,reference.lastVerse),z=Math.max(v,reference.lastVerse);reference.selected=Object.keys(b.rows).map(Number).filter(n=>n>=a&&n<=z);}else if(reference.selected.includes(v))reference.selected=reference.selected.filter(n=>n!==v);else reference.selected.push(v);reference.lastVerse=v;selectedAnchor=reference.selected.length?referenceAnchor(reference.selected):null;selectedRange=null;$('#selectionToolbar').hidden=true;updateReferenceStatus();}
clearSelection=function(remove=true){selectedAnchor=null;selectedRange=null;reference.selected=[];$('#selectionToolbar').hidden=true;$('#floatingInsight').classList.remove('selection');$('#floatingInsight').innerHTML=icon('spark')+`<span>${E('인사이트','Insight')}</span>`;$('#floatingHint').textContent=E('문장을 선택하거나, 지금 읽는 곳에 기록하세요.','Select a passage, or reflect on where you are reading.');if(remove)getSelection()?.removeAllRanges();updateReferenceStatus();};
function showSelectionToolbar(a,r){const tool=$('#selectionToolbar'),matching=matchingHighlight(a);tool.innerHTML=`<button data-enhance="selection-highlight"><span class="highlight-dot"></span>${matching?E('형광펜 해제','Unhighlight'):E('형광펜','Highlight')}</button><button class="primary-selection" data-enhance="selection-insight">${icon('spark')}${E('인사이트','Insight')}</button><button data-action="clear-selection" aria-label="${E('선택 해제','Clear')}">${icon('close')}</button>`;tool.hidden=false;const w=Math.min(300,tool.getBoundingClientRect().width||270),left=Math.max(12,Math.min(innerWidth-w-12,r.left+r.width/2-w/2));const floor=isRefAnchor(a)?Math.max(10,$('.reference-head').getBoundingClientRect().bottom+4):90;tool.style.left=left+'px';tool.style.top=Math.min(innerHeight-65,r.top-50<floor?r.bottom+8:r.top-50)+'px';}
selectionChanged=function(){if((state.view!=='read'&&!reference.open)||$('#modal').open)return;const a=anchorFromSelection();if(a){selectedAnchor=a;selectedRange=getSelection().getRangeAt(0).cloneRange();reference.selected=[];updateReferenceStatus();if(!isRefAnchor(a)){$('#floatingInsight').classList.add('selection');$('#floatingInsight').innerHTML=icon('spark')+`<span>${E('선택한 문장에 인사이트','Reflect on selection')}</span>`;}showSelectionToolbar(a,selectedRange.getBoundingClientRect());}else if(reference.open&&reference.selected.length){selectedAnchor=referenceAnchor(reference.selected);updateReferenceStatus();}else clearSelection(false);};
function comparableAnchor(a){return [a.kind||'lesson',isRefAnchor(a)?a.reference.key:a.lessonKey,a.language,isRefAnchor(a)?a.reference.revision:a.version].join('|');}
function matchingHighlight(a){return state.highlights.find(h=>comparableAnchor(h.anchor)===comparableAnchor(a)&&JSON.stringify(h.anchor.segments.map(s=>[s.blockId,s.start,s.end,s.exact]))===JSON.stringify(a.segments.map(s=>[s.blockId,s.start,s.end,s.exact])));}
function saveHighlight(anchor){if(!anchor?.segments?.length){toast(E('문장이나 왼쪽 번호를 먼저 선택해 주세요.','Select words or a number first.'));return;}const exists=matchingHighlight(anchor);if(exists)state.highlights=state.highlights.filter(h=>h.id!==exists.id);else state.highlights.push({id:uid(),anchor:structuredClone(anchor),color:'gold',created:iso()});const ok=saveState();clearSelection();applyHighlights();applyReferenceHighlights();toast(ok?(exists?E('형광펜 표시를 지웠습니다.','Highlight removed.'):E('형광펜으로 표시했습니다. 내 기록에서 다시 볼 수 있어요.','Highlighted. Find it in My journal.')):E('저장 실패 · 내 기록에서 내보내기를 해 주세요.','Storage failed. Export your journal.'),!ok);}
function applyAnchorsToRoots(anchors,findRoot){const byRoot=new Map();for(const a of anchors)for(const s of a.segments||[]){const root=findRoot(s);if(!root)continue;const r=resolveSegment(root,s);if(!r)continue;if(!byRoot.has(root))byRoot.set(root,[]);byRoot.get(root).push(r);}for(const [root,ranges]of byRoot){ranges.sort((a,b)=>a.start-b.start);const merged=[];for(const r of ranges){const last=merged.at(-1);if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push({...r});}merged.reverse().forEach(r=>markRange(root,r.start,r.end,'personal-highlight'));}}
applyHighlights=function(){oldApplyHighlights();const hs=state.highlights.filter(h=>!isRefAnchor(h.anchor)&&h.anchor.lessonKey===lessonKey(currentLesson())&&h.anchor.language===lang());applyAnchorsToRoots(hs.map(h=>h.anchor),s=>$('#block-'+s.blockId+' .source-text'));};
function rootForSegment(s){const b=currentRecord();if(!b)return null;const id=s.unitId||(/^verse-/.test(s.blockId)?'p'+s.verse:s.blockId),n=Object.keys(b.rows).find(n=>b.rows[n].id===id);return n?$('[data-verse-text="'+n+'"]',$('#referenceBody')):null;}
function applyReferenceHighlights(){if(!reference.open||!$('#referenceBody'))return;$$('[data-verse-text]',$('#referenceBody')).forEach(removeMarks);const b=currentRecord();if(!b)return;const matches=a=>isRefAnchor(a)&&a.reference.key===reference.key&&a.language===reference.language&&a.reference.revision===b.revision;let anchors=[...ownNotes().filter(n=>matches(n.anchor)).map(n=>n.anchor),...state.highlights.filter(h=>matches(h.anchor)).map(h=>h.anchor)];if(matches(transientAnchor))anchors.push(transientAnchor);applyAnchorsToRoots(anchors,rootForSegment);}
goToAnchor=function(a){
 if(!isRefAnchor(a)){closeReference({returnFocus:false});oldGoToAnchor(a);return;}
 const lesson=lessonForAnchor(a);closeReference({returnFocus:false});if(lesson)state.activeLesson=lessonKey(lesson);state.view='read';currentSection=a.origin?.sectionId||a.sectionId;transientAnchor=a;saveState();render();$('#block-'+a.origin?.blockId)?.scrollIntoView({block:'center',behavior:'instant'});
 const parsed=RE.parse(a.churchSourceUrl||referenceURL(a.reference.key,a.reference.verses,a.language),a.reference.title||'');if(!parsed)return;
 openReference(parsed,a.origin,{language:a.language,fromAnchor:a});const b=currentRecord();const matched=b?.revision===a.reference.revision&&a.segments.every(s=>{const r=rootForSegment(s);return r&&!!resolveSegment(r,s);});
 toast(matched?E('기록 당시의 자료·언어·문단으로 돌아왔습니다.','Returned to the saved source, language and paragraph.'):E('저장한 본문 버전을 확인할 수 없습니다. 다른 본문을 정확한 원문으로 표시하지 않습니다.','The saved version is unavailable. No different text is presented as an exact match.'),!matched);
};

/* Visible text only. No screen permission, cross-origin images or private feed content. */
captureReadingRegion=async function(anchor){
 const isRef=isRefAnchor(anchor);const root=isRef?$('#referenceBody'):$('#readerCard');
 if(!root||(isRef&&(!reference.open||reference.key!==anchor.reference.key||reference.language!==anchor.language)))return quoteCardFallback(anchor,'The original source is not currently visible.');
 try{
  const r=root.getBoundingClientRect();let top=isRef?r.top:Math.max(r.top,($('.topbar')?.getBoundingClientRect().bottom||80)+5);
  let bottom=Math.min(r.bottom,innerHeight-(isRef?0:25));
  if(isRef){const rows=$$('.verse-row',root).map(el=>el.getBoundingClientRect()).filter(v=>v.bottom>top&&v.top<bottom);if(rows.length){top=Math.max(top,rows[0].top-10);bottom=Math.min(bottom,rows.at(-1).bottom+10);}}
  const height=Math.min(820,bottom-top);const width=Math.round(r.width);
  if(height<50||width<100)return quoteCardFallback(anchor,'No visible reading area.');
  const stage=document.createElementNS('http://www.w3.org/1999/xhtml','div');stage.setAttribute('style',`position:relative;overflow:hidden;background:#fffefa;width:${width}px;height:${height}px`);
  let pieces=0;
  for(const node of $$('.snapshot-piece',root)){
   const nr=node.getBoundingClientRect();if(node.offsetParent===null||nr.width<2||nr.height<2||nr.bottom<=top||nr.top>=top+height||node.closest('details:not([open])'))continue;
   const copy=styledCopy(node);if(!copy)continue;copy.style.position='absolute';copy.style.left=(nr.left-r.left)+'px';copy.style.top=(nr.top-top)+'px';copy.style.width=nr.width+'px';copy.style.margin='0';copy.style.transform='none';
   const segs=(anchor.segments||[]).filter(s=>isRef?Number(node.dataset.verseText)===s.verse:node.closest('[data-block]')?.dataset.block===s.blockId).sort((a,b)=>b.start-a.start);
   for(const seg of segs){const resolved=resolveSegment(copy,seg);if(!resolved)continue;const start=textNodeAt(copy,resolved.start),end=textNodeAt(copy,resolved.end);if(!start||!end)continue;const range=document.createRange();range.setStart(start.node,start.offset);range.setEnd(end.node,end.offset);const mark=document.createElement('mark');mark.style.background='#f2e4aa';mark.style.color='inherit';mark.style.borderRadius='2px';mark.append(range.extractContents());range.insertNode(mark);}
   stage.append(copy);pieces++;
  }
  if(!pieces)return quoteCardFallback(anchor,'No source text in viewport.');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(stage)}</foreignObject></svg>`;
  const image=new Image();return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Image rendering timed out.')),3500);image.onload=()=>{clearTimeout(timeout);try{const scale=Math.min(1.65,1200/width),canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fffefa';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);resolve({data:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,kind:isRef?'dom-reference-viewport':'dom-reading-viewport',sourceKind:isRef?'reference':'lesson'});}catch(e){reject(e);}};image.onerror=()=>{clearTimeout(timeout);reject(Error('Browser refused the local source render.'));};image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
 }catch(e){return quoteCardFallback(anchor,String(e.message||e));}
};
currentComposerSnapshotHTML=function(){
 if(!composer)return '';if(!composer.captureWanted)return `<div class="snapshot-info"><button class="text-btn" data-action="restore-capture">${icon('camera','small')}${E('읽기 이미지 다시 첨부','Attach reading image')}</button></div>`;
 const heading=`<div class="snapshot-label"><span>${icon('camera','small')}${E('읽고 있던 부분','Your reading context')}</span><button class="text-btn" data-action="remove-capture">${E('첨부 제외','Remove')}</button></div>`;
 if(composer.capturePending)return heading+`<div class="snapshot-loading">${E('읽기 영역을 이미지로 남기는 중…','Capturing the reading area…')}</div>`;
 if(!composer.snapshot)return heading+`<div class="snapshot-info">${E('이미지 없음 · 인용문과 위치는 함께 남습니다.','No image · quotation and source position are preserved.')}</div>`;
 const fallback=!composer.snapshot.kind.startsWith('dom-');return heading+`<img class="snapshot-image" src="${composer.snapshot.data}" alt="${E('선택한 원문과 하이라이트의 읽기 영역 이미지','Reading-area image with the selected source passage')}" data-action="zoom-capture"><div class="snapshot-info">${fallback?E('인용 카드 · 브라우저가 화면 렌더링을 제한해 대체했습니다.','Quotation card · the browser limited capture rendering.'):E('선택한 원문 영역만 캡처 · 누르면 크게 보기','Source reading area only · tap to enlarge')}</div>`;
};
openComposer=function(anchor,{edit=null,resume=false,forceNew=false}={}){
 if(!anchor&&!resume&&!edit){toast(E('기록할 문장이나 성구를 먼저 선택해 주세요.','Choose a passage first.'),true);return;}
 let restored=false;
 if(edit)composer={id:edit.id,editId:edit.id,anchor:structuredClone(edit.anchor),body:edit.body,type:edit.type,scope:edit.scope,consent:edit.consent,captureWanted:!!edit.snapshot,snapshot:edit.snapshot||null,capturePending:false};
 else if((resume||(!forceNew&&state.draft))&&state.draft){pendingNewAnchor=anchor;composer={...structuredClone(state.draft),capturePending:false};restored=true;}
 else composer={id:uid(),editId:null,anchor:structuredClone(anchor),body:'',type:'insight',scope:'private',consent:false,captureWanted:state.view==='read'||reference.open,snapshot:null,capturePending:state.view==='read'||reference.open};
 const a=composer.anchor,isRef=isRefAnchor(a),l=lessonForAnchor(a)||currentLesson();
 const capturePromise=composer.capturePending?captureReadingRegion(a):null;
 const content=modalHead(edit?E('인사이트 수정','Edit insight'):E('마음에 남은 생각','A thought worth sharing'),E('읽던 부분 아래에 내 생각을 적고, 함께 나눠 보세요.','Your reading context above. Your own thought below.'))+`<div class="modal-body">${restored?`<div class="draft-banner"><span>${E('쓰던 생각을 불러왔어요.','Your draft has been restored.')}</span>${pendingNewAnchor?`<button class="text-btn" data-action="fresh-composer">${E('이 선택으로 새로 쓰기','Start from this selection')}</button>`:''}</div>`:''}<div class="composer-source-chip"><span class="source-icon">${icon(isRef?'book':'quote')}</span><div><strong>${esc(anchorLabel(a))}</strong><small>${isRef?esc(a.reference.edition):esc(l.title[a.language]||l.title.ko)}</small></div><span class="pill gray">${a.language==='ko'?'한국어':'English'}</span></div><div id="snapshotSlot" class="snapshot-wrap">${currentComposerSnapshotHTML()}</div><details class="source-context-details"><summary>${icon('link','small')}${E('인용문과 연결 위치 보기','Quotation & source position')}${icon('down','small')}</summary><blockquote>${esc(a.quote)}</blockquote><p>${E('원문 언어·버전·선택 범위를 함께 보존합니다.','Original language, version and selected range are preserved.')}</p><pre class="source-detail">${esc(JSON.stringify(a,null,2))}</pre></details><label class="composer-prompt" for="insightText"><span>${E('나의 생각','My thought')}</span><button type="button" class="text-btn" data-enhance="demo-fill">${E('예시 생각 넣기','Use a sample thought')}</button></label><textarea id="insightText" class="composer-text" maxlength="${MAX_TEXT}" placeholder="${E('이 말씀에서 무엇을 느꼈나요?\n짧은 생각, 경험, 질문도 좋아요.','What stood out to you?\nA small thought, experience or question is enough.')}">${esc(composer.body)}</textarea><div class="composer-count"><span id="draftStatus">${E('작성 중인 생각은 이 기기에 임시 저장돼요.','Drafts stay on this device.')}</span><span id="textCount">${composer.body.length} / ${MAX_TEXT}</span></div><div id="composerError" class="alert error" role="alert" hidden></div><div class="composer-audience">${icon('people')}<span>${E('나눌 곳','Sharing with')} · <strong>${E('우리 반 · 성인 주일학교','Our adult Sunday School class')}</strong></span></div><label class="checkline"><input type="checkbox" id="classConsent" ${composer.consent?'checked':''}><span>${E('주일학교 시간에 큰 화면으로 함께 읽어도 좋아요.','This may also be shown on the classroom screen.')}</span></label><p class="composer-help">${E('반원 공유와 수업 화면 사용은 별도예요. 언제든 변경할 수 있어요.','Class sharing and classroom display are separate choices. You can change them later.')}</p></div><footer class="modal-footer"><span class="privacy-line">${icon('lock','small')} ${E('시연 모드 · 실제 전송 없음','Demo only · not sent')}</span><div class="buttons"><button class="btn quiet" data-action="save-draft">${E('나중에','Later')}</button><button class="btn" data-enhance="keep-private">${E('나만 저장','Only me')}</button><button class="btn primary" data-enhance="share-insight">${icon('arrow','small')}${E('우리 반에 나누기','Share with class')}</button></div></footer>`;
 const token=showModal(content,{kind:'composer',size:'simple-composer'});$('#selectionToolbar').hidden=true;$('#insightText').focus({preventScroll:true});
 if(capturePromise)capturePromise.then(snapshot=>{if(modalSession!==token||!composer)return;composer.capturePending=false;if(composer.captureWanted)composer.snapshot=snapshot;$('#snapshotSlot').innerHTML=currentComposerSnapshotHTML();if(composer.body.trim())storeDraft();});
};
closeModal=function(keepDraft=true){oldCloseModal(keepDraft);setReferenceInert();};
function publishSimple(scope){
 if(!composer)return;composer.scope=scope;const id=composer.editId||composer.id;saveInsight();
 if($('#modal').open||!state.notes.some(n=>n.id===id))return;
 if(scope==='class'&&storageOK){$('.post-success')?.remove();const box=document.createElement('div');box.className='post-success';box.innerHTML=`<span>${icon('check','small')} ${E('이 데모의 반원 피드에 나눴어요.','Shared to the local demo feed.')}</span><button class="btn sm primary" data-enhance="view-post">${E('게시물 보기','View post')}</button>`;box.dataset.id=id;document.body.append(box);setTimeout(()=>box.remove(),10000);}
}
function sourceTag(a){return `<div class="note-source-tag">${icon(isRefAnchor(a)?'book':'quote','small')} ${esc(anchorLabel(a,lang()))}</div>`;}
noteCard=function(n,{compact=false,mine=false}={}){
 const liked=n.likes.includes('me'),queued=state.queue.includes(n.id),hasImage=!!n.snapshot&&!compact;
 return `<article class="note-card${compact?' compact':''}" data-note="${esc(n.id)}"><div class="note-head">${avatar(n)}<div><strong>${esc(authorName(n))}</strong><small>${n.demo?E('예시 기록','Sample reflection'):(n.owner==='me'?E('내가 남긴 기록','My reflection'):E('반원이 남긴 기록','Member reflection'))} · ${n.scope==='private'?E('나만 보기','Private'):E('반원 공유','Shared')}</small></div><span class="note-type ${esc(n.type)}">${typeLabel(n.type)}</span></div>${sourceTag(n.anchor)}${hasImage?`<img class="note-image" src="${n.snapshot.data}" alt="${E('기록할 때 읽던 원문 이미지','Source image attached to the reflection')}" data-enhance="note-image" data-id="${esc(n.id)}"><div class="note-image-label"><span>${n.snapshot.kind==='sample-quote-card'?E('시연 예시 · 인용 카드','Sample · quotation card'):n.snapshot.kind.startsWith('dom-')?E('읽기 영역 캡처','Reading-area capture'):E('인용 카드 · 캡처 대체','Quotation card · capture fallback')}</span><span>${E('누르면 크게 보기','Tap to enlarge')}</span></div><details class="note-quote-details"><summary>${E('인용문 텍스트 보기','Read the quotation text')}</summary><blockquote class="note-quote">${esc(noteQuote(n))}</blockquote></details>`:`<blockquote class="note-quote ${compact?'clamp':''}">${esc(noteQuote(n))}</blockquote>`}${!n.demo&&n.language!==lang()?`<div class="xlang-note">${E('작성한 언어 그대로 표시합니다.','Shown in the original writing language.')}</div>`:''}<p class="note-body ${compact?'clamp':''}">${esc(noteBody(n))}</p><div class="note-actions">${n.scope==='class'?`<button data-action="like" data-id="${esc(n.id)}" class="${liked?'active':''}" aria-pressed="${liked}" aria-label="${E('공감','Appreciate')}">${icon('heart')} ${n.likes.length}</button><button data-action="thread" data-id="${esc(n.id)}" aria-label="${E('댓글 보기','View replies')}">${icon('chat')} ${n.comments.length}</button>`:`<span>${icon('lock','small')}${E('비공개','Private')}</span>`}<button class="source-action" data-action="source" data-id="${esc(n.id)}">${E(isRefAnchor(n.anchor)?'참조자료로':'원문으로',isRefAnchor(n.anchor)?'Go to reference':'Go to passage')} ${icon('arrow')}</button></div>${!compact?`<div class="note-tail"><span>${n.anchor.language==='ko'?'한국어':'English'} · ${E('원문 위치 연결됨','Linked to source')}</span>${eligible(n)?`<span class="class-ready">${icon('screen','small')}${E('수업 나눔 허용','Classroom display allowed')}</span>`:''}</div>${mine?`<div class="actions-row" style="margin-top:13px"><button class="btn sm" data-action="edit-note" data-id="${esc(n.id)}">${icon('edit')}${E('수정','Edit')}</button><button class="btn sm danger" data-action="delete-note" data-id="${esc(n.id)}">${icon('trash')}${E('삭제','Delete')}</button></div>`:state.role==='teacher'&&eligible(n)?`<div class="actions-row" style="margin-top:13px"><button class="btn sm ${queued?'':'quiet'}" data-action="queue-toggle" data-id="${esc(n.id)}">${icon(queued?'check':'pin')}${queued?E('수업 나눔에 담김','Added to class'):E('수업 나눔에 담기','Add to class')}</button></div>`:''}`:''}</article>`;
};
function previewImage(anchor,label){
 const c=document.createElement('canvas');c.width=840;c.height=400;const ctx=c.getContext('2d');ctx.fillStyle='#fffefa';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#e7edde';ctx.fillRect(34,84,4,250);ctx.font='16px sans-serif';ctx.fillStyle='#789168';ctx.fillText(label,36,40);ctx.font='22px sans-serif';ctx.fillStyle='#365337';let line='',y=113;for(const ch of anchor.quote){if(ch==='\n'||ctx.measureText(line+ch).width>730){ctx.fillText(line,61,y);y+=39;line=ch==='\n'?'':ch;if(y>317){ctx.fillText('…',61,y);line='';break;}}else line+=ch;}if(line)ctx.fillText(line,61,y);ctx.font='12px sans-serif';ctx.fillStyle='#9ba58c';ctx.fillText('시연 예시 · 원문 인용 카드 / SAMPLE QUOTATION CARD',36,371);return {kind:'sample-quote-card',data:c.toDataURL('image/png'),width:840,height:400};
}
function seedV2(){
 if(state.v2seeded)return;state.v2seeded=true;
 for(const n of state.notes.filter(n=>n.demo))n.snapshot=previewImage(n.anchor,anchorLabel(n.anchor,n.anchor.language));
 const b=SCRIPTURES['ot/prov/3'],verses=[5,6],segments=verses.map(v=>({verse:v,blockId:'verse-'+v,start:0,end:b.verses.ko[v].length,exact:b.verses.ko[v],prefix:'',suffix:''}));
 const a={kind:'scripture',lessonKey:lessonKey(BASE),lessonId:BASE.id,version:b.revision,language:'ko',sectionId:BASE.blocks.find(b=>b.id==='b23').sectionId,sourceUrl:b.source.ko,churchSourceUrl:referenceURL(b.key,verses,'ko'),mode:'selection',quote:segments.map(s=>s.exact).join('\n\n'),segments,reference:{key:b.key,verses,edition:b.edition.ko,revision:b.revision},origin:{lessonKey:lessonKey(BASE),lessonId:BASE.id,version:BASE.version,blockId:'b22',sectionId:BASE.blocks.find(b=>b.id==='b23').sectionId,language:'ko'},offsetEncoding:'UTF-16 code units',confidence:'exact'};
 state.notes.unshift({id:'demo-scripture',owner:'sample-a',author:'반원 A',demo:true,language:'ko',body:'모든 답을 먼저 알아야만 걸을 수 있는 것은 아니라는 생각이 들었어요. 기도하고, 오늘 할 수 있는 작은 선을 선택하는 것이 주님을 신뢰하는 시작일 수 있겠습니다.',bodyI18n:{en:'I noticed that I do not need every answer before taking a step. Praying and choosing a small good thing today can be a beginning of trusting the Lord.'},type:'insight',scope:'class',consent:true,anchor:a,snapshot:previewImage(a,'잠언 3:5–6 · 개역한글'),likes:['sample-b'],comments:[],created:'2026-09-12T09:00:00Z'});
 state.queue.unshift('demo-scripture');saveState();
}
function flowStrip(){return `<div class="flow-strip" aria-label="${E('공부와 나눔의 흐름','Study and sharing flow')}"><button class="flow-step" data-enhance="demo-reading"><span class="step-no">1</span><span><span class="step-title">${E('말씀 읽기','Read')}</span><span class="step-sub">${E('공과와 참조 성구','Lesson & references')}</span></span></button>${icon('chevron')}<button class="flow-step" data-enhance="demo-write-reference"><span class="step-no">2</span><span><span class="step-title">${E('생각 남기기','Reflect')}</span><span class="step-sub">${E('캡처 아래 한마디','Image + your thought')}</span></span></button>${icon('chevron')}<button class="flow-step" data-enhance="demo-classroom"><span class="step-no">3</span><span><span class="step-title">${E('함께 나누기','Share')}</span><span class="step-sub">${E('우리 반에서, 수업에서','With your class')}</span></span></button></div>`;}
render=function(){
 oldRender();
 const bottom=$('.sidebar-bottom');if(bottom&&!JSON.parse(document.getElementById('cloud-config')?.textContent||'{}').url)bottom.insertAdjacentHTML('beforebegin',`<button class="demo-guide-btn" data-enhance="guide">${icon('play','small')}${E('3분 시연 가이드','3-minute demo guide')}</button>`);
 if(state.view==='read'){
  $$('.source-text a').forEach(a=>{if(parseReference(a.dataset.refUrl||a.href,a.textContent)){a.dataset.reference='true';a.title=E('옆에서 참조자료 읽기','Read beside the lesson');a.setAttribute('aria-haspopup','dialog');}});
  const intro=$('.reading .page-intro');if(intro){const action=$('[data-action="demo-select"]',intro);if(action){const wrap=document.createElement('div');wrap.className='demo-entry';action.replaceWith(wrap);wrap.append(action);wrap.insertAdjacentHTML('beforeend',`<button class="text-btn" data-enhance="demo-reference">${icon('split','small')}${E('성구 패널 체험','Try scripture panel')}</button>`);}}
  if($('.reader-origin')) $('.reader-origin').innerHTML=icon('link','small')+' '+E('성구·연차대회·교재 링크를 누르면 옆에서 읽습니다. 모든 읽기 영역에 인사이트를 남길 수 있어요.','Scriptures, talks and manuals open beside the lesson. Highlight and reflect in every reader.');
 }
 ensureReferenceShell();if(reference.open&&['read','library'].includes(state.view)){document.body.classList.add('scripture-open');renderReference();}else if(reference.open){closeReference({returnFocus:false});}
 if(state.view==='mine')renderJournalHighlights();
};
navigate=function(view){closeReference({returnFocus:false});$('.post-success')?.remove();oldNavigate(view==='bridge'?'read':view);};
setLanguage=function(language){const was=reference.open;oldLanguage(language);if(was){reference.pinnedRevision=null;reference.language=language;reference.selected=[];clearSelection();renderReference();} };
function renderJournalHighlights(){
 const host=$('.stream-wrap')||$('.workspace');if(!host)return;
 const hs=state.highlights.slice().reverse();const html=`<section class="journal-highlights"><h2>${E('나의 형광펜','My highlights')} <span class="pill">${hs.length}</span></h2><p>${E('생각을 작성하지 않고 표시한 문장도 이곳에 남아요. 반원에게 공유되지 않습니다.','Passages you highlighted without writing a reflection. These are private.')}</p><div class="highlight-list">${hs.length?hs.map(h=>`<article class="highlight-card"><div class="note-source-tag"><span class="highlight-dot"></span>${esc(anchorLabel(h.anchor))} · ${h.anchor.language==='ko'?'한국어':'English'}</div><blockquote>${esc(h.anchor.quote)}</blockquote><div class="buttons"><button class="btn sm" data-enhance="highlight-source" data-id="${esc(h.id)}">${E('원문으로','Go to source')}</button><button class="btn sm" data-enhance="highlight-insight" data-id="${esc(h.id)}">${icon('spark','small')}${E('인사이트 쓰기','Write an insight')}</button><button class="text-btn" data-enhance="highlight-delete" data-id="${esc(h.id)}">${E('표시 지우기','Remove')}</button></div></article>`).join(''):`<div class="empty-state"><p>${E('공과나 성구에서 문장을 선택하고 ‘형광펜’을 눌러 보세요.','Select text in the lesson or scriptures, then choose Highlight.')}</p></div>`}</div></section>`;host.insertAdjacentHTML('beforeend',html);
}
exportNotes=function(){
 const payload={schema:'together-insights-demo-v3',exportedAt:iso(),notice:'Private local demonstration data, not encrypted. Review before sharing.',notes:ownNotes(),highlights:state.highlights,referenceDocuments:allReferenceDocuments(),draft:state.draft,lessons:lessons(),scriptureChapters:Object.fromEntries([...new Set([...ownNotes().map(n=>n.anchor),...state.highlights.map(h=>h.anchor),state.draft?.anchor].filter(a=>isRefAnchor(a)).map(a=>a.reference.key))].filter(k=>SCRIPTURES[k]).map(k=>[k,SCRIPTURES[k]]))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Together_My_Journal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);toast(E('형광펜·기록·초안을 내보냈습니다. 비공개 내용이 포함되니 안전하게 보관하세요.','Exported highlights, reflections and drafts. Keep this private file secure.'));
};
renderPresentation=function(){
 const q=queueNotes();if(!q.length){endPresentation();return;}presentationIndex=Math.max(0,Math.min(presentationIndex,q.length-1));const n=q[presentationIndex];
 oldPresentation();if(!n.snapshot)return;
 const article=$('.presentation-content');article.classList.add('with-image');article.innerHTML=`<div><img class="presentation-image" src="${n.snapshot.data}" alt="${E('함께 읽는 원문 이미지','Source image for class discussion')}"><div class="presentation-image-note">${n.snapshot.kind==='sample-quote-card'?E('예시 기록 · 시연용 인용 카드','Sample reflection · demonstration quotation card'):E('작성자가 남긴 읽기 영역 이미지','Reading-area image saved by the author')}</div></div><div><div class="eyebrow">${esc(anchorLabel(n.anchor,lang()))}<br><span class="pill">${n.anchor.language==='ko'?'한국어':'English'} · ${E('수업 나눔 동의됨','Approved for class display')}</span></div><div class="insight-text">${esc(noteBody(n))}</div><div class="author">${showNames?avatar(n):icon('people')}<span>${showNames?esc(authorName(n)):E('한 반원의 인사이트','A class member’s insight')}${n.demo?' · '+E('예시','Example'):''}</span></div></div>`;
};
function showImage(snapshot,title){
 const d=document.createElement('dialog');d.className='modal wide image-viewer';d.setAttribute('aria-label',title);d.innerHTML=modalHead(esc(title),E('읽기 맥락은 이미지와 인용문으로 함께 보존됩니다.','The image and quotation preserve the reading context.')).replace('data-action="modal-close"','data-action="image-close"')+`<div class="modal-body"><img src="${snapshot.data}" alt="${esc(title)}"></div>`;document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();
}
zoomCapture=function(){if(composer?.snapshot)showImage(composer.snapshot,anchorLabel(composer.anchor));};
function demoReference({write=false}={}){
 if($('#modal').open)closeModal();
 if(state.activeLesson!==lessonKey(BASE)){state.activeLesson=lessonKey(BASE);currentSection='intro';saveState();}
 if(state.view!=='read')navigate('read');else render();
 const a=$$('.source-text a').find(a=>(a.dataset.refUrl||a.href).includes('/prov/3')&&(a.dataset.refUrl||a.href).includes('p5-p7'));
 if(a)a.closest('.passage').scrollIntoView({block:'center',behavior:'instant'});
 const parsed=parseReference(referenceURL('ot/prov/3',[5,6,7],lang()));
 openReference(parsed,openingOrigin(a));
 const title=$('#block-b21');if(title)scrollBy({top:title.getBoundingClientRect().top-118,behavior:'instant'});
 if(write){reference.selected=[5,6];selectedAnchor=referenceAnchor([5,6]);updateReferenceStatus();openComposer(selectedAnchor);}
}
function showGuide(){
 showModal(modalHead(E('오늘, 이렇게 보여 주세요.','A simple three-minute demonstration'),E('서버 연결 없이 공부에서 나눔까지 직접 체험할 수 있습니다.','Experience the complete flow without a server.'))+`<div class="modal-body"><div class="demo-guide-flow"><div class="demo-guide-item"><span class="step-no">1</span><div><strong>${E('공과 옆에서 성구 읽기','Read a reference beside the lesson')}</strong><p>${E('‘잠언 3:5–7’을 눌러 오른쪽 패널을 엽니다. 한국어/EN을 바꾸거나 장 전체를 읽어 보세요.','Open Proverbs 3:5–7 in the side panel. Switch Korean/English or read the whole chapter.')}</p><button class="btn sm" data-enhance="demo-reference">${E('성구 패널 열기','Open scripture panel')}</button></div></div><div class="demo-guide-item"><span class="step-no">2</span><div><strong>${E('형광펜 → 캡처 아래에 생각 남기기','Highlight → write below the capture')}</strong><p>${E('성구의 문장을 드래그하거나 절 번호 5와 6을 선택합니다. 인사이트를 누르면 이미지가 위에, 생각 입력란이 바로 아래에 나타납니다.','Select words, or tap verse numbers 5 and 6. Insight opens a captured image with a thought field directly underneath.')}</p><button class="btn sm" data-enhance="demo-write-reference">${E('선택한 성구로 작성해 보기','Try writing from the reference')}</button></div></div><div class="demo-guide-item"><span class="step-no">3</span><div><strong>${E('우리 반에 나누기','Share with the class')}</strong><p>${E('생각을 입력한 뒤 ‘우리 반에 나누기’를 누릅니다. 게시물에서 댓글·공감·성구로 돌아가기를 체험합니다.','Write a thought and press Share with class. Try replies, appreciation and returning to the original scripture.')}</p><button class="btn sm" data-enhance="guide-feed">${E('반원들의 인사이트 보기','View class insights')}</button></div></div><div class="demo-guide-item"><span class="step-no">4</span><div><strong>${E('주일학교 시간에 함께 읽기','Read together in Sunday School')}</strong><p>${E('수업 사용을 허용한 기록만 교사 보드에 담습니다. 발표를 시작하면 캡처와 생각이 큰 화면에 나옵니다.','Only author-approved reflections go onto the teaching board. Present the source image and insight on a large screen.')}</p><button class="btn sm primary" data-enhance="demo-classroom">${E('교사 화면 체험','Try the teacher view')}</button></div></div></div><div class="guide-notice">${E('이 브라우저에서만 저장되는 시연입니다. 반원 A·B·C는 가상의 예시이며, 실제 로그인·기기 간 공유는 연결되어 있지 않습니다.','This demonstration saves only in this browser. Members A, B and C are fictional. Authentication and cross-device sharing are not connected.')}</div><p class="notice-foot">${E('한국어 공과: 첨부 원문 / 영어 공과: 시연용 번역(공식 영문 아님). 성경 패널: 개역한글·KJV, 일부 관련 구절 수록.','Korean lesson: supplied text. English lesson: prototype translation, not the official edition. Scripture panel: KRV/KJV, with selected passages.')}</p><button class="text-btn" data-enhance="reset-demo">${E('시연 데이터 처음으로 되돌리기','Reset this demonstration')}</button></div>`,{size:'medium',kind:'guide'});
}
function demoClassroom(){
 if($('#modal').open)closeModal();state.role='teacher';const recentlyShared=ownNotes().filter(eligible).filter(n=>n.anchor.lessonKey===lessonKey(currentLesson()));for(const n of recentlyShared)if(!state.queue.includes(n.id))state.queue.push(n.id);saveState();navigate('classroom');
}
function fillSample(){
 if(!composer)return;const isGentle=composer.anchor.reference?.key==='ot/prov/15';const text=composer.anchor.language==='ko'?(isGentle?'어려운 대화를 할 때 먼저 부드럽게 대답하는 것이 이번 주의 작은 실천이 될 수 있겠다는 생각이 들었어요. 답하기 전에 잠깐 멈추고 주님께 도움을 구해 보려고 합니다.':'모든 답을 먼저 알아야만 걸을 수 있는 것은 아니라는 생각이 들었어요. 이번 주에는 선택하기 전에 먼저 기도하고, 오늘 할 수 있는 작은 선을 실천해 보려고 합니다.'):(isGentle?'A gentle answer could be my small step this week. I want to pause before replying and ask the Lord for help.':'I do not need every answer before taking a step. This week I want to pray before making a choice, then do the small good thing I can do today.');
 const input=$('#insightText');if(input.value.trim()&&!confirm(E('지금 쓴 생각을 예시 문장으로 바꿀까요?','Replace your current thought with sample text?')))return;input.value=text;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();
}
/* Capture-phase routing prevents scripture links from navigating away. */
document.addEventListener('click',event=>{
 const el=event.target.closest('[data-enhance]');
 if(el){if(el.disabled)return;event.preventDefault();event.stopImmediatePropagation();const action=el.dataset.enhance,id=el.dataset.id;
 switch(action){
  case 'ref-close':closeReference();break;
  case 'ref-origin':closeReference({origin:true});break;
  case 'ref-mode':reference.mode=el.dataset.mode;clearSelection();renderReference();if(reference.mode==='context'&&reference.verses.length)scrollReferenceTo(reference.verses[0]);break;
  case 'ref-language':reference.language=el.dataset.language;clearSelection();renderReference();break;
  case 'ref-chapter':reference.key=reference.key.split('/').slice(0,2).join('/')+'/'+Number(el.dataset.chapter);reference.verses=[];reference.mode='context';clearSelection();renderReference();break;
  case 'ref-select-verse':toggleVerse(Number(el.dataset.verse),event.shiftKey);break;
  case 'ref-clear':clearSelection();break;
  case 'ref-highlight':saveHighlight(selectedReferenceAnchor());break;
  case 'ref-insight':openComposer(selectedReferenceAnchor());break;
  case 'selection-highlight':saveHighlight(selectedAnchor||anchorFromSelection());break;
  case 'selection-insight':openComposer(selectedAnchor||anchorFromSelection());break;
  case 'share-insight':publishSimple('class');break;
  case 'keep-private':publishSimple('private');break;
  case 'demo-fill':fillSample();break;
  case 'demo-reference':demoReference();break;
  case 'demo-write-reference':demoReference({write:true});break;
  case 'demo-reading':if($('#modal').open)closeModal();navigate('read');break;
  case 'demo-classroom':demoClassroom();break;
  case 'guide':showGuide();break;
  case 'guide-feed':if($('#modal').open)closeModal();navigate('community');break;
  case 'view-post':{const noteID=el.closest('.post-success').dataset.id;navigate('community');const card=$(`[data-note="${noteID}"]`);card?.scrollIntoView({block:'center',behavior:'instant'});break;}
  case 'note-image':{const n=state.notes.find(n=>n.id===id);if(n?.snapshot)showImage(n.snapshot,anchorLabel(n.anchor));break;}
  case 'highlight-source':{const h=state.highlights.find(h=>h.id===id);if(h)goToAnchor(h.anchor);break;}
  case 'highlight-insight':{const h=state.highlights.find(h=>h.id===id);if(h){goToAnchor(h.anchor);openComposer(h.anchor);}break;}
  case 'highlight-delete':state.highlights=state.highlights.filter(h=>h.id!==id);saveState();refreshPreservingScroll();break;
  case 'reset-demo':if(confirm(E('이 v3 데모의 기록과 형광펜을 모두 지우고 처음 상태로 되돌릴까요? 다른 파일의 기존 기록은 지우지 않습니다.','Reset all notes and highlights in this v3 demo? Older versions are not affected.'))){closeModal(false);closeReference({returnFocus:false});state=initialState();state.highlights=[];state.referenceDocuments=[];if(typeof importPack==='function')importPack(DEPLOYED,{persist:false});seedV2();saveState();render();scrollTo(0,0);}break;
 }return;}
 const a=event.target.closest('.source-text a[href]');if(a){const p=parseReference(a.dataset.refUrl||a.href,a.textContent);if(p){event.preventDefault();event.stopImmediatePropagation();openReference(p,openingOrigin(a));return;}}
},true);
document.addEventListener('pointerdown',event=>{if(event.target.closest('#selectionToolbar,#referenceDrawer .reference-footer'))event.preventDefault();},true);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&reference.open&&!$('#modal').open&&!document.querySelector('.image-viewer[open]')){event.preventDefault();closeReference();}
 if(event.key==='Tab'&&reference.open&&innerWidth<=760&&!$('#modal').open&&!document.querySelector('.image-viewer[open]')){const focusables=$$('button:not([disabled]),a[href],[tabindex="0"]',$('#referenceDrawer')).filter(el=>el.offsetParent!==null);const first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('#referenceDrawer'))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
window.addEventListener('resize',()=>{if(reference.open)setReferenceInert();},{passive:true});
seedV2();ensureReferenceShell();render();
window.TogetherPrototype={...window.TogetherPrototype,reference,SCRIPTURES,parseReference,referenceAnchorFromSelection,saveHighlight,openReference,closeReference,goToAnchor,captureReadingRegion,getState:()=>state};
