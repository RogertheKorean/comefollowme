/* Staff lesson authoring: source -> extracted details -> reviewed public revision. */
'use strict';
(function(){
 const fields={importKO:'ko',importEN:'en',importTitleKO:'titleKO',importTitleEN:'titleEN',importDate:'date',importURL:'url'};
 let draft=null,actor=null,parsed=null,reviewed=null,busy=false,error='',notice='',fileRead=0;
 const userId=()=>window.TogetherCloud?.user?.id||null;
 const allowed=()=>window.TogetherAccess?.can('content')===true;
 const fresh=()=>({ko:'',en:'',titleKO:'',titleEN:'',date:'',url:'',id:null,editing:false,expectedVersion:null,analyzed:'',alignment:false,rights:false});
 const contentKey=d=>JSON.stringify([d.ko,d.en]);
 const reviewKey=d=>JSON.stringify([d.ko,d.en,d.titleKO,d.titleEN,d.date,d.url,d.id,d.expectedVersion]);
 function session(){
  if(!draft||actor!==userId()){
   actor=userId();draft=fresh();parsed=null;reviewed=null;error='';notice='';
   if(actor)try{const saved=JSON.parse(window.TogetherDrafts?.read('lesson-import','editor')?.body||'null');if(saved&&typeof saved==='object'){
    for(const key of ['ko','en','titleKO','titleEN','date','url'])if(typeof saved[key]==='string')draft[key]=saved[key].slice(0,key==='ko'||key==='en'?400000:key==='url'?4096:160);
    if(typeof saved.id==='string'&&/^[-\w]{1,100}$/.test(saved.id))draft.id=saved.id;
    if(typeof saved.expectedVersion==='string'&&/^[-\w]{1,100}$/.test(saved.expectedVersion))draft.expectedVersion=saved.expectedVersion;
    draft.editing=saved.editing===true;
    if(saved.analyzed===contentKey(draft))draft.analyzed=saved.analyzed;
    notice=E('작성 중이던 공과를 복원했습니다. 게시 전 미리보기를 다시 확인하세요.','Your unfinished lesson was restored. Preview it again before publishing.');
   }}catch{}
  }
  return draft;
 }
 function persist(){if(actor&&draft)window.TogetherDrafts?.save('lesson-import','editor',{body:JSON.stringify({...draft,alignment:false,rights:false})});}
 function field(id,label,type='text',max=160){return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" maxlength="${max}" value="${esc(draft[fields[id]])}" placeholder="${E('본문 분석 후 확인하거나 직접 입력','Review extracted details or enter manually')}"></label>`;}
 function html(){
  if(!allowed())return '';const d=session();const available=latestLessons();
  return `<main class="workspace import-workspace"><div class="stream-wrap">${pageIntro(E('본문을 넣고, 공과를 게시하세요.','Add the text. Publish a lesson.'),E('본문 분석 → 기본 정보 확인 → 미리보기와 게시','Analyze text → review details → preview and publish'))}
  <fieldset class="import-form" ${busy?'disabled':''}>
  <div class="panel import-existing"><label class="field"><span>${E('기존 공과 수정','Edit an existing lesson')}</span><select id="importLessonPicker"><option value="">${E('수정할 공과 선택','Choose a lesson to edit')}</option>${available.map(l=>`<option value="${esc(lessonKey(l))}">${esc(l.title[lang()]||l.title.ko)} · ${esc(l.date[lang()]||l.date.ko)}</option>`).join('')}</select></label><button class="btn" data-import="load">${E('선택한 공과 불러오기','Load selected lesson')}</button><button class="text-btn" data-import="new">${E('새 공과 작성','Start a new lesson')}</button></div>
  <section class="panel" id="importSourceSection"><h2>${E('1. 원문 넣고 분석하기','1. Add and analyze the text')}</h2><p class="help">${E('웹페이지에서 본문을 복사해 붙여 넣으면 제목·문단·링크를 유지합니다. Markdown이나 텍스트 파일도 사용할 수 있습니다. 본문을 분석하면 공과 기본 정보를 채웁니다.','Copy and paste the text from a webpage to keep its headings, paragraphs and links. Markdown and text files also work. Analyze the text to fill the lesson details.')}</p><p class="help" id="importPasteStatus" role="status"></p>
  <div class="fields-two"><div><label class="field"><span>한국어 · Markdown</span><textarea id="importKO" class="code-area" maxlength="400000" aria-label="한국어 Markdown" placeholder="${E('한국어 공과 본문을 붙여 넣으세요.','Paste the Korean lesson text.')}">${esc(d.ko)}</textarea></label><label class="field"><span>${E('한국어 파일 선택','Korean Markdown file')}</span><input type="file" id="fileKO" accept=".md,.txt,text/plain,text/markdown"></label></div><div><label class="field"><span>${E('English · Markdown (선택)','English · Markdown (optional)')}</span><textarea id="importEN" class="code-area" maxlength="400000" aria-label="English Markdown" placeholder="${E('영어 원문이 없으면 비워 두세요.','Leave blank if English is unavailable.')}">${esc(d.en)}</textarea></label><label class="field"><span>${E('영어 파일 선택','English Markdown file')}</span><input type="file" id="fileEN" accept=".md,.txt,text/plain,text/markdown"></label></div></div>
  <button class="btn primary" data-import="analyze">${icon('spark')}${E('본문 분석 · 기본 정보 채우기','Analyze text and fill details')}</button></section>
  <section class="panel" id="importDetailsSection"><h2>${E('2. 공과 기본 정보 확인','2. Review lesson details')}</h2><p class="help">${E('찾지 못한 항목은 비워 둡니다. 자동 입력된 값도 자유롭게 수정할 수 있습니다.','Missing details stay blank. You can edit every extracted value.')}</p><p id="importNotice" class="import-status" role="status">${esc(notice||E('1번에서 본문을 분석해 주세요.','Analyze the text in step 1.'))}</p>
  <div class="fields-two">${field('importTitleKO',E('한국어 제목','Korean title'))}${field('importTitleEN',E('영어 제목 (선택)','English title (optional)'))}</div><div class="fields-two">${field('importDate',E('공과 기간','Lesson date'), 'text',100)}${field('importURL',E('공과 원문 URL','Lesson source URL'),'url',4096)}</div><p class="help">${E('원문 주소가 본문에 없다면 직접 입력하세요. 참조 성구나 이미지 주소는 공과 원문 주소로 사용하지 않습니다.','Enter the lesson URL if it is absent from the text. Scripture and image references are not treated as the lesson URL.')}</p></section>
  <section class="panel" id="importReviewSection"><h2>${E('3. 미리 보고 게시','3. Preview and publish')}</h2><button class="btn" data-import="review">${icon('eye')}${E('게시 전 미리보기','Preview before publishing')}</button><div id="importPreview">${reviewed?previewHTML(reviewed.lesson):''}</div>
  <label class="checkline"><input id="importAlignment" type="checkbox" ${d.alignment?'checked':''}><span>${E('공과 기본 정보와 본문을 확인했습니다. 두 언어를 넣었다면 문단별 내용과 순서도 확인했습니다.','I reviewed the details and text, including paragraph order and meaning when both languages are present.')}</span></label><label class="checkline"><input id="importRights" type="checkbox" ${d.rights?'checked':''}><span>${E('이 자료를 사이트 방문자에게 공개할 수 있는지 확인했습니다.','I have confirmed this material can be shared with site visitors.')}</span></label>
  <p class="help">${E('게시하면 모든 방문자의 주별 공과에 표시됩니다. 수정본을 게시해도 이전 공과 버전과 그 기록은 보존됩니다.','Publishing adds the lesson to everyone’s weekly dashboard. Earlier revisions and their reflections remain available.')}</p><div id="importError" class="alert error" role="alert" ${error?'':'hidden'}>${esc(error)}</div><button class="btn primary" data-import="publish" ${busy||!reviewed?'disabled':''}>${icon('upload')}${busy?E('게시 중…','Publishing…'):d.expectedVersion?E('수정 내용 게시','Publish changes'):E('공과 게시','Publish lesson')}</button><p class="help" id="importDraftStatus" role="status">${E('작성 중인 내용은 이 기기에 임시 저장됩니다. 게시 전에는 공개되지 않습니다.','Unfinished work is saved on this device. It remains private until you publish.')}</p></section></fieldset></div></main>`;
 }
 function invalidate(){reviewed=null;draft.alignment=false;draft.rights=false;error='';for(const id of ['importAlignment','importRights'])if($('#'+id))$('#'+id).checked=false;if($('#importPreview'))$('#importPreview').innerHTML='';if($('[data-import="publish"]'))$('[data-import="publish"]').disabled=true;if($('#importError'))$('#importError').hidden=true;}
 function paint(){if(state.view==='import')refreshPreservingScroll();}
 function fail(message){error=message;const target=$('#importError');if(target){target.textContent=message;target.hidden=false;target.scrollIntoView({block:'nearest'});}else toast(message,true);}
 function getBlocks(){const d=session();if(!d.ko.trim())throw Error(E('한국어 원문을 입력해 주세요.','Enter the Korean text.'));const ko=parseImportBlocks(d.ko),en=d.en.trim()?parseImportBlocks(d.en):{blocks:[],sections:[]};if(!ko.blocks.length)throw Error(E('읽을 수 있는 문단이 없습니다.','No readable paragraphs found.'));return {ko,en};}
 function analyze(){if(!allowed()||busy)return;const d=session();try{
  parsed=getBlocks();const key=contentKey(d),same=d.analyzed===key;let warnings=[];
  if(!same){const m=window.TogetherImportModel.extractMetadata({ko:d.ko,en:d.en});warnings=m.warnings||[];Object.assign(d,{titleKO:m.title.ko,titleEN:m.title.en,date:m.date,url:m.sourceUrl});d.analyzed=key;}
  const missing=[[d.titleKO,E('한국어 제목','Korean title')],[d.date,E('기간','dates')],[d.url,E('원문 URL','source URL')]].filter(([v])=>!v).map(([,label])=>label);
  notice=missing.length?E(`본문을 분석했습니다. ${missing.join(' · ')}은 직접 입력해 주세요.`,`Text analyzed. Please enter: ${missing.join(', ')}.`):E('기본 정보를 채웠습니다. 게시 전에 내용을 확인해 주세요.','Details are filled in. Review them before publishing.');
  if(warnings.some(w=>['invalid-date','ambiguous-date'].includes(w)))notice+=' '+E('날짜가 올바른지 확인해 주세요.','Please verify the dates.');
  const linkCounts=['ko','en'].filter(l=>d[l].trim()).map(l=>({label:l==='ko'?'한국어':'English',count:ReferenceEngine.extractLinks(d[l]).length}));
  notice+=' '+E('본문 링크: ','Links in the text: ')+linkCounts.map(l=>`${l.label} ${l.count}`).join(' · ')+'.';
  if(linkCounts.some(l=>!l.count))notice+=' '+E('링크가 0개인 본문은 웹 원문에서 다시 복사하거나 Markdown 링크를 넣어 주세요. 주소가 없는 일반 텍스트에서는 링크를 복원할 수 없습니다.','For text with no links, copy it again from the webpage or add Markdown links. Plain text without addresses cannot restore the original links.');
  invalidate();persist();paint();$('#importDetailsSection')?.scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){fail(e.message);}}
 function canonical(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return '';return u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}}
 async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 async function review(){if(!allowed()||busy)return;const d=session(),who=actor;try{
  if(d.analyzed!==contentKey(d))throw Error(E('본문이 바뀌었습니다. 1번의 본문 분석을 먼저 눌러 주세요.','Analyze the current text in step 1 first.'));
  const blocks=getBlocks(),before=reviewKey(d);parsed=blocks;if(blocks.en.blocks.length&&blocks.en.blocks.length!==blocks.ko.blocks.length)throw Error(E('두 언어의 문단 수가 다릅니다. 순서를 맞추거나 영어를 비워 주세요.','Paragraph counts differ. Align the two texts or leave English blank.'));
  if(!d.titleKO.trim()||!d.date.trim()||!canonical(d.url))throw Error(E('한국어 제목·기간·올바른 HTTPS 공과 원문 URL을 입력해 주세요.','Enter a Korean title, dates and a valid HTTPS lesson URL.'));
  await window.TogetherPublishing.ready;
  if(userId()!==who||draft!==d||before!==reviewKey(d))return;
  if(!d.id){const match=latestLessons().find(l=>canonical(l.sourceUrl.ko)===canonical(d.url));d.id=match?.id||'import-'+(await digest(canonical(d.url))).slice(0,24);d.expectedVersion=window.TogetherPublishing.getLatest(d.id)?.version||null;}
  const key=reviewKey(d),version=await digest(JSON.stringify([d.id,d.expectedVersion,d.ko,d.en,d.titleKO.trim(),d.titleEN.trim(),d.date.trim(),d.url.trim()]));
  if(userId()!==who||draft!==d||key!==reviewKey(d))return;
  const sourceKO=new URL(d.url),sourceEN=new URL(d.url);sourceKO.searchParams.set('lang','kor');sourceEN.searchParams.set('lang','eng');
  const sections=blocks.ko.sections.map(s=>({...s}));for(const s of sections){const i=blocks.ko.blocks.findIndex(b=>b.sectionId===s.id&&/^#{2,3}\s/.test(b.raw));if(i>=0&&blocks.en.blocks[i])s.en=plain(blocks.en.blocks[i].raw);}
  const lesson=ReferenceEngine.validateLesson({id:d.id,version,title:{ko:d.titleKO.trim(),en:d.en.trim()?d.titleEN.trim():''},date:{ko:d.date.trim(),en:d.date.trim()},sourceUrl:{ko:sourceKO.href,en:d.en.trim()?sourceEN.href:''},sourceLabel:'Published Markdown',translationStatus:'user-provided-unverified',alignment:d.en.trim()?'user-confirmed-block-pairing':'korean-only',raw:{ko:d.ko,en:d.en},sections,blocks:blocks.ko.blocks.map((b,i)=>({id:b.id,conceptId:`${d.id}-${version}-${i}`,sectionId:b.sectionId,kind:b.kind,ko:b.raw,en:blocks.en.blocks[i]?.raw||''}))});
  reviewed={key,lesson};error='';persist();paint();$('#importPreview')?.scrollIntoView({block:'start',behavior:'smooth'});
 }catch(e){fail(e.message);}}
 function previewHTML(l){return `<article class="import-reading-preview"><div class="eyebrow">${E('방문자에게 표시될 내용','VISITOR PREVIEW')}</div><h2>${esc(l.title.ko)}</h2><p>${esc(l.date.ko)}</p><a href="${esc(l.sourceUrl.ko)}" target="_blank" rel="noopener noreferrer">${E('공과 원문 열기','Open original lesson')}${icon('external','small')}</a><p class="help">${l.blocks.length} ${E('문단 · 아래에서 전체 내용을 확인하세요.','paragraphs · review the complete text below.')}</p><div class="import-paragraphs">${l.blocks.map((b,i)=>`<section class="import-pair"><small>${i+1}</small><div>${markdown(b.ko)}</div>${l.raw.en?`<div lang="en">${markdown(b.en)}</div>`:''}</section>`).join('')}</div></article>`;}
 async function publish(){if(!allowed()||busy)return;const d=session(),who=actor,packet=reviewed;
  if(!packet||packet.key!==reviewKey(d)){fail(E('현재 내용으로 미리보기를 다시 확인해 주세요.','Preview the current content before publishing.'));return;}
  if(!d.alignment||!d.rights){fail(E('본문 검토와 공개 확인을 모두 선택해 주세요.','Confirm both the content review and permission to publish.'));return;}
  busy=true;error='';paint();try{
   const lesson=await window.TogetherPublishing.publish(packet.lesson,{expectedVersion:d.expectedVersion});
   if(userId()!==who||draft!==d)return;
   window.TogetherDrafts?.clear('lesson-import','editor');draft=fresh();parsed=null;reviewed=null;notice='';state.activeLesson=lessonKey(lesson);currentSection='intro';saveState();navigate('dashboard');toast(E('공과를 게시했습니다. 모든 방문자가 볼 수 있습니다.','Lesson published. It is visible to every visitor.'));
  }catch(e){if(userId()===who&&draft===d){error=['40001','PT409'].includes(e.code)||/conflict|changed|stale/i.test(e.message||'')?E('다른 담당자가 이 공과를 수정했습니다. 입력 내용은 유지했습니다. 최신 공과를 불러와 변경 사항을 확인해 주세요.','Another editor updated this lesson. Your work is kept. Load the latest lesson and review the changes.'):e.code==='invalid_lesson_size'?E('공과 분량이 게시 한도(2.5 MB)를 넘습니다. 본문을 나누거나 불필요한 내용을 줄여 주세요.','This lesson exceeds the 2.5 MB publishing limit. Split the material or remove unnecessary text.'):e.code==='42501'?E('게시 권한을 확인해 주세요. 관리자 또는 콘텐츠 담당자만 게시할 수 있습니다.','Only an administrator or content editor can publish.'):E('게시 결과를 확인하지 못했습니다. 입력 내용은 유지했습니다. 연결을 확인한 뒤 다시 게시해 주세요.','Publication could not be confirmed. Your work is kept. Check your connection and try publishing again.');}}
  finally{busy=false;paint();}
 }
 function loadSelected(){if(busy||!allowed())return;const selected=$('#importLessonPicker')?.value,l=lessons().find(x=>lessonKey(x)===selected);if(!l)return;draft={...fresh(),ko:l.raw.ko,en:l.raw.en,titleKO:l.title.ko,titleEN:l.title.en,date:l.date.ko,url:l.sourceUrl.ko,id:l.id,editing:true,expectedVersion:window.TogetherPublishing?.getLatest(l.id)?.version||null};draft.analyzed=contentKey(draft);parsed=null;reviewed=null;error='';notice=E('공과를 불러왔습니다. 수정한 뒤 미리보기를 확인하고 게시하세요.','Lesson loaded. Edit, preview and publish your changes.');persist();paint();}
 function bind(){
  for(const [id,key]of [['fileKO','ko'],['fileEN','en']])$('#'+id)?.addEventListener('change',async e=>{const f=e.target.files[0],d=session(),who=actor,token=++fileRead;if(!f)return;if(f.size>400000){fail(E('400 KB 이하의 Markdown 또는 텍스트 파일을 선택해 주세요.','Choose a Markdown or text file under 400 KB.'));return;}try{const text=await f.text();if(d!==draft||who!==userId()||token!==fileRead)return;d[key]=text;if(!d.editing){d.id=null;d.expectedVersion=null;}invalidate();persist();paint();}catch{fail(E('파일을 읽지 못했습니다.','Could not read the file.'));}});
 }
 document.addEventListener('paste',event=>{
  const target=event.target;if(!['importKO','importEN'].includes(target.id)||state.view!=='import'||busy||!allowed()||!event.clipboardData)return;
  try{
   const html=event.clipboardData.getData('text/html'),text=event.clipboardData.getData('text/plain');if(!html)return;
   const sourceURL=html.match(/^SourceURL:([^\r\n]+)/m)?.[1]||'';
   const result=window.TogetherClipboardImport.transformPaste({html,text,sourceURL});if(!result.converted)return;
   const start=target.selectionStart,end=target.selectionEnd;
   if(target.value.length-(end-start)+result.markdown.length>target.maxLength){event.preventDefault();toast(E('본문이 입력 한도를 넘습니다. 더 작은 부분을 복사해 주세요. 기존 내용은 유지했습니다.','The text exceeds the input limit. Copy a smaller section. Your existing text is unchanged.'),true);return;}
   target.setRangeText(result.markdown,start,end,'end');event.preventDefault();target.dispatchEvent(new Event('input',{bubbles:true}));
   const message=result.linkCount?E(`서식과 링크 ${result.linkCount}개를 유지해 붙여 넣었습니다. 본문 분석을 눌러 주세요.`,`Pasted with formatting and ${result.linkCount} links. Analyze the text next.`):E('서식을 유지해 붙여 넣었습니다. 복사된 내용에 링크는 없었습니다.','Pasted with formatting. The copied content contained no links.');
   const status=$('#importPasteStatus');if(status)status.textContent=message;
  }catch{/* Keep the browser's plain-text paste when rich conversion is unavailable. */}
 });
 document.addEventListener('input',event=>{const key=fields[event.target.id];if(!key||state.view!=='import'||busy)return;const d=session();d[key]=event.target.value;if(!d.editing&&['ko','en','url'].includes(key)){d.id=null;d.expectedVersion=null;}if(key==='ko'||key==='en')fileRead++;invalidate();persist();});
 document.addEventListener('change',event=>{if(event.target.id==='importAlignment'||event.target.id==='importRights'){session()[event.target.id==='importAlignment'?'alignment':'rights']=event.target.checked;}});
 document.addEventListener('click',event=>{const action=event.target.closest('[data-import]')?.dataset.import;if(!action)return;if(action==='analyze')analyze();if(action==='review')void review();if(action==='publish')void publish();if(action==='load')loadSelected();if(action==='new'&&!busy&&allowed()){window.TogetherDrafts?.clear('lesson-import','editor');draft=fresh();parsed=null;reviewed=null;notice='';error='';paint();}});
 document.addEventListener('together:draft-status',event=>{if(event.detail.kind!=='lesson-import')return;const node=$('#importDraftStatus');if(node)node.textContent=event.detail.status==='error'?E('이 기기에 임시 저장하지 못했습니다. 입력 내용은 화면에 남아 있습니다.','Could not save the draft on this device. Your text is still on screen.'):event.detail.status==='saved'?E('이 기기에 임시 저장됨 · 게시 전에는 공개되지 않습니다.','Draft saved on this device · private until published.'):E('입력 중…','Typing…');});
 window.TogetherImporter={html,analyze,review,publish,bind,getDraft:()=>({...session()})};
 importHTML=html;bindFileInputs=bind;previewImport=review;applyImport=publish;
})();
