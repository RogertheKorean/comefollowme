/* Email authentication and per-record persistence. The database enforces ownership. */
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
 function displayName(){return (cloud.user?.user_metadata?.display_name||E('반원','Member')).slice(0,50);}
 function connectionLabel(){return cloud.status==='error'?E('연결 확인 필요','Connection interrupted'):cloud.busy?E('저장 중…','Saving…'):cloud.status==='connecting'?E('연결 중…','Connecting…'):E('온라인 학습 공간','Connected');}
 topbarHTML=function(){return oldTopbar().replace(/<div class="demo-badge">[\s\S]*?<\/div>/,`<div class="cloud-status ${cloud.status}" role="status"><span class="status-dot"></span>${connectionLabel()}</div>`).replace(/<button class="avatar" data-action="about"[\s\S]*?<\/button>/,`<button class="btn sm account-button" data-cloud="account">${icon('people','small')}<span>${cloud.user?esc(displayName()):E('로그인','Sign in')}</span></button>`);};
 sidebarHTML=function(){return oldSidebar().replace(/<div class="sidebar-note">[\s\S]*?<\/div>/,`<div class="sidebar-note">${E('비공식 학습·나눔 공간<br>공유 글은 이 사이트 방문자에게 공개됩니다.','Independent study community<br>Shared posts are visible to site visitors.')}</div>`);};
 communityHTML=function(){return oldCommunity().replace(/(<div class="stream-banner">[\s\S]*?<p>)[\s\S]*?(<\/p>)/,`$1${E('공유 글과 댓글은 이 사이트 방문자에게 공개됩니다. 개인정보나 민감한 내용은 올리지 마세요.','Shared posts and replies are public to site visitors. Do not post personal or sensitive information.')}$2`).replace(/<div class="demo-strip">[\s\S]*?<\/div>/,`<div class="demo-strip">${icon('info','small')}<span>${E('이 피드는 서버에 저장된 실제 공유 글을 보여 줍니다. 역할 선택은 이 기기의 발표 화면 미리보기에만 적용됩니다.','This feed shows real shared posts stored online. The role selector only previews presentation controls on this device.')}</span><select id="demoRole" aria-label="${E('발표 화면 역할','Presentation preview role')}"><option value="member" ${state.role==='member'?'selected':''}>${E('성도 보기','Member view')}</option><option value="teacher" ${state.role==='teacher'?'selected':''}>${E('교사 보기','Teacher view')}</option></select></div>`).replace(/<p class="notice-foot">[\s\S]*?<\/p>/,`<p class="notice-foot">${E('나만 보기 기록은 작성자에게만 표시되며 이 피드에는 나타나지 않습니다.','Private reflections are visible only to their author and never appear in this feed.')}</p>`);};
 mineHTML=function(){return oldMine().replace(/<div class="demo-strip">[\s\S]*?<\/div>/,`<div class="demo-strip">${icon('lock','small')}${cloud.user?E('계정에 저장한 기록입니다. 나만 보기 기록은 작성자만 열 수 있습니다.','Saved to your account. Private reflections are visible only to you.'):E('로그인하면 다른 기기에서도 내 기록을 불러올 수 있습니다.','Sign in to access your journal across devices.')} ${E('기존 기기 기록은 직접 저장할 때 계정에 연결됩니다.','Existing device notes are uploaded only when you explicitly save them.')}</div>`).replace(/<p class="notice-foot">[\s\S]*?<\/p>/,`<p class="notice-foot">${E('저장한 글과 댓글은 서버에 보관됩니다. 임시 글·형광펜·읽기 설정은 이 기기에 보관됩니다.','Saved reflections and replies are stored online. Drafts, highlights and reading preferences stay on this device.')}</p>`);};
 const baseReplies=repliesHTML;
 repliesHTML=function(n){return baseReplies(n).replace(E('이 브라우저의 데모','Local demo'),E('함께 나누는 대화','Shared conversation')).replaceAll(E('방금 기록','Recorded here'),E('반원 댓글','Member reply'));};
 showThread=function(id){cloud.threadId=id;oldShowThread(id);if(!cloud.user&&$('.reply-input'))$('.reply-input').innerHTML=`<button class="btn primary full" data-cloud="signin">${E('로그인 또는 비회원으로 댓글 남기기','Sign in or continue as guest to reply')}</button>`;const tip=$('.thread-context-note');if(tip)tip.textContent=E('공유 글과 댓글은 이 사이트 방문자가 볼 수 있습니다. 이메일로 로그인하거나 비회원으로 참여해 댓글을 남길 수 있습니다.','Shared posts and replies are visible to site visitors. Sign in with email or continue as a guest to reply.');};
 showAbout=function(){oldAbout();const panels=$$('.panel',$('#modal'));if(panels[0])panels[0].innerHTML=`<h2>${E('계정과 저장','Accounts and storage')}</h2><p class="help">${E('이메일로 회원가입하고 로그인합니다. 저장한 인사이트·댓글·공감은 계정과 함께 보관되며 다른 기기에서도 불러옵니다. 비밀번호를 잊었다면 로그인 화면에서 재설정 메일을 요청하세요.','Create an account with your email. Reflections, replies and reactions are stored online and available across devices. Request a reset email from the sign-in screen if you forget your password.')}</p><h2>${E('공개 범위','Visibility')}</h2><p class="help">${E('공유 글과 댓글은 사이트 방문자에게 공개됩니다. 나만 보기 기록은 서버에서 작성자만 읽도록 제한합니다. 교사 보기와 발표 보드는 현재 기기의 발표 도구이며 관리자 권한을 부여하지 않습니다.','Shared posts and replies are public to site visitors. Private notes are protected by author access rules. Teacher view and presentation boards are local presentation tools, not administrative roles.')}</p>`;const foot=$('.notice-foot',$('#modal'));if(foot)foot.textContent=E('임시 글, 형광펜과 로컬로 등록한 읽기 자료는 기기에 보관됩니다. 공과와 참조자료의 출처·번역·발췌 표시는 그대로 적용됩니다.','Drafts, highlights and locally imported reading material stay on this device. Source, translation and excerpt notices continue to apply.');};
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
 function requireUser(){if(cloud.user)return true;if(composer)storeDraft();showAuth('signin');return false;}
 function setBusy(value){cloud.busy=value;$$('[data-cloud-submit],[data-enhance="share-insight"],[data-enhance="keep-private"],[data-action="send-reply"]',$('#modal')).forEach(b=>b.disabled=value);updateStatus();}
 function inlineError(id,error){const el=$(id);if(el){el.textContent=readableError(error);el.hidden=false;}else toast(readableError(error),true);}
 function authMessage(message,error=false){const el=$('#authMessage');if(el){el.className='alert'+(error?' error':'');el.textContent=message;el.hidden=false;}}
 function showAuth(mode='signin'){
  if(composer)storeDraft();
  if(mode==='guest'){showModal(modalHead(E('비회원으로 참여하기','Continue as a guest'),E('이름만 정하고 생각을 나눠 보세요.','Choose a name and join the conversation.'))+`<form id="authForm" class="modal-body auth-form" data-mode="guest"><label>${E('표시할 이름','Display name')}<input id="authName" autocomplete="nickname" maxlength="50" required placeholder="${E('비회원 이름','Guest name')}"></label><p class="help">${E('글과 댓글은 서버에 저장됩니다. 비회원 기록은 이 브라우저에서 관리할 수 있으며, 로그아웃하거나 브라우저 데이터를 지우면 다시 관리할 수 없습니다. 이메일 계정의 기록과는 별도로 보관됩니다.','Posts and replies are saved online. You can manage guest records in this browser until you sign out or clear its data. Guest records are separate from email accounts.')}</p><div id="authMessage" hidden role="status"></div><button class="btn primary full" data-cloud-submit type="submit">${E('비회원으로 시작','Continue as guest')}</button><button type="button" class="text-btn" data-cloud="signin">${E('이메일로 로그인','Sign in with email')}</button></form>`,{kind:'auth',size:'medium'});$('#authName').focus();return;}
  if(mode==='account'&&cloud.user?.is_anonymous){showModal(modalHead(E('비회원 참여 중','Guest account'),esc(displayName()))+`<div class="modal-body"><p class="help">${E('비회원으로 남긴 글은 서버에 저장되어 있습니다. 이 브라우저의 로그인 정보가 있어야 수정하거나 삭제할 수 있습니다. 이메일 계정으로 로그인해도 비회원 기록은 자동으로 옮겨지지 않습니다.','Your guest posts are saved online. This browser session is required to edit or delete them. Signing into an email account does not transfer guest records.')}</p><div class="account-actions"><button class="btn primary" data-cloud="signin">${E('이메일 계정으로 로그인','Sign in with email')}</button><button class="btn" data-cloud="signout">${E('비회원 나가기','Leave guest session')}</button></div><div id="authMessage" hidden role="status"></div></div>`,{kind:'account',size:'medium'});return;}
  const signed=cloud.user&&mode==='account';
  if(signed){showModal(modalHead(E('내 계정','My account'),esc(displayName()))+`<div class="modal-body"><p class="account-email">${esc(cloud.user.email)}</p><p class="help">${E('저장한 기록은 같은 계정으로 로그인한 기기에서 불러올 수 있습니다.','Access your saved journal on any device signed into this account.')}</p><div class="account-actions"><button class="btn" data-cloud="reset">${E('비밀번호 재설정 메일 받기','Send password reset email')}</button><button class="btn" data-cloud="signout">${E('로그아웃','Sign out')}</button></div><div id="authMessage" hidden role="status"></div></div>`,{kind:'account',size:'medium'});return;}
  const newPassword=mode==='new-password',signup=mode==='signup',reset=mode==='reset';
  const title=newPassword?E('새 비밀번호 설정','Set a new password'):signup?E('함께 시작하기','Create an account'):reset?E('비밀번호 재설정','Reset your password'):E('다시 만나 반가워요','Welcome back');
  const subtitle=newPassword?E('새 비밀번호를 저장한 뒤 다시 로그인해 주세요.','Save a new password, then sign in again.'):reset?E('가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.','We will email a password reset link to your account.'):E('이메일로 로그인하고 생각을 함께 나눠 보세요.','Sign in with email to save and share your reflections.');
  showModal(modalHead(title,subtitle)+`<form id="authForm" class="modal-body auth-form" data-mode="${mode}">${signup?`<label>${E('표시할 이름','Display name')}<input id="authName" autocomplete="nickname" maxlength="50" required placeholder="${E('나눔에 표시할 이름','Your name in conversations')}"></label>`:''}${!newPassword?`<label>${E('이메일','Email')}<input id="authEmail" type="email" autocomplete="email" inputmode="email" required value="${esc(cloud.user?.email||'')}" placeholder="you@example.com"></label>`:''}${!reset?`<label>${E('비밀번호','Password')}<input id="authPassword" type="password" autocomplete="${signup||newPassword?'new-password':'current-password'}" minlength="8" maxlength="128" required placeholder="${E('8자 이상','At least 8 characters')}"></label>`:''}${signup||newPassword?`<label>${E('비밀번호 확인','Confirm password')}<input id="authConfirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label>`:''}<div id="authMessage" class="alert" hidden role="status"></div><button class="btn primary full" data-cloud-submit type="submit">${newPassword?E('비밀번호 변경','Save new password'):signup?E('회원가입','Create account'):reset?E('재설정 메일 보내기','Send reset email'):E('로그인','Sign in')}</button>${mode==='signin'?`<button type="button" class="btn full" data-cloud="guest">${E('회원가입 없이 비회원으로 참여','Continue without an account')}</button>`:''}<div class="auth-links">${!newPassword?`<button type="button" class="text-btn" data-cloud="${signup||reset?'signin':'signup'}">${signup||reset?E('로그인으로 돌아가기','Back to sign in'):E('처음이신가요? 회원가입','New here? Create an account')}</button>`:''}${!signup&&!reset&&!newPassword?`<button type="button" class="text-btn" data-cloud="reset">${E('비밀번호를 잊으셨나요?','Forgot password?')}</button>`:''}</div>${signup?`<p class="help">${E('이메일 확인 후 로그인할 수 있습니다. 표시 이름만 글과 댓글에 나타나며 이메일은 공개하지 않습니다.','Confirm your email before signing in. Only your display name appears on posts; your email is not published.')}</p>`:''}</form>`,{kind:'auth',size:'medium'});
  $('#authName,#authEmail,#authPassword')?.focus({preventScroll:true});
 }
 async function submitAuth(event){
  event.preventDefault();const form=event.target;if(form.id!=='authForm'||cloud.busy)return;
  const mode=form.dataset.mode,email=$('#authEmail')?.value.trim(),password=$('#authPassword')?.value,confirmPassword=$('#authConfirm')?.value;
  if(confirmPassword!==undefined&&password!==confirmPassword){authMessage(E('두 비밀번호가 일치하지 않습니다.','The passwords do not match.'),true);return;}
  setBusy(true);
  try{
   if(mode==='guest'){
    const name=$('#authName').value.trim();if(!name){authMessage(E('표시할 이름을 입력해 주세요.','Enter a display name.'),true);return;}
    const {error}=await cloud.client.auth.signInAnonymously({options:{data:{display_name:name}}});if(error)throw error;closeModal(false);toast(E('비회원으로 참여했습니다.','You joined as a guest.'));
   }else if(mode==='signup'){
    const name=$('#authName').value.trim();if(!name){authMessage(E('표시할 이름을 입력해 주세요.','Enter a display name.'),true);return;}
    const {data,error}=await cloud.client.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:location.origin+'/'}});if(error)throw error;
    if(data.session){closeModal(false);toast(E('가입하고 로그인했습니다.','Your account is ready.'));}else authMessage(E('가입 확인 메일을 확인해 주세요. 이미 가입한 주소라면 로그인하거나 비밀번호를 재설정해 주세요.','Check your confirmation email. If you already have an account, sign in or reset your password.'));
   }else if(mode==='reset'){
    const {error}=await cloud.client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/?auth=reset'});if(error)throw error;
    authMessage(E('해당 주소로 가입한 계정이 있다면 재설정 메일이 발송됩니다. 스팸함도 확인해 주세요.','If an account exists for this address, a reset email will be sent. Check your spam folder too.'));
   }else if(mode==='new-password'){
    if(!cloud.user)throw Error('expired token');const {error}=await cloud.client.auth.updateUser({password});if(error)throw error;
    cloud.recovery=false;await cloud.client.auth.signOut();history.replaceState(null,'',location.pathname);showAuth('signin');authMessage(E('비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.','Password changed. Sign in with your new password.'));
   }else{const {error}=await cloud.client.auth.signInWithPassword({email,password});if(error)throw error;closeModal(false);toast(E('로그인했습니다. 내 기록을 불러옵니다.','Signed in. Loading your journal.'));}
  }catch(error){authMessage(readableError(error),true);}finally{setBusy(false);}
 }
 document.addEventListener('submit',submitAuth);
 document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-cloud]');if(!el||cloud.busy)return;
  const action=el.dataset.cloud;
  if(action==='account')showAuth(cloud.user?'account':'signin');
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
  if(!requireUser())return false;
  if(!composer.cloudId)composer.cloudId=/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(composer.id)?composer.id:crypto.randomUUID();
  const draft=structuredClone(composer),existing=state.notes.find(n=>n.id===draft.editId),id=existing?.remote?existing.id:draft.cloudId;
  const note={id,body,type:draft.type,scope:draft.scope,consent:draft.scope==='class'&&$('#classConsent').checked,anchor:draft.anchor,language:existing?.language||draft.anchor.language,snapshot:draft.captureWanted?draft.snapshot:null};
  const row=model.toRow(note,cloud.user);setBusy(true);
  try{
   let query;if(existing?.remote){const {id:omitId,owner_id,lesson_key,language,...changes}=row;query=cloud.client.from('together_notes').update(changes).eq('id',id).eq('owner_id',cloud.user.id);}else query=cloud.client.from('together_notes').insert(row);
   let {data,error}=await query.select(noteSelect).single();if(error?.code==='23505'&&!existing?.remote){({data,error}=await cloud.client.from('together_notes').select(noteSelect).eq('id',id).eq('owner_id',cloud.user.id).single());}if(error)throw error;
   const saved=model.fromRow(data,cloud.user.id);state.notes=state.notes.filter(n=>n.id!==id&&n.id!==existing?.id);state.notes.unshift(saved);state.draft=null;cleanQueue();saveState();closeModal(false);refreshPreservingScroll();clearSelection();cloud.lastJSON='';cloud.status='connected';
   toast(note.scope==='class'?E('서버에 저장했습니다. 다른 방문자도 이 글을 볼 수 있습니다.','Saved online. Other visitors can now see your post.'):E('내 계정에 비공개로 저장했습니다.','Saved privately to your account.'));
   return true;
  }catch(error){inlineError('#composerError',error);cloud.status='error';return false;}finally{setBusy(false);}
 };
 publishSimple=async function(scope){if(!composer)return;composer.scope=scope;await saveInsight();};
 sendReply=async function(id){
  const input=$('#replyText'),body=input?.value.trim(),note=state.notes.find(n=>n.id===id);if(!body){if($('#replyError')){$('#replyError').hidden=false;$('#replyError').textContent=E('댓글 내용을 입력해 주세요.','Enter a reply.');}return;}
  if(cloud.busy||!note?.remote||note.scope!=='class')return;
  if(!cloud.user){toast(E('댓글 입력을 유지했습니다. 위쪽 로그인 버튼으로 로그인해 주세요.','Your reply is still here. Sign in using the account button above.'),true);return;}
  if(!input.dataset.cloudId)input.dataset.cloudId=crypto.randomUUID();const commentId=input.dataset.cloudId;
  setBusy(true);
  try{let {data,error}=await cloud.client.from('together_comments').insert({id:commentId,note_id:id,owner_id:cloud.user.id,author:displayName(),body}).select().single();
   if(error?.code==='23505'){({data,error}=await cloud.client.from('together_comments').select().eq('id',commentId).eq('owner_id',cloud.user.id).eq('note_id',id).single());if(!error&&data.body!==body)error={message:'Reply identity conflict'};}
   if(error)throw error;note.comments=note.comments.filter(c=>c.id!==data.id);note.comments.push({id:data.id,owner:'me',author:data.author,body:data.body,created:data.created_at,demo:false});input.value='';delete input.dataset.cloudId;$('#replyError').hidden=true;$('#threadReplies').innerHTML=repliesHTML(note);cloud.lastJSON='';refreshPreservingScroll();toast(E('댓글을 저장했습니다.','Reply saved.'));cloud.status='connected';
  }catch(error){inlineError('#replyError',error);}finally{setBusy(false);}
 };
 const likeLocks=new Set();
 toggleLike=async function(id){const n=state.notes.find(n=>n.id===id);if(!n?.remote||n.scope!=='class'||likeLocks.has(id)||!requireUser())return;likeLocks.add(id);try{const liked=n.likes.includes('me');const result=liked?await cloud.client.from('together_reactions').delete().eq('note_id',id).eq('owner_id',cloud.user.id):await cloud.client.from('together_reactions').insert({note_id:id,owner_id:cloud.user.id});if(result.error&&result.error.code!=='23505')throw result.error;n.likes=liked?n.likes.filter(x=>x!=='me'):[...new Set([...n.likes,'me'])];refreshPreservingScroll();if(modalKind==='thread'){$('.modal .note-card')?.replaceWith(document.createRange().createContextualFragment(noteCard(n)));}cloud.lastJSON='';}catch(e){toast(readableError(e),true);}finally{likeLocks.delete(id);}};
 const localDelete=deleteNote;
 deleteNote=async function(id){const n=state.notes.find(n=>n.id===id);if(!n?.remote)return localDelete(id);if(n.owner!=='me'||cloud.busy||!requireUser())return;if(!confirm(E('이 기록과 댓글을 삭제할까요?','Delete this reflection and its replies?')))return;setBusy(true);try{const {data,error}=await cloud.client.from('together_notes').delete().eq('id',id).eq('owner_id',cloud.user.id).select('id');if(error)throw error;if(!data.length)throw Error('Record was not deleted');state.notes=state.notes.filter(x=>x.id!==id);cleanQueue();saveState();refreshPreservingScroll();cloud.lastJSON='';toast(E('기록을 삭제했습니다.','Reflection deleted.'));}catch(e){toast(readableError(e),true);}finally{setBusy(false);}};
 const oldComposer=openComposer;
 openComposer=function(...args){oldComposer(...args);if(modalKind!=='composer')return;const privacy=$('.privacy-line');if(privacy)privacy.innerHTML=icon('lock','small')+' '+E('내 계정에 저장','Saved to your account');const audience=$('.composer-audience');if(audience)audience.innerHTML=icon('people')+'<span>'+E('공유 글은 이 사이트 방문자에게 공개됩니다.','Shared posts are visible to site visitors.')+'</span>';};
 const savedDrafts=state.accountDrafts||{};state.accountDrafts=savedDrafts;
 cloud.client.auth.onAuthStateChange((event,session)=>{
  // Never await another auth method inside the auth callback (SDK holds its session lock).
  setTimeout(async()=>{
   const previous=cloud.user?.id||'guest',next=session?.user?.id||'guest',changed=previous!==next;
   if(changed){if(state.draft)savedDrafts[previous]=state.draft;state.draft=savedDrafts[next]||null;cloud.revision++;cloud.lastJSON='';state.notes=state.notes.filter(n=>!n.remote);state.queue=[];cloud.ready=false;if(modalKind==='thread')closeModal(false);}
   cloud.user=session?.user||null;refreshPreservingScroll();
   if(event==='PASSWORD_RECOVERY'){cloud.recovery=true;showAuth('new-password');}
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
