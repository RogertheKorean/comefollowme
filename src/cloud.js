/* Visitors participate immediately; email sign-in is reserved for operator tools. */
'use strict';
const cloudConfig=JSON.parse(document.getElementById('cloud-config').textContent);
const cloud={enabled:!!(cloudConfig.url&&cloudConfig.key),client:null,user:null,ready:false,busy:false,status:'connecting',revision:0,lastJSON:'',threadId:null,recovery:false};
window.TogetherCloud=cloud;
if(cloud.enabled){
 cloud.client=window.supabase.createClient(cloudConfig.url,cloudConfig.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}});
 const model=window.TogetherCloudModel;
 const localSave=saveState,oldShared=sharedNotes,oldTopbar=topbarHTML,oldSidebar=sidebarHTML,oldCommunity=communityHTML,oldMine=mineHTML,oldShowThread=showThread,oldAbout=showAbout;
 const noteSelect='*,together_comments(id,owner_id,author,body,created_at),together_reactions(owner_id)';
 // Cloud records are fetched for the current identity, never cached as another user's "me".
 state.notes=state.notes.filter(n=>!n.demo&&!n.remote);
 state.queue=[];
 saveState=function(){const all=state.notes;try{state.notes=all.filter(n=>!n.remote);return localSave();}finally{state.notes=all;}};
 sharedNotes=function(){return oldShared().filter(n=>n.remote);};
 let localName='';try{localName=localStorage.getItem('together-participant-name')||'';}catch{}
 const namedUser=()=>cloud.user&&!cloud.user.is_anonymous;
 function displayName(){return (cloud.user?.user_metadata?.display_name||localName||E('익명','Anonymous')).slice(0,50);}
 function participantName(){const saved=String(cloud.user?.user_metadata?.display_name||'').trim().slice(0,50);return namedUser()?saved:localName||(['익명','Anonymous'].includes(saved)?'':saved);}
 cloud.participantName=participantName;
 function rememberName(value){localName=String(value||'').trim().slice(0,50);try{localStorage.setItem('together-participant-name',localName);}catch{}document.dispatchEvent(new CustomEvent('together:participant-name'));return localName;}
 function nameField(){return namedUser()?'':`<label class="participant-name">${E('이름 또는 별명 (선택)','Name or nickname (optional)')}<input data-participant-name autocomplete="nickname" maxlength="50" value="${esc(localName||cloud.user?.user_metadata?.display_name||'')}" placeholder="${E('비워 두면 익명으로 표시됩니다','Leave blank to post anonymously')}"></label>`;}
 function connectionLabel(){return cloud.status==='error'?E('연결 확인 필요','Connection interrupted'):cloud.busy?E('저장 중…','Saving…'):cloud.status==='connecting'?E('연결 중…','Connecting…'):E('온라인 학습 공간','Connected');}
 topbarHTML=function(){return oldTopbar().replace(/<div class="demo-badge">[\s\S]*?<\/div>/,`<div class="cloud-status ${cloud.status}" role="status"><span class="status-dot"></span>${connectionLabel()}</div>`).replace(/<button class="avatar" data-action="about"[\s\S]*?<\/button>/,`<button class="btn sm account-button" data-cloud="${namedUser()?'account':'profile'}">${icon('people','small')}<span>${namedUser()||localName||cloud.user?.user_metadata?.display_name?esc(displayName()):E('이름 설정','Your name')}</span></button>`);};
 sidebarHTML=function(){return oldSidebar().replace(/<div class="sidebar-note">[\s\S]*?<\/div>/,`<div class="sidebar-note">${E('로그인 없이 함께 읽고 나누세요.<br>공유 글은 사이트 방문자에게 공개됩니다.','Read and share without signing in.<br>Shared posts are public to site visitors.')}<button class="text-btn operator-entry" data-cloud="account">${icon('lock','small')}${E('운영자 로그인 · 관리','Operator sign-in')}</button></div>`);};
 communityHTML=function(){return oldCommunity().replace(/(<div class="stream-banner">[\s\S]*?<p>)[\s\S]*?(<\/p>)/,`$1${E('공유 글과 댓글은 이 사이트 방문자에게 공개됩니다. 개인정보나 민감한 내용은 올리지 마세요.','Shared posts and replies are public to site visitors. Do not post personal or sensitive information.')}$2`).replace(/<div class="demo-strip">[\s\S]*?<\/div>/,`<div class="demo-strip">${icon('chat','small')}${E('로그인 없이 글과 댓글을 남겨 보세요. 이름은 선택 사항이며, 나눔은 온라인에 저장됩니다.','Post and reply without signing in. Your name is optional, and contributions are saved online.')}</div>`).replace(/<p class="notice-foot">[\s\S]*?<\/p>/,`<p class="notice-foot">${E('나만 보기 기록은 작성자에게만 표시되며 이 피드에는 나타나지 않습니다.','Private reflections are visible only to their author and never appear in this feed.')}</p>`);};
 mineHTML=function(){return oldMine().replace(/<div class="demo-strip">[\s\S]*?<\/div>/,`<div class="demo-strip">${icon('lock','small')}${namedUser()?E('같은 계정으로 로그인한 기기에서 내 기록을 불러올 수 있습니다.','Your journal is available on devices signed into this account.'):E('로그인 없이 남긴 내 기록입니다. 이 브라우저에서 다시 열고 수정할 수 있습니다. 브라우저 데이터를 지우면 내 기록에 다시 접근할 수 없으니 필요한 기록은 내보내기로 보관하세요.','These are your contributions without sign-in. Reopen and edit them in this browser. Clearing browser data removes your access; export any records you want to keep.')}</div>`).replace(/<p class="notice-foot">[\s\S]*?<\/p>/,`<p class="notice-foot">${E('저장한 글과 댓글은 서버에 보관됩니다. 임시 글·형광펜·읽기 설정은 이 기기에 보관됩니다.','Saved reflections and replies are stored online. Drafts, highlights and reading preferences stay on this device.')}</p>`);};
 const baseReplies=repliesHTML;
 repliesHTML=function(n){return baseReplies(n).replace(E('이 브라우저의 데모','Local demo'),E('함께 나누는 대화','Shared conversation')).replaceAll(E('방금 기록','Recorded here'),E('반원 댓글','Member reply'));};
 showThread=function(id){cloud.threadId=id;oldShowThread(id);const input=$('.reply-input');if(input)input.insertAdjacentHTML('beforebegin',nameField());const tip=$('.thread-context-note');if(tip)tip.textContent=E('로그인 없이 바로 댓글을 남길 수 있습니다. 이름을 비워 두면 익명으로 표시됩니다.','Reply directly without signing in. Leave the optional name blank to post anonymously.');const draft=window.TogetherDrafts?.read('note-comment',id);if(draft){$('#replyText').value=draft.body||'';if($('[data-participant-name]'))$('[data-participant-name]').value=draft.name||'';}input?.insertAdjacentHTML('afterend','<p id="replyDraftStatus" class="draft-save-status" role="status" aria-live="polite"></p>');renderReplyDraftStatus(draft?'saved':'idle');};
 function renderReplyDraftStatus(status){const label=$('#replyDraftStatus');if(!label)return;label.dataset.status=status;label.textContent=status==='saving'?E('입력 중…','Typing…'):status==='saved'?E('이 기기에 임시 저장됨 · 등록 전에는 공개되지 않아요.','Draft saved on this device · private until you post.'):status==='error'?E('기기에 저장하지 못했어요. 화면을 닫기 전에 내용을 복사해 주세요.','Could not save on this device. Copy your text before closing.'):E('작성 중인 댓글은 이 기기에 자동으로 임시 저장됩니다.','Your unfinished reply is automatically saved on this device.');}
 document.addEventListener('input',event=>{if(modalKind!=='thread'||!cloud.threadId||!(event.target.id==='replyText'||event.target.matches('[data-participant-name]')))return;window.TogetherDrafts?.save('note-comment',cloud.threadId,{body:$('#replyText')?.value||'',name:$('[data-participant-name]')?.value||''});});
 document.addEventListener('together:draft-status',event=>{if(modalKind==='thread'&&event.detail.kind==='note-comment'&&event.detail.target===cloud.threadId)renderReplyDraftStatus(event.detail.status);});
 showAbout=function(){oldAbout();const panels=$$('.panel',$('#modal'));if(panels[0])panels[0].innerHTML=`<h2>${E('누구나 바로 참여','Everyone can participate')}</h2><p class="help">${E('로그인이나 회원가입 없이 공과를 읽고, 인사이트·댓글·공감을 남길 수 있습니다. 이름은 선택 사항입니다. 글은 온라인에 저장되며, 내가 쓴 글은 같은 브라우저에서 관리할 수 있습니다. 브라우저 데이터를 지우면 이 기록을 다시 관리할 수 없습니다.','Read lessons, post reflections, reply and react without signing in or creating an account. Your name is optional. Contributions are saved online and managed from this browser. Clearing browser data removes your ability to manage them.')}</p><h2>${E('운영자 도구','Operator tools')}</h2><p class="help">${E('콘텐츠 준비와 발표 관리 도구는 권한을 받은 운영자가 이메일로 로그인한 뒤 이용합니다. 가입만으로 운영 권한이 생기지는 않습니다. 비밀번호 재설정은 운영자 로그인 화면에서 할 수 있습니다.','Content preparation and presentation tools require email sign-in and an assigned operator role. Creating an account does not grant management access. Password reset is available on the operator sign-in screen.')}</p>`;const foot=$('.notice-foot',$('#modal'));if(foot)foot.textContent=E('공유 글은 사이트 방문자에게 공개됩니다. 나만 보기 기록은 서버에서 작성자만 읽을 수 있도록 제한합니다.','Shared posts are public to site visitors. Private notes are restricted to their author on the server.');};
 function updateStatus(){const el=$('.cloud-status');if(el){el.className='cloud-status '+cloud.status;el.innerHTML='<span class="status-dot"></span>'+connectionLabel();}}
 function readableError(error){
  const code=String(error?.code||''),message=String(error?.message||error||'');
  if(/invalid.*credentials/i.test(message))return E('이메일 또는 비밀번호를 확인해 주세요.','Check your email and password.');
  if(/email.*not.*confirmed/i.test(message))return E('가입 확인 메일의 링크를 누른 뒤 로그인해 주세요.','Confirm your email before signing in.');
  if(/rate|too many/i.test(message)||code==='over_email_send_rate_limit')return E('요청이 많습니다. 잠시 후 다시 시도해 주세요.','Too many requests. Please try again shortly.');
  if(/email.*(not.*authorized|address.*invalid)|email_address_not_authorized/i.test(message+' '+code))return E('현재 메일 발송 설정으로 이 주소에 보낼 수 없습니다. 운영자의 메일 서비스 연결이 필요합니다.','Email delivery to this address is not enabled yet. The site owner needs to configure email delivery.');
  if(/same_password/i.test(code)||/different.*password/i.test(message))return E('기존 비밀번호와 다른 비밀번호를 입력해 주세요.','Choose a password different from your current password.');
  if(/password/i.test(message)&&!/credentials/i.test(message))return E('비밀번호 조건을 확인해 주세요. 8자 이상을 입력해 주세요.','Check the password requirements. Use at least 8 characters.');
  if(/expired|invalid.*(token|link)|otp_expired/i.test(message+' '+code))return E('링크가 만료되었거나 이미 사용되었습니다. 새 재설정 메일을 요청해 주세요.','This link has expired or was already used. Request a new reset email.');
  if(code==='42501')return E('이 기록을 변경할 권한이 없습니다. 로그인 상태를 확인해 주세요.','You do not have permission to change this record. Check your sign-in status.');
  return E('연결을 확인하고 다시 시도해 주세요. 입력한 내용은 지우지 않았습니다.','Check your connection and try again. Your input has been kept.');
 }
 async function sync({force=false}={}){
  if(cloud.busy&&!force)return;
  const revision=cloud.revision,userId=cloud.user?.id;
  // Page through notes so an older journal entry does not vanish at the API row limit.
  const rows=[];let offset=0;
  try{
   while(true){const {data,error}=await cloud.client.from('together_notes').select(noteSelect).order('created_at',{ascending:false}).order('id').range(offset,offset+199);if(error)throw error;rows.push(...data);if(data.length<200)break;offset+=200;}
   if(revision!==cloud.revision)return;
   const serialized=JSON.stringify(rows);
   if(serialized!==cloud.lastJSON||!cloud.ready){state.notes=model.mergeRows(state.notes,rows,userId);cleanQueue();cloud.lastJSON=serialized;refreshPreservingScroll();
    if(modalKind==='thread'&&cloud.threadId){const n=state.notes.find(n=>n.id===cloud.threadId);if(n){const replies=$('#threadReplies');if(replies)replies.innerHTML=repliesHTML(n);const card=$('.modal .note-card');if(card)card.outerHTML=noteCard(n);}else{closeModal(false);toast(E('이 글이 삭제되었거나 공개 범위가 변경되었습니다.','This post was removed or its visibility changed.'));}}
   }
   cloud.ready=true;cloud.status='connected';
  }catch(error){if(revision!==cloud.revision)return;cloud.status='error';if(force)throw error;}
  updateStatus();
 }
 let participantPromise=null,resolveInitial;
 const initialSession=new Promise(resolve=>{resolveInitial=resolve;});
 async function ensureParticipant(name){
  await initialSession;
  if(cloud.recovery)throw Error('Finish password recovery before contributing');
  if(participantPromise)return participantPromise;
  participantPromise=(async()=>{
   let user=cloud.user;
   const chosen=typeof name==='string'?(user&&!user.is_anonymous?String(name).trim().slice(0,50):rememberName(name)):participantName();
   const author=chosen||E('익명','Anonymous');
   if(!user){
    const {data,error}=await cloud.client.auth.signInAnonymously({options:{data:{display_name:author}}});
    if(error)throw error;if(!data.user||!data.session)throw Error('Participation could not start');
    user=data.user;
   }else if(user.is_anonymous&&user.user_metadata?.display_name!==author){
    const {data,error}=await cloud.client.auth.updateUser({data:{display_name:author}});if(error)throw error;user=data.user;
   }
   if(cloud.user?.id!==user.id)throw Error('Identity changed during participation');
   cloud.user=user;return user;
  })();
  try{return await participantPromise;}finally{participantPromise=null;}
 }
 cloud.ensureParticipant=ensureParticipant;
 function showProfile(){
  if(composer)storeDraft();
  showModal(modalHead(E('나눔에 표시할 이름','Your name in conversations'),E('이름을 정하지 않아도 바로 참여할 수 있어요.','You can participate without choosing a name.'))+`<form id="participantForm" class="modal-body auth-form"><label>${E('이름 또는 별명 (선택)','Name or nickname (optional)')}<input id="participantName" autocomplete="nickname" maxlength="50" value="${esc(localName||cloud.user?.user_metadata?.display_name||'')}" placeholder="${E('익명','Anonymous')}"></label><p class="help">${E('새 글과 댓글에 사용할 이름입니다. 내가 쓴 글은 이 브라우저에서 관리할 수 있습니다. 브라우저 데이터를 지우면 다시 관리할 수 없습니다.','This name is used for new posts and replies. Manage your contributions from this browser; clearing its data removes that access.')}</p><div id="authMessage" hidden role="status"></div><button class="btn primary full" data-cloud-submit type="submit">${E('저장','Save')}</button></form>`,{kind:'profile',size:'medium'});
 }
 document.addEventListener('submit',async event=>{
  if(event.target.id!=='participantForm')return;event.preventDefault();if(cloud.busy)return;
  const name=rememberName($('#participantName').value);setBusy(true);
  try{if(cloud.user?.is_anonymous)await ensureParticipant(name);closeModal(false);refreshPreservingScroll();toast(E('이름 설정을 저장했습니다.','Name preference saved.'));}catch(error){authMessage(readableError(error),true);}finally{setBusy(false);}
 });
 function setBusy(value){cloud.busy=value;$$('[data-cloud-submit],[data-enhance="share-insight"],[data-enhance="keep-private"],[data-action="send-reply"]',$('#modal')).forEach(b=>b.disabled=value);updateStatus();if(!value&&!cloud.ready)void sync();}
 function inlineError(id,error){const el=$(id);if(el){el.textContent=readableError(error);el.hidden=false;}else toast(readableError(error),true);}
 function authMessage(message,error=false){const el=$('#authMessage');if(el){el.className='alert'+(error?' error':'');el.textContent=message;el.hidden=false;}}
 function showAuth(mode='signin'){
  $('#sidebar')?.classList.remove('open');$('#menuBackdrop')?.classList.remove('active');
  if(composer)storeDraft();
  if(mode==='guest'){showProfile();return;}
  if(mode==='account'&&!namedUser())mode='signin';
  const signed=namedUser()&&mode==='account';
  if(signed){showModal(modalHead(E('운영자 계정','Operator account'),esc(displayName()))+`<div class="modal-body"><p class="account-email">${esc(cloud.user.email)}</p><p class="help">${E('권한이 부여된 계정만 관리 도구를 사용할 수 있습니다. 일반 참여에는 로그인이 필요하지 않습니다.','Only accounts with an assigned role can use management tools. Ordinary participation requires no sign-in.')}</p><div class="account-actions"><button class="btn" data-cloud="reset">${E('비밀번호 재설정 메일 받기','Send password reset email')}</button><button class="btn" data-cloud="signout">${E('로그아웃','Sign out')}</button></div><div id="authMessage" hidden role="status"></div></div>`,{kind:'account',size:'medium'});return;}
  const newPassword=mode==='new-password',signup=mode==='signup',reset=mode==='reset';
  const title=newPassword?E('새 비밀번호 설정','Set a new password'):signup?E('운영자 계정 등록','Register an operator account'):reset?E('비밀번호 재설정','Reset your password'):E('운영자 로그인','Operator sign-in');
  const subtitle=newPassword?E('새 비밀번호를 저장한 뒤 다시 로그인해 주세요.','Save a new password, then sign in again.'):reset?E('가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.','We will email a password reset link to your account.'):E('권한을 받은 운영자만 로그인하면 됩니다. 공과 읽기와 나눔은 로그인 없이 이용하세요.','Only assigned operators need to sign in. Reading and sharing are available without sign-in.');
  showModal(modalHead(title,subtitle)+`<form id="authForm" class="modal-body auth-form" data-mode="${mode}">${signup?`<label>${E('표시할 이름','Display name')}<input id="authName" autocomplete="nickname" maxlength="50" required placeholder="${E('나눔에 표시할 이름','Your name in conversations')}"></label>`:''}${!newPassword?`<label>${E('이메일','Email')}<input id="authEmail" type="email" autocomplete="email" inputmode="email" required value="${esc(cloud.user?.email||'')}" placeholder="you@example.com"></label>`:''}${!reset?`<label>${E('비밀번호','Password')}<input id="authPassword" type="password" autocomplete="${signup||newPassword?'new-password':'current-password'}" minlength="8" maxlength="128" required placeholder="${E('8자 이상','At least 8 characters')}"></label>`:''}${signup||newPassword?`<label>${E('비밀번호 확인','Confirm password')}<input id="authConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>`:''}<div id="authMessage" class="alert" hidden role="status"></div><button class="btn primary full" data-cloud-submit type="submit">${newPassword?E('비밀번호 변경','Save new password'):signup?E('회원가입','Create account'):reset?E('재설정 메일 보내기','Send reset email'):E('로그인','Sign in')}</button>${mode==='signin'?`<button type="button" class="btn full" data-cloud="dismiss">${E('로그인 없이 계속 이용','Continue without signing in')}</button>`:''}<div class="auth-links">${!newPassword?`<button type="button" class="text-btn" data-cloud="${signup||reset?'signin':'signup'}">${signup||reset?E('로그인으로 돌아가기','Back to sign in'):E('운영자 계정 등록','Register an operator account')}</button>`:''}${!signup&&!reset&&!newPassword?`<button type="button" class="text-btn" data-cloud="reset">${E('비밀번호를 잊으셨나요?','Forgot password?')}</button>`:''}</div>${signup?`<p class="help">${E('이메일 확인과 별도의 운영 권한 부여가 필요합니다. 계정 등록만으로 관리 기능을 사용할 수는 없습니다.','Email confirmation and a separately assigned operator role are required. Registering an account does not grant management access.')}</p>`:''}</form>`,{kind:'auth',size:'medium'});
  $('#authName,#authEmail,#authPassword')?.focus({preventScroll:true});
  if(mode==='signin'&&cloud.user?.is_anonymous)$('#authForm').insertAdjacentHTML('beforeend',`<p class="help">${E('운영자 계정과 현재 익명 기록은 별개입니다. 계정을 전환하면 기존 익명 글을 다시 관리할 수 없으니 필요한 기록은 먼저 내보내 주세요.','The operator account is separate from your anonymous contributions. Switching accounts removes access to manage those contributions; export any records you want to keep first.')}</p>`);
 }
 async function submitAuth(event){
  event.preventDefault();const form=event.target;if(form.id!=='authForm'||cloud.busy)return;
  const mode=form.dataset.mode,email=$('#authEmail')?.value.trim(),password=$('#authPassword')?.value,confirmPassword=$('#authConfirm')?.value;
  if(confirmPassword!==undefined&&password!==confirmPassword){authMessage(E('두 비밀번호가 일치하지 않습니다.','The passwords do not match.'),true);return;}
  setBusy(true);
  try{
   if(mode==='signup'){
    const name=$('#authName').value.trim();if(!name){authMessage(E('표시할 이름을 입력해 주세요.','Enter a display name.'),true);return;}
    const {data,error}=await cloud.client.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin+'/'}});if(error)throw error;
    if(data.session){closeModal(false);toast(E('가입하고 로그인했습니다.','Your account is ready.'));}else authMessage(E('가입 확인 메일을 확인해 주세요. 이미 가입한 주소라면 로그인하거나 비밀번호를 재설정해 주세요.','Check your confirmation email. If you already have an account, sign in or reset your password.'));
   }else if(mode==='reset'){
    const {error}=await cloud.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/?auth=reset'});if(error)throw error;
    authMessage(E('해당 주소로 가입한 계정이 있다면 재설정 메일이 발송됩니다. 스팸함도 확인해 주세요.','If an account exists for this address, a reset email will be sent. Check your spam folder too.'));
   }else if(mode==='new-password'){
    if(!cloud.user)throw Error('expired token');const {error}=await cloud.client.auth.updateUser({password});if(error)throw error;
    cloud.recovery=false;await cloud.client.auth.signOut();history.replaceState(null,'',location.pathname);showAuth('signin');authMessage(E('비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.','Password changed. Sign in with your new password.'));
   }else{const {error}=await cloud.client.auth.signInWithPassword({email,password});if(error)throw error;closeModal(false);toast(E('로그인했습니다. 운영 권한을 확인합니다.','Signed in. Checking operator access.'));}
  }catch(error){authMessage(readableError(error),true);}finally{setBusy(false);}
 }
 document.addEventListener('submit',submitAuth);
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-cloud]');if(!el||cloud.busy)return;
  const action=el.dataset.cloud;
  if(action==='account')showAuth(namedUser()?'account':'signin');
  else if(action==='profile')showProfile();
  else if(action==='dismiss')closeModal(false);
  else if(['signin','signup','reset','guest'].includes(action))showAuth(action);
  else if(action==='signout'){
   if(cloud.user?.is_anonymous&&!confirm(E('비회원에서 나가면 이 기록을 다시 수정할 수 없습니다. 나갈까요?','Leaving this guest session removes your ability to edit its records. Leave?')))return;
   setBusy(true);try{const {error}=await cloud.client.auth.signOut();if(error)throw error;closeModal(false);toast(E('로그아웃했습니다.','Signed out.'));}catch(e){authMessage(readableError(e),true);}finally{setBusy(false);}
  }
 });
 saveInsight=async function(){
  if(!composer||cloud.busy)return false;
  const body=$('#insightText').value.trim();if(!body){inlineError('#composerError',{message:'empty'});$('#composerError').textContent=E('생각을 입력해 주세요.','Enter your reflection.');return false;}
  if(composer.capturePending&&composer.captureWanted){toast(E('이미지 생성이 끝나면 저장해 주세요.','Wait for the image to finish rendering.'));return false;}
  if(!composer.cloudId)composer.cloudId=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(composer.id)?composer.id:crypto.randomUUID();
  const draft=structuredClone(composer),existing=state.notes.find(n=>n.id===draft.editId),id=existing?.remote?existing.id:draft.cloudId;
  const note={id,body,type:draft.type,scope:draft.scope,consent:draft.scope==='class'&&$('#classConsent').checked,anchor:draft.anchor,language:existing?.language||draft.anchor.language,snapshot:draft.captureWanted?draft.snapshot:null};
  const session=modalSession,name=$('[data-participant-name]')?.value;setBusy(true);
  try{
   const user=await ensureParticipant(name);if(session!==modalSession)return false;
   const row=model.toRow(note,user);
   let query;if(existing?.remote){const {id:omitId,owner_id,lesson_key,language,...changes}=row;query=cloud.client.from('together_notes').update(changes).eq('id',id).eq('owner_id',user.id);}else query=cloud.client.from('together_notes').insert(row);
   let {data,error}=await query.select(noteSelect).single();if(error?.code==='23505'&&!existing?.remote){({data,error}=await cloud.client.from('together_notes').select(noteSelect).eq('id',id).eq('owner_id',user.id).single());}if(error)throw error;
   if(cloud.user?.id!==user.id)return false;
   const saved=model.fromRow(data,user.id);state.notes=state.notes.filter(n=>n.id!==id&&n.id!==existing?.id);state.notes.unshift(saved);state.draft=null;cleanQueue();saveState();if(session===modalSession)closeModal(false);refreshPreservingScroll();clearSelection();cloud.lastJSON='';cloud.status='connected';
   toast(note.scope==='class'?E('서버에 저장했습니다. 다른 방문자도 이 글을 볼 수 있습니다.','Saved online. Other visitors can now see your post.'):E('나만 보는 기록으로 저장했습니다.','Saved privately for you.'));
   return true;
  }catch(error){inlineError('#composerError',error);cloud.status='error';return false;}finally{setBusy(false);}
 };
 publishSimple=async function(scope){if(!composer)return;composer.scope=scope;await saveInsight();};
 sendReply=async function(id){
  const input=$('#replyText'),body=input?.value.trim(),note=state.notes.find(n=>n.id===id);if(!body){if($('#replyError')){$('#replyError').hidden=false;$('#replyError').textContent=E('댓글 내용을 입력해 주세요.','Enter a reply.');}return;}
  if(cloud.busy||!note?.remote||note.scope!=='class')return;
  if(!input.dataset.cloudId)input.dataset.cloudId=crypto.randomUUID();const commentId=input.dataset.cloudId;
  const session=modalSession,name=$('[data-participant-name]')?.value;
  setBusy(true);
  try{const user=await ensureParticipant(name);if(session!==modalSession)return;
   let {data,error}=await cloud.client.from('together_comments').insert({id:commentId,note_id:id,owner_id:user.id,author:displayName(),body}).select().single();
   if(error?.code==='23505'){({data,error}=await cloud.client.from('together_comments').select().eq('id',commentId).eq('owner_id',user.id).eq('note_id',id).single());if(!error&&data.body!==body)error={message:'Reply identity conflict'};}
   if(error)throw error;if(cloud.user?.id!==user.id)return;
   const current=state.notes.find(n=>n.id===id);if(current){current.comments=current.comments.filter(c=>c.id!==data.id);current.comments.push({id:data.id,owner:'me',author:data.author,body:data.body,created:data.created_at,demo:false});}
   const draft=window.TogetherDrafts?.read('note-comment',id);if(!draft||draft.body.trim()===body)window.TogetherDrafts?.clear('note-comment',id);
   if(session===modalSession){if(input.value.trim()===body)input.value='';delete input.dataset.cloudId;$('#replyError').hidden=true;if(current)$('#threadReplies').innerHTML=repliesHTML(current);renderReplyDraftStatus(input.value?'saving':'idle');}cloud.lastJSON='';refreshPreservingScroll();toast(E('댓글을 저장했습니다.','Reply saved.'));cloud.status='connected';
  }catch(error){inlineError('#replyError',error);}finally{setBusy(false);}
 };
 const likeLocks=new Set();
 toggleLike=async function(id){const n=state.notes.find(n=>n.id===id);if(!n?.remote||n.scope!=='class'||likeLocks.has(id))return;likeLocks.add(id);try{const user=await ensureParticipant();const liked=n.likes.includes('me');await window.TogetherDiscussion.setReaction({table:'together_reactions',column:'note_id',id,userId:user.id,liked});if(cloud.user?.id!==user.id)return;const current=state.notes.find(n=>n.id===id);if(current)current.likes=liked?current.likes.filter(x=>x!=='me'):[...new Set([...current.likes,'me'])];refreshPreservingScroll();if(current&&modalKind==='thread'){$('.modal .note-card')?.replaceWith(document.createRange().createContextualFragment(noteCard(current)));}cloud.lastJSON='';}catch(e){toast(readableError(e),true);}finally{likeLocks.delete(id);if(!cloud.ready)void sync();}};
 const localDelete=deleteNote;
 deleteNote=async function(id){const n=state.notes.find(n=>n.id===id);if(!n?.remote)return localDelete(id);if(n.owner!=='me'||cloud.busy||!cloud.user)return;if(!confirm(E('이 기록과 댓글을 삭제할까요?','Delete this reflection and its replies?')))return;setBusy(true);try{const {data,error}=await cloud.client.from('together_notes').delete().eq('id',id).eq('owner_id',cloud.user.id).select('id');if(error)throw error;if(!data.length)throw Error('Record was not deleted');state.notes=state.notes.filter(x=>x.id!==id);cleanQueue();saveState();refreshPreservingScroll();cloud.lastJSON='';toast(E('기록을 삭제했습니다.','Reflection deleted.'));}catch(e){toast(readableError(e),true);}finally{setBusy(false);}};
 const oldComposer=openComposer;
 openComposer=function(...args){oldComposer(...args);if(modalKind!=='composer')return;const privacy=$('.privacy-line');if(privacy)privacy.innerHTML=icon('lock','small')+' '+E('나만 볼 수 있게 저장','Save privately');$('#insightText')?.closest('.field')?.insertAdjacentHTML('beforebegin',nameField());if(!$('[data-participant-name]')&&!namedUser())$('#insightText')?.insertAdjacentHTML('beforebegin',nameField());const audience=$('.composer-audience');if(audience)audience.innerHTML=icon('people')+'<span>'+E('로그인 없이 공유할 수 있습니다. 공유 글은 사이트 방문자에게 공개됩니다.','Share without signing in. Shared posts are visible to site visitors.')+'</span>';};
 const savedDrafts=state.accountDrafts||{};state.accountDrafts=savedDrafts;
 cloud.client.auth.onAuthStateChange((event,session)=>{
  // Apply identity synchronously. Never await auth methods while the SDK holds its lock.
  const previous=cloud.user?.id||'guest',next=session?.user?.id||'guest',changed=previous!==next;
  const adoptingGuest=!cloud.user&&session?.user?.is_anonymous;
  if(changed){
   document.dispatchEvent(new CustomEvent('together:before-identity',{detail:{previousUserId:previous==='guest'?null:previous,newUserId:next==='guest'?null:next,adoptingGuest}}));
   if(!adoptingGuest){if(composer)storeDraft();if(state.draft)savedDrafts[previous]=state.draft;state.draft=savedDrafts[next]||null;state.notes=state.notes.filter(n=>!n.remote);state.queue=[];if(['thread','composer'].includes(modalKind))closeModal(false);}
   cloud.revision++;cloud.lastJSON='';cloud.ready=false;
  }
  cloud.user=session?.user||null;
  if(!changed)document.dispatchEvent(new CustomEvent('together:participant-name'));
  if(changed)document.dispatchEvent(new CustomEvent('together:identity',{detail:{previousUserId:previous==='guest'?null:previous,userId:cloud.user?.id||null,adoptingGuest}}));
  if(event==='INITIAL_SESSION')resolveInitial();
  if(event==='PASSWORD_RECOVERY')cloud.recovery=true;
  const revision=cloud.revision;
  setTimeout(async()=>{
   if(revision!==cloud.revision)return;
   await window.TogetherAccess?.refresh();if(revision!==cloud.revision)return;
   refreshPreservingScroll();
   if(event==='PASSWORD_RECOVERY')showAuth('new-password');
   await sync();
  },0);
 });
 const authError=new URLSearchParams(location.hash.slice(1)).get('error_description');
 if(authError)setTimeout(()=>{showAuth('reset');authMessage(E('이메일 링크가 만료되었거나 유효하지 않습니다. 새 링크를 요청해 주세요.','This email link is invalid or expired. Request a new link.'),true);history.replaceState(null,'',location.pathname);},0);
 cloud.sync=sync;cloud.showAuth=showAuth;
 setInterval(()=>{if(!document.hidden&&!cloud.busy)sync();},15000);
 window.addEventListener('focus',()=>{if(!cloud.busy)sync();});
 window.addEventListener('online',()=>sync());
 // INITIAL_SESSION also handles signed-out visitors and expired tokens.
}
