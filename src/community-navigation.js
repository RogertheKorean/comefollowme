/* Shared history and shell navigation for lessons, questions and ward events. */
'use strict';
(()=>{
 ICONS.calendar='M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 18h2';
 const previousEntries=navEntries,previousNavigate=navigate,previousRender=render,previousAnchor=goToAnchor;
 const supported=new Set(['dashboard','read','community','mine','classroom','import','library']);
 navEntries=function(){const entries=previousEntries();return [entries.find(x=>x[0]==='dashboard'),['calendar','calendar',E('와드 일정','Ward calendar')],['prompts','chat',E('함께 생각하기','Study questions')],...entries.filter(x=>x[0]!=='dashboard')].filter(Boolean);};
 mobileNavHTML=function(){return `<nav class="mobile-bottom" aria-label="${E('빠른 탐색','Quick navigation')}">${[['dashboard','book',E('공과','Lessons')],['calendar','calendar',E('일정','Calendar')],['prompts','chat',E('질문','Questions')],['mine','note',E('내 기록','Journal')]].map(([v,i,label])=>`<button data-nav="${v}" class="${state.view===v?'active':''}" ${state.view===v?'aria-current="page"':''}>${icon(i)}<span>${label}</span></button>`).join('')}</nav>`;};
 render=function(...args){
  // Cloud refreshes must preserve a visitor's composing focus and mobile keyboard.
  const menuOpen=$('#sidebar')?.classList.contains('open'),menuScroll=$('#sidebar')?.scrollTop||0;
  const focused=document.activeElement,restore=focused?.id&&focused.closest('#app')&&focused.matches('input,textarea');
  const id=restore?focused.id:null,selection=restore?{start:focused.selectionStart,end:focused.selectionEnd}:null;
  const result=previousRender(...args);
  if(menuOpen){$('#sidebar')?.classList.add('open');$('#menuBackdrop')?.classList.add('active');if($('#sidebar'))$('#sidebar').scrollTop=menuScroll;}
  if(id){const replacement=document.getElementById(id);if(replacement){replacement.focus({preventScroll:true});try{if(selection.start!==null)replacement.setSelectionRange(selection.start,selection.end);}catch{}}}
  if(state.view==='calendar')void window.TogetherCalendar?.afterRender();
  return result;
 };
 function writeURL(path,replace=false){if(location.pathname+location.search+location.hash===path)return;history[replace?'replaceState':'pushState']({togetherView:state.view},'',path);}
 function startView(view){window.TogetherDrafts?.flush();$('#sidebar')?.classList.remove('open');$('#menuBackdrop')?.classList.remove('active');if(state.view!==view){window.TogetherPrompts?.suspend();window.TogetherCalendar?.suspend();}if(typeof closeReference==='function')closeReference();clearSelection();}
 function openPrompts({push=true}={}){startView('prompts');if(push)writeURL('/questions');window.TogetherPrompts.showCollection({push:false});saveState();window.scrollTo(0,0);}
 function openPrompt(slug,{push=true}={}){startView('prompts');if(push)writeURL('/p/'+encodeURIComponent(slug));const pending=window.TogetherPrompts.open(slug,{push:false});saveState();window.scrollTo(0,0);return pending;}
 function openCalendar({push=true}={}){startView('calendar');if(push)writeURL('/calendar');window.TogetherCalendar.showCollection({push:false});saveState();window.scrollTo(0,0);}
 function openEvent(slug,{push=true}={}){startView('calendar');if(push)writeURL('/e/'+encodeURIComponent(slug));const pending=window.TogetherCalendar.open(slug,{push:false});saveState();window.scrollTo(0,0);return pending;}
 navigate=function(view,...args){if(view==='prompts')return openPrompts();if(view==='calendar')return openCalendar();startView(view);const result=previousNavigate(view,...args);if(state.view===view)writeURL(view==='dashboard'?'/':'/?view='+encodeURIComponent(view));return result;};
 goToAnchor=function(anchor,...args){const result=previousAnchor(anchor,...args);if(state.view==='read')writeURL('/?view=read');return result;};
 function fromLocation(){const path=location.pathname.replace(/\/$/,'')||'/';let match;if((match=path.match(/^\/p\/([^/]+)$/)))return openPrompt(match[1],{push:false});if((match=path.match(/^\/e\/([^/]+)$/)))return openEvent(match[1],{push:false});if(path==='/questions')return openPrompts({push:false});if(path==='/calendar')return openCalendar({push:false});const query=new URLSearchParams(location.search),requested=query.get('view'),view=supported.has(requested)?requested:'dashboard';startView(view);previousNavigate(view);}
 async function share(title,path){const value=new URL(path,location.origin).href;try{if(navigator.share){await navigator.share({title,url:value});return;}if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);toast(E('공유 주소를 복사했습니다.','Share link copied.'));return;}}catch(error){if(error?.name==='AbortError')return;}showModal(modalHead(E('공유 주소','Share link'),E('아래 주소를 복사해 보내세요.','Copy the address below to share it.'))+`<div class="modal-body"><input id="communityShareURL" style="width:100%;font-size:16px;min-height:46px" readonly value="${esc(value)}" aria-label="${E('공유 주소','Share URL')}"></div>`,{kind:'community-share',size:'medium'});$('#communityShareURL')?.select();}
 window.TogetherNavigation={openPrompts,openPrompt,openCalendar,openEvent,share,navigate:(view)=>navigate(view)};
 window.addEventListener('popstate',()=>{if($('#modal')?.open)closeModal(false);fromLocation();});
 window.addEventListener('online',()=>{if(state.view==='calendar')void window.TogetherCalendar.refresh();if(state.view==='prompts')void window.TogetherPrompts.refresh({render:true});});
 let refreshing=false;
 async function refreshCommunity(){if(refreshing||document.hidden||$('#modal')?.open||window.TogetherPrompts.getState().replySubmitting||window.TogetherCalendar.getState().busy||document.activeElement?.matches('input,textarea,[contenteditable=true]')||!window.getSelection()?.isCollapsed)return;const view=state.view;if(!['prompts','calendar'].includes(view))return;refreshing=true;try{await (view==='prompts'?window.TogetherPrompts:window.TogetherCalendar).refresh({render:false});if(state.view===view)refreshPreservingScroll();}finally{refreshing=false;}}
 setInterval(()=>void refreshCommunity(),30000);
 window.addEventListener('focus',()=>void refreshCommunity());
 // Do not rewrite auth callback search/hash tokens during the first render.
 fromLocation();
})();
