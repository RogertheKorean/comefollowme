/* Live contract test for study questions and ward calendar.
 * It creates only UUID-tagged disposable data and removes every created row/user in finally.
 * Run after migrations 004/005 and the interactive mockup are available.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {createClient}=require(process.env.SUPABASE_MODULE||'@supabase/supabase-js');

for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){
 const match=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);
 if(match&&!process.env[match[1]])process.env[match[1]]=match[2];
}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!key||!secret)throw Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, and SUPABASE_SECRET_KEY are required');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,secret,options),visitor=createClient(url,key,options);
const users=[],promptIds=[],replyIds=[],eventIds=[],posterPaths=[],results=[];
const runId=randomUUID().slice(0,12),password=`Community-${randomUUID()}9!`;
// Generate a valid RGB PNG with Node's codec instead of relying on a copied fixture.
const PNG_1X1=(()=>{const width=120,height=160,raw=Buffer.alloc(height*(width*3+1)),header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(width*3+1)+1+x*3;raw[i]=y<35?41:222;raw[i+1]=y<35?78:234;raw[i+2]=y<35?62:204;}const chunk=(type,data)=>{const name=Buffer.from(type),body=Buffer.concat([name,data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);body.copy(out,4);let crc=0xffffffff;for(const byte of body){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);return out;};return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',require('node:zlib').deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);})();
const mark=name=>{results.push(name);console.log('PASS',name)};
const unwrap=result=>{if(result.error)throw Error(`${result.error.code||'error'}: ${result.error.message}`);return result.data};
const deny=async promise=>{const result=await promise;assert.ok(result.error||(Array.isArray(result.data)&&result.data.length===0),`expected RLS denial, received ${JSON.stringify(result.data)}`);return result};
const client=()=>createClient(url,key,options);
const rememberUser=id=>{if(id&&!users.includes(id))users.push(id);};
async function cleanupResult(label,promise,issues){try{const result=await promise;if(result?.error)issues.push(`${label}: ${result.error.code||result.error.message}`);}catch(error){issues.push(`${label}: ${error.message||error}`);}}
async function createUser(label){
 const email=`community-${runId}-${label}@example.invalid`;
 const user=unwrap(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:`Community ${label}`}})).user;
 rememberUser(user.id);return user;
}
async function signIn(c,user){unwrap(await c.auth.signInWithPassword({email:user.email,password}));return c;}
const promptPayload=(owner,suffix)=>({
 id:randomUUID(),title:`Live question ${suffix}`,question:`What did you notice? ${runId}`,reading_text:'Read this short test passage.',source_url:'https://www.churchofjesuschrist.org/study/scriptures/nt/john/3?lang=eng',reference_label:'John 3',anchor:{lessonKey:'community-live',quote:'Read this short test passage.'},lesson_key:'community-live',author:`Author ${suffix}`,created_by:owner
});
const eventPayload=(owner,organizations,status='draft')=>({
 id:randomUUID(),title:`Live event ${runId}`,description:'Disposable live event verification.',starts_at:'2030-01-10T10:00:00Z',ends_at:'2030-01-10T11:00:00Z',timezone:'Asia/Seoul',location:'Test room',organizations,status,created_by:owner
});

(async()=>{
 let browser,publishedEventSlug='';
 try{
  const [adminUser,teacherUser,otherTeacherUser,managerUser,ordinaryUser]=await Promise.all(['admin','teacher','other-teacher','manager','ordinary'].map(createUser));
  const [staffAdmin,teacher,otherTeacher,manager,ordinary]=await Promise.all([adminUser,teacherUser,otherTeacherUser,managerUser,ordinaryUser].map(async user=>signIn(client(),user)));
  unwrap(await service.from('together_staff').insert([{user_id:adminUser.id,role:'admin'},{user_id:teacherUser.id,role:'teacher'},{user_id:otherTeacherUser.id,role:'teacher'}]));
  mark('Disposable admin, two teachers, manager, and ordinary email identities were created without using existing users');

  const prompt=promptPayload(teacherUser.id,'teacher');
  unwrap(await teacher.from('together_prompts').insert(prompt));promptIds.push(prompt.id);
  const publicPrompt=unwrap(await visitor.from('together_prompts').select('id,slug,title,created_by').eq('id',prompt.id).single());
  assert.equal(publicPrompt.id,prompt.id);assert.match(publicPrompt.slug,/^[a-f0-9]{12}$/);assert.equal(publicPrompt.created_by,teacherUser.id);
  mark('A teacher can create a 12-hex-slug question and visitors can read its short-link record without authentication');

  await deny(ordinary.from('together_prompts').insert(promptPayload(ordinaryUser.id,'ordinary')));
  await deny(otherTeacher.from('together_prompts').update({title:'cross-owner edit'}).eq('id',prompt.id).select('id'));
  unwrap(await teacher.from('together_prompts').update({title:'Teacher edited question'}).eq('id',prompt.id).select('id').single());
  unwrap(await staffAdmin.from('together_prompts').update({title:'Admin edited question'}).eq('id',prompt.id).select('id').single());
  const immutable=await teacher.from('together_prompts').update({slug:'abcdefabcdef',created_by:teacherUser.id}).eq('id',prompt.id);
  assert.ok(immutable.error,'slug must be immutable by column grant');
  mark('Ordinary email cannot author, another teacher cannot edit, owner teacher and admin can edit, and prompt slug remains immutable');

  const anon=client();const anonymous=unwrap(await anon.auth.signInAnonymously()).user;users.push(anonymous.id);
  const reply={id:randomUUID(),prompt_id:prompt.id,owner_id:anonymous.id,author:'Anonymous',body:`Anonymous reply ${runId}`};
  unwrap(await anon.from('together_prompt_replies').insert(reply));replyIds.push(reply.id);
  const publicReplies=unwrap(await visitor.from('together_prompt_replies').select('id,body').eq('id',reply.id));assert.equal(publicReplies.length,1);
  await deny(ordinary.from('together_prompt_replies').insert({...reply,id:randomUUID(),owner_id:anonymous.id}));
  mark('An anonymous identity can create one owned public reply; public visitors can read it and an ordinary user cannot forge its owner');

  unwrap(await staffAdmin.rpc('together_set_event_manager',{target_email:managerUser.email,target_organization:'primary',enabled:true}));
  const primaryDraft=eventPayload(managerUser.id,['primary']);unwrap(await manager.from('together_events').insert(primaryDraft));eventIds.push(primaryDraft.id);
  const managerDraft=unwrap(await manager.from('together_events').select('id,status,organizations').eq('id',primaryDraft.id).single());assert.equal(managerDraft.status,'draft');
  assert.equal(unwrap(await visitor.from('together_events').select('id').eq('id',primaryDraft.id)).length,0);
  const posterPath=`${primaryDraft.id}/community-${runId}.png`;posterPaths.push(posterPath);
  unwrap(await manager.storage.from('together-event-posters').upload(posterPath,PNG_1X1,{contentType:'image/png',upsert:false}));
  assert.ok(unwrap(await manager.storage.from('together-event-posters').download(posterPath)),'manager reads its private draft upload');
  assert.ok((await visitor.storage.from('together-event-posters').download(posterPath)).error,'visitor cannot read an unattached draft poster');
  await deny(manager.from('together_events').update({organizations:['relief']}).eq('id',primaryDraft.id).select('id'));
  await deny(manager.from('together_events').insert(eventPayload(managerUser.id,['all'])));
  const publishedEvent=unwrap(await manager.from('together_events').update({title:`Managed primary ${runId}`,status:'published',poster_path:posterPath}).eq('id',primaryDraft.id).select('id,slug').single());publishedEventSlug=publishedEvent.slug;
  assert.equal(unwrap(await visitor.from('together_events').select('id,status').eq('id',primaryDraft.id)).length,1);
  assert.ok(unwrap(await visitor.storage.from('together-event-posters').download(posterPath)),'visitor reads the exact poster attached to a published event');
  unwrap(await manager.from('together_events').update({status:'draft'}).eq('id',primaryDraft.id).select('id').single());
  assert.ok((await visitor.storage.from('together-event-posters').download(posterPath)).error,'visitor loses poster access when the event returns to draft');
  unwrap(await manager.from('together_events').update({status:'cancelled'}).eq('id',primaryDraft.id).select('id').single());
  assert.equal(unwrap(await visitor.from('together_events').select('status').eq('id',primaryDraft.id).single()).status,'cancelled');
  const eventSlugUpdate=await manager.from('together_events').update({slug:'abcdefabcdef'}).eq('id',primaryDraft.id);assert.ok(eventSlugUpdate.error,'event slug must be immutable');
  mark('A primary manager can create/manage only primary events; an all-audience event needs an explicit all grant; drafts remain non-public, while published and cancelled events stay public and slug is immutable');

  const adminDraft=eventPayload(adminUser.id,['relief']);unwrap(await staffAdmin.from('together_events').insert(adminDraft));eventIds.push(adminDraft.id);
  await deny(manager.from('together_events').update({title:'cross organization'}).eq('id',adminDraft.id).select('id'));
  await deny(ordinary.from('together_events').insert(eventPayload(ordinaryUser.id,['primary'],'published')));
  await deny(ordinary.from('together_event_managers').insert({user_id:ordinaryUser.id,organization:'all'}));
  unwrap(await ordinary.auth.updateUser({data:{role:'admin',organizations:['all'],together_staff:true}}));
  await deny(ordinary.from('together_events').insert(eventPayload(ordinaryUser.id,['all'],'published')));
  mark('Cross-organization management, ordinary event writes, direct self-grants, and JWT metadata spoofing are denied');

  /* UI tests deliberately wait for the shared mockup's stable selectors. */
  console.log('BROWSER community UI phase');
  const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  const origin=process.env.TEST_SITE_URL||'http://127.0.0.1:4173';
  const page=await (await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true})).newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('response',async response=>{if(response.request().method()!=='POST'||!/\/auth\/v1\/signup/.test(response.url())||!response.ok())return;try{rememberUser((await response.json()).user?.id);}catch{}});
  await page.goto(`${origin}/questions`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.TogetherCloud?.ready,{timeout:20000});
  console.log('BROWSER questions route ready');
  assert.ok(await page.locator('[data-nav="prompts"]').count()>=1,'questions navigation selector is required');
  assert.ok(await page.locator('[data-nav="calendar"]').count()>=1,'calendar navigation selector is required');
  await page.locator('[data-prompt-open]').first().waitFor();
  await page.goto(`${origin}/p/${publicPrompt.slug}`,{waitUntil:'domcontentloaded'});await page.locator('#promptReplyBody').waitFor();
  const anonymousRequests=[];page.on('request',request=>{if(/\/auth\/v1\/signup/.test(request.url()))anonymousRequests.push(request.url());});
  const replyPostIds=[];let rejectFirstReply=true;
  await page.route('**/rest/v1/together_prompt_replies**',async route=>{if(route.request().method()!=='POST')return route.continue();const row=route.request().postDataJSON();replyPostIds.push((Array.isArray(row)?row[0]:row).id);if(rejectFirstReply){rejectFirstReply=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'test retry'})});}return route.continue();});
  const browserReply=`Browser anonymous reply ${runId}`;
  await page.locator('#promptReplyBody').fill(browserReply);await page.waitForTimeout(1000);
  assert.equal(unwrap(await visitor.from('together_prompt_replies').select('id').eq('body',browserReply)).length,0,'a prompt draft is not public before submit');
  await page.reload();await page.locator('#promptReplyBody').waitFor();assert.equal(await page.locator('#promptReplyBody').inputValue(),browserReply,'a prompt draft restores after reload');
  await page.locator('[data-prompt-submit]').click();
  await page.waitForFunction(()=>window.TogetherCloud?.user?.is_anonymous===true,{timeout:15000});
  rememberUser(await page.evaluate(()=>TogetherCloud.user.id));
  await page.waitForFunction(()=>!document.querySelector('[data-prompt-submit]')?.disabled);assert.equal(await page.locator('#promptReplyBody').inputValue(),browserReply);await page.locator('[data-prompt-submit]').click();await page.waitForFunction(()=>document.querySelector('#promptReplyBody')?.value==='');assert.equal(replyPostIds.length,2);assert.equal(replyPostIds[0],replyPostIds[1]);assert.match(replyPostIds[0],/^[0-9a-f-]{36}$/i);replyIds.push(replyPostIds[0]);assert.equal(unwrap(await visitor.from('together_prompt_replies').select('id').eq('id',replyPostIds[0])).length,1,'submitted prompt reply is public');await page.reload();await page.waitForFunction(()=>window.TogetherCloud?.ready);await page.locator('#promptReplyBody').waitFor();assert.equal(await page.locator('#promptReplyBody').inputValue(),'','a successful prompt submit clears its draft');assert.equal(anonymousRequests.length,1);
  await page.evaluate(async credentials=>{const result=await TogetherCloud.client.auth.signInWithPassword(credentials);if(result.error)throw new Error(result.error.message);await TogetherAccess.refresh(TogetherCloud.user);},{email:teacherUser.email,password});
  await page.waitForFunction(email=>TogetherCloud?.user?.email===email&&TogetherAccess?.role==='teacher',teacherUser.email);
  await page.goto(`${origin}/questions`,{waitUntil:'domcontentloaded'});await page.locator('[data-prompt-action="new"]').click();await page.locator('#promptEditorForm').waitFor();
  const uiPromptTitle=`UI teacher question ${runId}`;
  await page.locator('#promptTitle').fill(uiPromptTitle);await page.locator('#promptQuestion').fill('What do you notice in this reading?');await page.locator('#promptReference').fill('');await page.locator('#promptReading').fill('A short, browser-created reading for this disposable question.');await page.locator('#promptSource').fill('https://www.churchofjesuschrist.org/study/scriptures/nt/john/3?lang=eng');await page.locator('[data-prompt-action="preview"]').click();await page.locator('#promptEditorPreview:not([hidden])').waitFor();await page.locator('#promptEditorForm [data-prompt-submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal')?.open);
  const uiPrompt=unwrap(await service.from('together_prompts').select('id,slug,reference_label,question').eq('title',uiPromptTitle).single());promptIds.push(uiPrompt.id);assert.equal(uiPrompt.reference_label,null,'a blank prompt reference persists as null');assert.equal(unwrap(await visitor.from('together_prompts').select('id').eq('id',uiPrompt.id)).length,1,'a teacher-published prompt is public');
  await page.locator('[data-prompt-action="edit"]').click();await page.locator('#promptEditorForm').waitFor();await page.locator('#promptQuestion').fill('What did this browser-created reading invite you to do?');await page.locator('#promptEditorForm [data-prompt-submit]').click();await page.waitForFunction(()=>!document.querySelector('#modal')?.open);const uiPromptEdited=unwrap(await service.from('together_prompts').select('question,reference_label').eq('id',uiPrompt.id).single());assert.equal(uiPromptEdited.question,'What did this browser-created reading invite you to do?');assert.equal(uiPromptEdited.reference_label,null,'editing preserves a blank prompt reference as null');
  await page.goto(`${origin}/calendar`,{waitUntil:'domcontentloaded'});await page.locator('.calendar-workspace').waitFor();
  console.log('BROWSER calendar route ready');
  await page.locator('[data-calendar-layout="list"]').click();
  const mobileBox=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(mobileBox.document<=mobileBox.viewport+1&&mobileBox.body<=mobileBox.viewport+1,`calendar overflow ${JSON.stringify(mobileBox)}`);
  await page.goto(`${origin}/e/${publishedEventSlug}`,{waitUntil:'domcontentloaded'});await page.locator('.calendar-detail').waitFor();assert.match(await page.locator('.calendar-detail h1').textContent(),new RegExp(runId));
  await page.goBack();await page.locator('.calendar-workspace').waitFor();await page.goForward();await page.locator('.calendar-detail').waitFor();
  await page.evaluate(async credentials=>{const result=await TogetherCloud.client.auth.signInWithPassword(credentials);if(result.error)throw new Error(result.error.message);await TogetherAccess.refresh(TogetherCloud.user);},{email:managerUser.email,password});
  await page.waitForFunction(email=>TogetherCloud?.user?.email===email&&TogetherAccess?.allowedEventOrganizations?.().includes('primary'),managerUser.email);
  await page.goto(`${origin}/calendar`,{waitUntil:'domcontentloaded'});await page.locator('[data-calendar-action="new"]').click();await page.locator('#eventEditorForm').waitFor();
  const uiTitle=`UI manager event ${runId}`;
  await page.locator('#eventTitle').fill(uiTitle);await page.locator('#eventDate').fill('2026-09-20');await page.locator('#eventEndDate').fill('2026-09-20');await page.locator('#eventStart').fill('10:00');await page.locator('#eventEnd').fill('11:00');await page.locator('#eventLocation').fill('UI test room');await page.locator('#eventDescription').fill('Draft created, previewed, published, cancelled, restored, and deleted by the assigned manager.');
  const primaryBox=page.locator('input[name="eventOrganization"][value="primary"]');if(!await primaryBox.isChecked())await primaryBox.check();
  await page.locator('#eventPoster').setInputFiles({name:'ui-poster.png',mimeType:'image/png',buffer:PNG_1X1});await page.locator('[data-calendar-action="save-draft"]').click();await page.waitForFunction(()=>!document.querySelector('#modal')?.open);
  const uiDraft=unwrap(await service.from('together_events').select('id,slug,status,poster_path').eq('title',uiTitle).single());eventIds.push(uiDraft.id);if(uiDraft.poster_path)posterPaths.push(uiDraft.poster_path);assert.equal(uiDraft.status,'draft');assert.equal(unwrap(await visitor.from('together_events').select('id').eq('id',uiDraft.id)).length,0);
  await page.goto(`${origin}/e/${uiDraft.slug}`,{waitUntil:'domcontentloaded'});await page.locator('.calendar-detail').waitFor();await page.locator('[data-calendar-action="edit"]').click();await page.locator('#eventEditorForm').waitFor();await page.locator('#eventDescription').fill('Edited draft before public publication.');await page.locator('[data-calendar-action="preview"]').click();await page.locator('.calendar-preview-banner').waitFor();await page.locator('[data-calendar-action="publish"]').click();await page.waitForFunction(()=>!document.querySelector('#modal')?.open);assert.equal(unwrap(await visitor.from('together_events').select('id').eq('id',uiDraft.id)).length,1);await page.locator('#app .calendar-detail .calendar-poster').waitFor();await page.waitForFunction(()=>document.querySelector('#app .calendar-detail .calendar-poster')?.naturalWidth>0);await page.screenshot({path:'evidence/community-calendar-manager-published.png',fullPage:false});
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-calendar-action="cancel"]').click();await page.locator('.calendar-cancelled-notice').waitFor();await page.locator('[data-calendar-action="restore"]').click();await page.locator('[data-calendar-action="cancel"]').waitFor();page.once('dialog',dialog=>dialog.accept());await page.locator('[data-calendar-action="delete"]').click();await page.waitForFunction(()=>location.pathname==='/calendar'&&window.TogetherCalendar?.getState?.().slug===null&&!window.TogetherCalendar?.getState?.().busy);assert.equal(unwrap(await service.from('together_events').select('id').eq('id',uiDraft.id)).length,0);
  assert.equal(pageErrors.length,0,`page errors: ${pageErrors.join('; ')}`);
  mark('Mobile public question and calendar routes retain their direct short links through back/forward, keep a 390px layout free of horizontal overflow, and create an anonymous identity only on first reply submit with a stable retry UUID');
  mark('A teacher creates, previews, publishes, and edits an owned question through the prompt editor; an intentionally blank reference remains null');
  mark('An assigned primary manager creates a draft with a poster, keeps it private, edits and previews it, publishes it, then cancels, restores, and deletes it through the calendar UI');
 } finally {
  const cleanupIssues=[];
  if(browser)await browser.close().catch(()=>{});
  if(posterPaths.length)await cleanupResult('poster cleanup',service.storage.from('together-event-posters').remove([...new Set(posterPaths)]),cleanupIssues);
  for(const id of replyIds)await cleanupResult(`reply ${id}`,service.from('together_prompt_replies').delete().eq('id',id),cleanupIssues);
  for(const id of promptIds)await cleanupResult(`prompt ${id}`,service.from('together_prompts').delete().eq('id',id),cleanupIssues);
  for(const id of eventIds)await cleanupResult(`event ${id}`,service.from('together_events').delete().eq('id',id),cleanupIssues);
  for(const id of users)await cleanupResult(`user ${id}`,service.auth.admin.deleteUser(id),cleanupIssues);
  console.log(`CLEANUP users=${users.length} prompts=${promptIds.length} replies=${replyIds.length} events=${eventIds.length} posters=${new Set(posterPaths).size}`);
  if(cleanupIssues.length)throw Error(`Cleanup failed: ${cleanupIssues.join('; ')}`);
 }
 fs.mkdirSync('evidence',{recursive:true});
 fs.writeFileSync('evidence/community-live.json',JSON.stringify({runId,origin:process.env.TEST_SITE_URL,completedAt:new Date().toISOString(),checks:results,cleanup:{users:users.length,prompts:promptIds.length,replies:replyIds.length,events:eventIds.length,posters:new Set(posterPaths).size}},null,2)+'\n');
 console.log('Community live checks complete:',results.length);
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
