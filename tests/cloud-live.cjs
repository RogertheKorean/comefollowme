/* Explicit live integration run; creates disposable identities and deletes them in finally.
 * Requires SUPABASE_SECRET_KEY only in the test process. No email messages are sent.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {createClient}=require(process.env.SUPABASE_MODULE||'@supabase/supabase-js');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
if(!secret)throw Error('Live integration tests require an administration credential');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url,secret,options),a=createClient(url,key,options),b=createClient(url,key,options),anon=createClient(url,key,options);
const users=[],results=[];let browser;
function pass(name){results.push(name);console.log('PASS',name);}
function ok(result){if(result.error)throw Error(result.error.code+': '+result.error.message);return result.data;}
(async()=>{
 const runId=randomUUID().slice(0,8),password='Test-'+randomUUID()+'9!';
 for(const label of ['a','b']){const email=`together-test-${runId}-${label}@example.com`;const {user}=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:`검증 ${label.toUpperCase()}`}}));users.push(user);}
 ok(await a.auth.signInWithPassword({email:users[0].email,password}));ok(await b.auth.signInWithPassword({email:users[1].email,password}));pass('Email/password authentication for two independent users');
 const lesson=require('../content/lesson.json');
 const anchor={lessonKey:lesson.id+'@'+lesson.version,lessonId:lesson.id,version:lesson.version,language:'ko',sectionId:'intro',sourceUrl:lesson.sourceUrl.ko,mode:'selection',quote:'연결 검증',segments:[],offsetEncoding:'UTF-16 code units',confidence:'exact'};
 const note={id:randomUUID(),owner_id:users[0].id,author:'검증 A',lesson_key:anchor.lessonKey,language:'ko',body:'자동 연결 검증용 글 '+runId,type:'insight',scope:'class',consent:false,anchor,snapshot:null};
 ok(await a.from('together_notes').insert(note));const privateNote={...note,id:randomUUID(),scope:'private',body:'비공개 연결 검증 '+runId};ok(await a.from('together_notes').insert(privateNote));
 assert.equal(ok(await anon.from('together_notes').select('id').eq('id',note.id)).length,1);
 assert.equal(ok(await b.from('together_notes').select('id').eq('id',privateNote.id)).length,0);
 assert.equal(ok(await anon.from('together_notes').select('id').eq('id',privateNote.id)).length,0);pass('Shared posts are readable; private posts are hidden from guests and other users');
 assert.equal(ok(await b.from('together_notes').update({body:'forbidden'}).eq('id',note.id).select('id')).length,0);
 assert.equal(ok(await b.from('together_notes').delete().eq('id',note.id).select('id')).length,0);
 assert.ok((await b.from('together_notes').insert({...note,id:randomUUID()})).error);
 assert.ok((await anon.from('together_notes').insert({...note,id:randomUUID()})).error);pass('RLS rejects forged owners, signed-out writes and other users editing/deleting');
 ok(await b.from('together_comments').insert({id:randomUUID(),note_id:note.id,owner_id:users[1].id,author:'검증 B',body:'다른 계정의 댓글 '+runId}));
 assert.ok((await b.from('together_comments').insert({id:randomUUID(),note_id:privateNote.id,owner_id:users[1].id,author:'B',body:'forbidden'})).error);
 ok(await b.from('together_reactions').insert({note_id:note.id,owner_id:users[1].id}));
 assert.equal((await b.from('together_reactions').insert({note_id:note.id,owner_id:users[1].id})).error.code,'23505');
 const shared=ok(await a.from('together_notes').select('*,together_comments(*),together_reactions(*)').eq('id',note.id).single());assert.equal(shared.together_comments.length,1);assert.equal(shared.together_reactions.length,1);pass('Replies and reactions persist across identities, with one reaction per person');
 const guest=createClient(url,key,options);const {user:guestUser}=ok(await guest.auth.signInAnonymously({options:{data:{display_name:'검증 비회원'}}}));users.push(guestUser);
 ok(await guest.from('together_comments').insert({id:randomUUID(),note_id:note.id,owner_id:guestUser.id,author:'검증 비회원',body:'비회원 댓글 '+runId}));
 assert.equal(ok(await guest.from('together_notes').update({body:'forbidden'}).eq('id',note.id).select('id')).length,0);pass('Anonymous Auth can participate while retaining separate ownership');
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const origin=process.env.TEST_SITE_URL||'http://127.0.0.1:4173';
 await page.goto(origin);await page.locator('.dashboard-hero').waitFor();await page.waitForFunction(()=>window.TogetherCloud.ready);
 assert.equal(await page.locator('.week-card[data-week]').count(),1);assert.equal(await page.locator('.flow-strip,.v3-launch,.demo-guide-btn').count(),0);await page.evaluate(()=>navigate('community'));assert.match(await page.locator('.stream-banner p').textContent(),/사이트 방문자/);assert.match(await page.locator('.demo-strip').textContent(),/서버에 저장된 실제 공유 글/);assert.doesNotMatch(await page.locator('main').textContent(),/실제 회원 간 공유·로그인은 연결되지 않았습니다|초대받은 반원들의 공간/);await page.evaluate(()=>navigate('dashboard'));pass('Dashboard removes demo guides and the community describes its live public visibility');
 await page.locator('[data-cloud="account"]').click();await page.locator('#authEmail').fill(users[0].email);await page.locator('#authPassword').fill(password);await page.locator('[data-cloud-submit]').click();await page.waitForFunction(()=>window.TogetherCloud.user&&!document.querySelector('#modal').open);await page.evaluate(()=>TogetherCloud.sync({force:true}));
 await page.locator('.week-card[data-week]').first().click();await page.locator('#readerCard').waitFor();
 await page.evaluate(()=>demoTalk());await page.locator('.reference-original').waitFor();
 assert.match(await page.locator('.reference-original').getAttribute('href'),/lang=kor/);assert.equal(await page.locator('.reference-original').getAttribute('target'),'_blank');
 await page.locator('[data-v3="reference-language"][data-language="en"]').click();assert.match(await page.locator('.reference-original').getAttribute('href'),/lang=eng/);
 await context.route('https://www.churchofjesuschrist.org/**',route=>route.fulfill({body:'Official source navigation verified',contentType:'text/plain'}));
 const popupPromise=page.waitForEvent('popup');await page.locator('.reference-original').click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(popup.url(),/churchofjesuschrist\.org/);await popup.close();pass('Prominent official-source link opens the selected language in a new tab');
 await page.locator('[data-enhance="ref-select-verse"]').first().click();await page.locator('[data-enhance="ref-insight"]').click();await page.locator('#insightText').fill('브라우저에서 저장한 검증 글 '+runId);await page.waitForFunction(()=>!composer.capturePending);await page.locator('[data-enhance="share-insight"]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open&&!TogetherCloud.busy);
 const browserNote=await page.evaluate(id=>state.notes.find(n=>n.body==='브라우저에서 저장한 검증 글 '+id),runId);assert.ok(browserNote?.remote);assert.ok(ok(await b.from('together_notes').select('id').eq('id',browserNote.id)).length);pass('Reader composer persists its source anchor, capture and insight to Supabase');
 const second=await browser.newContext(),other=await second.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto(origin);await other.waitForFunction(()=>TogetherCloud.ready);await other.locator('[data-cloud="account"]').click();await other.locator('#authEmail').fill(users[1].email);await other.locator('#authPassword').fill(password);await other.locator('[data-cloud-submit]').click();await other.waitForFunction(()=>TogetherCloud.user&&!document.querySelector('#modal').open);await other.evaluate(()=>TogetherCloud.sync({force:true}));
 await other.evaluate(id=>showThread(id),browserNote.id);await other.locator('#replyText').fill('독립 브라우저 댓글 '+runId);await other.locator('[data-action="send-reply"]').click();await other.waitForFunction(()=>!TogetherCloud.busy&&document.querySelector('#replyText').value==='');await page.evaluate(()=>TogetherCloud.sync({force:true}));
 assert.equal(await page.evaluate(id=>state.notes.find(n=>n.id===id).comments.length,browserNote.id),1);await other.reload();await other.waitForFunction(()=>TogetherCloud.user&&TogetherCloud.ready);assert.equal(await other.evaluate(id=>state.notes.find(n=>n.id===id).comments.length,browserNote.id),1);pass('Two real browser sessions exchange replies and retain them after reload');
 await other.evaluate(id=>showThread(id),browserNote.id);const retryIds=[];let failReply=true;
 await other.route('**/rest/v1/together_comments**',async route=>{if(route.request().method()!=='POST')return route.continue();const payload=route.request().postDataJSON(),record=Array.isArray(payload)?payload[0]:payload;retryIds.push(record.id);if(failReply){failReply=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'simulated temporary failure'})});}return route.continue();});
 const retryBody='실패 후 다시 보내는 댓글 '+runId;await other.locator('#replyText').fill(retryBody);await other.locator('[data-action="send-reply"]').click();await other.waitForFunction(()=>!TogetherCloud.busy);assert.equal(await other.locator('#replyText').inputValue(),retryBody);assert.equal(await other.locator('#replyError').isVisible(),true);
 await other.locator('[data-action="send-reply"]').click();await other.waitForFunction(()=>!TogetherCloud.busy&&document.querySelector('#replyText').value==='');await other.unroute('**/rest/v1/together_comments**');assert.equal(retryIds.length,2);assert.equal(retryIds[0],retryIds[1]);assert.equal(ok(await b.from('together_comments').select('id').eq('id',retryIds[0])).length,1);pass('A failed reply keeps its text and reuses one stable identity on retry');
 const guestContext=await browser.newContext(),guestPage=await guestContext.newPage();guestPage.on('pageerror',e=>errors.push(e.message));await guestPage.goto(origin);await guestPage.waitForFunction(()=>TogetherCloud.ready);await guestPage.evaluate(id=>showThread(id),browserNote.id);await guestPage.locator('.reply-input [data-cloud="signin"]').click();await guestPage.locator('[data-cloud="guest"]').click();await guestPage.locator('#authName').fill('브라우저 비회원');await guestPage.locator('[data-cloud-submit]').click();await guestPage.waitForFunction(()=>TogetherCloud.user?.is_anonymous&&TogetherCloud.ready&&!document.querySelector('#modal').open);users.push({id:await guestPage.evaluate(()=>TogetherCloud.user.id)});
 await guestPage.evaluate(id=>showThread(id),browserNote.id);const guestReply='비회원 화면 댓글 '+runId;await guestPage.locator('#replyText').fill(guestReply);await guestPage.locator('[data-action="send-reply"]').click();await guestPage.waitForFunction(()=>!TogetherCloud.busy&&document.querySelector('#replyText').value==='');assert.equal(ok(await anon.from('together_comments').select('id').eq('body',guestReply)).length,1);pass('Signed-out reply prompt creates a guest session and saves through the visible UI');
 await page.evaluate(()=>TogetherCloud.sync({force:true}));assert.ok(await page.evaluate(id=>state.notes.some(n=>n.id===id&&n.scope==='private'&&n.owner==='me'),privateNote.id));await page.locator('[data-cloud="account"]').click();await page.locator('[data-cloud="signout"]').click();await page.waitForFunction(()=>!TogetherCloud.user&&TogetherCloud.ready);await page.locator('[data-cloud="account"]').click();await page.locator('#authEmail').fill(users[1].email);await page.locator('#authPassword').fill(password);await page.locator('[data-cloud-submit]').click();await page.waitForFunction(id=>TogetherCloud.user?.id===id&&TogetherCloud.ready,users[1].id);assert.equal(await page.evaluate(id=>state.notes.some(n=>n.id===id),privateNote.id),false);pass('Switching accounts in one browser purges the previous account private records');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>navigate('dashboard'));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 fs.mkdirSync('evidence',{recursive:true});await page.screenshot({path:'evidence/08-mobile-dashboard.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'evidence/07-dashboard.png',fullPage:true});
 // Use an admin-generated recovery link, without sending mail to a real recipient.
 const recovery=ok(await admin.auth.admin.generateLink({type:'recovery',email:users[1].email,options:{redirectTo:origin+'/?auth=reset'}}));
 const recoveryContext=await browser.newContext(),recoveryPage=await recoveryContext.newPage();recoveryPage.on('pageerror',e=>errors.push(e.message));
 await recoveryPage.goto(recovery.properties.action_link);await recoveryPage.locator('#authForm[data-mode="new-password"]').waitFor();const newPassword='Changed-'+randomUUID()+'9!';await recoveryPage.locator('#authPassword').fill(newPassword);await recoveryPage.locator('#authConfirm').fill(newPassword);await recoveryPage.locator('[data-cloud-submit]').click();await recoveryPage.locator('#authForm[data-mode="signin"]').waitFor();
 const resetClient=createClient(url,key,options);assert.ok((await resetClient.auth.signInWithPassword({email:users[1].email,password})).error);ok(await resetClient.auth.signInWithPassword({email:users[1].email,password:newPassword}));pass('Recovery link opens the reset form; new password works and old password fails');
 assert.deepEqual(errors,[]);pass('Desktop/mobile workflows have no runtime errors');
 fs.writeFileSync('evidence/cloud-verification.json',JSON.stringify({testedAt:new Date().toISOString(),results,emailDeliveryTested:false,temporaryUsersRemoved:'See successful cleanup output'},null,2));
 console.log('RESULT',results.length,'checks passed');
})().catch(error=>{console.error('FAIL',String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]'));process.exitCode=1;}).finally(async()=>{
 if(browser)await browser.close();let removed=0;for(const user of users){const {error}=await admin.auth.admin.deleteUser(user.id);if(error){console.error('Temporary identity cleanup failed');process.exitCode=1;}else removed++;}
 console.log('Cleanup:',removed,'temporary identities removed');
});
