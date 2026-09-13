/* Server-backed staff access for local content preparation and presentation tools. */
'use strict';
(function(){
 const EVENT_ORGANIZATIONS=['all','primary','relief','elders','youth','sunday-school'];
 const access={role:null,organizations:[],refresh,can,canManageEvent,allowedEventOrganizations};
 const permissions={content:new Set(['admin','editor']),present:new Set(['admin','teacher']),prompts:new Set(['admin','teacher'])};
 let refreshGeneration=0,lastRoleCheck=0,roleUserId=null,announcedUserId;
 window.TogetherAccess=access;
 state.role='member';

 function verifiedIdentity(){const user=currentUser();return !!user&&!user.is_anonymous&&user.id===roleUserId;}
 function can(permission){if(!verifiedIdentity())return false;if(permission==='events')return access.role==='admin'||access.organizations.length>0;return permissions[permission]?.has(access.role)===true;}
 function allowedEventOrganizations(){if(!verifiedIdentity())return [];if(access.role==='admin'||access.organizations.includes('all'))return [...EVENT_ORGANIZATIONS];return EVENT_ORGANIZATIONS.filter(org=>access.organizations.includes(org));}
 function canManageEvent(row){
  if(!verifiedIdentity()||!Array.isArray(row?.organizations)||!row.organizations.length)return false;
  if(access.role==='admin'||access.organizations.includes('all'))return row.organizations.every(org=>EVENT_ORGANIZATIONS.includes(org));
  return !row.organizations.includes('all')&&row.organizations.every(org=>access.organizations.includes(org));
 }
 function currentUser(){return window.TogetherCloud?.user||null;}
 function announceAccess(){
  const userId=currentUser()?.id||null;
  if(userId!==announcedUserId){announcedUserId=userId;document.dispatchEvent(new CustomEvent('together:identity',{detail:{userId}}));}
  document.dispatchEvent(new CustomEvent('together:access',{detail:{userId,role:access.role,organizations:[...access.organizations]}}));
 }
 function leaveRestrictedUI(){
  if((['import','library'].includes(state.view)&&!can('content'))||(state.view==='classroom'&&!can('present')))state.view='read';
  if(!can('content')&&modalKind==='reference-register')closeModal(false);
  const presentation=$('#presentation');
  if(!can('present')&&presentation&&!presentation.hidden)endPresentation();
 }
 function repaint(){if(typeof refreshPreservingScroll==='function')refreshPreservingScroll();else if(typeof render==='function')render();}
 function deny(permission){
  const user=currentUser();
  if(!user||user.is_anonymous){window.TogetherCloud?.showAuth?.('signin');return false;}
  toast(permission==='present'?E('발표 도구를 사용할 권한이 없습니다.','You do not have permission to use presentation tools.'):E('콘텐츠 도구를 사용할 권한이 없습니다.','You do not have permission to use content tools.'),true);
  return false;
 }
 function requirePermission(permission){return can(permission)||deny(permission);}
 async function refresh(user){
  const generation=++refreshGeneration;
  const requested=arguments.length?user:currentUser();
  access.role=null;access.organizations=[];roleUserId=null;state.role='member';
  if(!requested?.id||requested.is_anonymous||!window.TogetherCloud?.client){leaveRestrictedUI();repaint();announceAccess();return null;}
  const requestedId=requested.id;
  lastRoleCheck=Date.now();
  const [staffResult,managerResult]=await Promise.all([
   window.TogetherCloud.client.from('together_staff').select('role').eq('user_id',requestedId).maybeSingle(),
   window.TogetherCloud.client.from('together_event_managers').select('organization').eq('user_id',requestedId)
  ]);
  if(generation!==refreshGeneration)return access.role;
  const active=currentUser();
  if(active?.id!==requestedId||active?.is_anonymous){access.role=null;access.organizations=[];state.role='member';leaveRestrictedUI();repaint();announceAccess();return null;}
  const role=staffResult.error?null:staffResult.data?.role;
  access.role=permissions.content.has(role)||permissions.present.has(role)||permissions.prompts.has(role)?role:null;
  const granted=new Set(managerResult.error?[]:(managerResult.data||[]).map(row=>row.organization));
  access.organizations=EVENT_ORGANIZATIONS.filter(org=>granted.has(org));
  roleUserId=requestedId;
  state.role=can('present')?'teacher':'member';
  leaveRestrictedUI();
  repaint();
  announceAccess();
  return access.role;
 }

 function strip(markup,selectors){
  const template=document.createElement('template');template.innerHTML=markup;
  for(const node of template.content.querySelectorAll(selectors))node.remove();
  return template.innerHTML;
 }
 function stripRoleSelector(markup,message){
  const template=document.createElement('template');template.innerHTML=markup;
  for(const node of template.content.querySelectorAll('#demoRole')){
   const panel=node.closest('.demo-strip');node.remove();
   const label=panel?.querySelector('span');if(label)label.textContent=message;
  }
  return template.innerHTML;
 }

 const accessNavEntries=navEntries;
 navEntries=function(){return accessNavEntries().filter(([view])=>(!['import','library'].includes(view)||can('content'))&&(view!=='classroom'||can('present')));};
 const accessNavigate=navigate;
 navigate=function(view,...args){if(['import','library'].includes(view)&&!requirePermission('content'))return;if(view==='classroom'&&!requirePermission('present'))return;return accessNavigate(view,...args);};

 const accessCommunityHTML=communityHTML;
 communityHTML=function(){return stripRoleSelector(accessCommunityHTML(),E('공유 글과 댓글은 이 사이트 방문자에게 공개됩니다.','Shared posts and replies are visible to site visitors.'));};
 const accessClassroomHTML=classroomHTML;
 classroomHTML=function(){if(!can('present'))return '';return stripRoleSelector(accessClassroomHTML(),E('서버에서 확인된 교사 권한으로 발표 도구를 사용합니다.','Presentation tools are enabled by a server-verified teacher role.'));};
 const accessLibraryHTML=libraryHTML;
 libraryHTML=function(...args){return can('content')?accessLibraryHTML(...args):strip(accessLibraryHTML(...args),'[data-v3="register-new"],[data-v3="register-url"],[data-v3="export-content"],.content-pack-panel .file-button');};
 const accessAuditTable=auditTable;
 auditTable=function(...args){return can('content')?accessAuditTable(...args):strip(accessAuditTable(...args),'[data-v3="register-url"]');};
 const accessSourceMetadata=sourceMetadata;
 sourceMetadata=function(...args){return can('content')?accessSourceMetadata(...args):strip(accessSourceMetadata(...args),'[data-v3="register-current"]');};
 const accessRenderReference=renderReference;
 renderReference=function(...args){const result=accessRenderReference(...args);if(!can('content'))$$('[data-v3="register-current"]',$('#referenceDrawer')).forEach(node=>node.remove());return result;};

 const accessApplyImport=applyImport;
 applyImport=function(...args){if(!requirePermission('content'))return;return accessApplyImport(...args);};
 const accessShowRegister=showRegister;
 showRegister=function(...args){if(!requirePermission('content'))return;return accessShowRegister(...args);};
 const accessSaveReferenceRegistration=saveReferenceRegistration;
 saveReferenceRegistration=function(...args){if(!requirePermission('content'))return;return accessSaveReferenceRegistration(...args);};
 const accessImportPack=importPack;
 importPack=function(pack,options={}){if(options.persist!==false&&!requirePermission('content'))return;return accessImportPack(pack,options);};
 const accessContentPack=contentPack;
 contentPack=function(...args){if(!can('content'))return null;return accessContentPack(...args);};
 const accessDownloadJSON=downloadJSON;
 downloadJSON=function(...args){if(!requirePermission('content'))return;return accessDownloadJSON(...args);};

 const accessToggleQueue=toggleQueue;
 toggleQueue=function(...args){if(!requirePermission('present'))return;return accessToggleQueue(...args);};
 const accessMoveQueue=moveQueue;
 moveQueue=function(...args){if(!requirePermission('present'))return;return accessMoveQueue(...args);};
 const accessStartPresentation=startPresentation;
 startPresentation=function(...args){if(!requirePermission('present'))return;return accessStartPresentation(...args);};
 const accessDemoClassroom=demoClassroom;
 demoClassroom=function(...args){if(!requirePermission('present'))return;return accessDemoClassroom(...args);};

 if(window.TogetherPrototype){window.TogetherPrototype.importPack=importPack;window.TogetherPrototype.contentPack=contentPack;window.TogetherPrototype.libraryHTML=libraryHTML;}
 window.addEventListener('focus',()=>{const user=currentUser();if(user&&!user.is_anonymous&&Date.now()-lastRoleCheck>60000)void refresh();});
 refresh();
})();
