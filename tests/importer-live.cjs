/* Editor-to-visitor publishing verification. All UUID-tagged rows are removed in finally. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {createClient}=require(process.env.SUPABASE_MODULE||'@supabase/supabase-js');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const options={auth:{persistSession:false,autoRefreshToken:false}},service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,options);
const runId=randomUUID(),password=`Import-${randomUUID()}9!`,source=`https://www.churchofjesuschrist.org/study/manual/import-verification-${runId}/1?lang=kor`,title=`공과 게시 검증 ${runId.slice(0,8)}`;
const scripture='https://www.churchofjesuschrist.org/study/scriptures/ot/isa/1?lang=kor&id=p18#p18';
const raw=`**2026년 9월 14일~20일: “${title}”**\n\n공과 원문 URL: ${source}\n\n## 함께 읽기\n\n[이사야 1:18](${scripture})을 읽고 서로의 생각을 경청해 보세요. ${runId}\n\n## 함께 읽기\n\n반복되는 소제목도 별개의 문단으로 연결됩니다.`;
const results=[],lessonIds=new Set();let editor,browser,webBrowser;
const ok=r=>{if(r.error)throw Error(`${r.error.code}: ${r.error.message}`);return r.data;};
const pass=x=>{results.push(x);console.log('PASS',x);};
async function openImport(page){await page.evaluate(()=>TogetherNavigation.navigate('import'));await page.locator('[data-import=analyze]').waitFor();}
async function login(page){const menu=page.locator('[data-action=menu-open]');if(await menu.isVisible())await menu.click();await page.locator('#sidebar [data-cloud=account]').click();await page.locator('#authEmail').fill(editor.email);await page.locator('#authPassword').fill(password);await page.locator('[data-cloud-submit]').click();await page.waitForFunction(()=>TogetherAccess.can('content'));}
async function review(page){await page.locator('[data-import=review]').click();await page.locator('.import-reading-preview').waitFor();}
async function confirmReview(page){await page.locator('#importAlignment').check();await page.locator('#importRights').check();}
async function checkRichPaste(page){
 await page.locator('#importKO').fill('앞\n\n선택\n\n뒤');
 const pasted=await page.locator('#importKO').evaluate((area,{source,title,scripture})=>{
  area.setSelectionRange(3,5);const clip=new DataTransfer();clip.setData('text/plain','Plain clipboard fallback');
  clip.setData('text/html',`<article><header><p><b>2026년 9월 14일~20일: “${title}”</b></p></header><p>공과 원문 URL: <a href="${source}">공과 원문</a></p><p><a href="${scripture}">이사야 1:18</a>을 읽어 보세요.</p><script>window.pasteExecuted=true</script><img src="https://clipboard-probe.invalid/pixel"></article>`);
  const event=new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true});area.dispatchEvent(event);
  return {prevented:event.defaultPrevented,value:area.value,executed:window.pasteExecuted===true,draft:TogetherImporter.getDraft().ko};
 },{source,title,scripture});
 assert.equal(pasted.prevented,true);assert.equal(pasted.executed,false);assert.equal(pasted.draft,pasted.value);assert.ok(pasted.value.startsWith('앞\n\n**2026'));assert.ok(pasted.value.endsWith('\n\n뒤'));assert.ok(pasted.value.includes(`[이사야 1:18](${scripture})`));
 await page.locator('[data-import=analyze]').click();assert.equal(await page.locator('#importTitleKO').inputValue(),title);assert.equal(await page.locator('#importURL').inputValue(),source);assert.match(await page.locator('#importNotice').textContent(),/한국어 2/);
 const fallback=await page.locator('#importKO').evaluate(area=>{const before=area.value,clip=new DataTransfer();clip.setData('text/plain','[Already Markdown](https://example.test)');const event=new ClipboardEvent('paste',{clipboardData:clip,bubbles:true,cancelable:true});area.dispatchEvent(event);return {prevented:event.defaultPrevented,unchanged:area.value===before};});
 assert.deepEqual(fallback,{prevented:false,unchanged:true});
}
(async()=>{try{
 editor=ok(await service.auth.admin.createUser({email:`import-ui-${runId}@example.invalid`,password,email_confirm:true})).user;
 ok(await service.from('together_staff').insert({user_id:editor.id,role:'editor'}));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
 const origin=process.env.TEST_SITE_URL||'http://127.0.0.1:4174',ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.waitForFunction(()=>TogetherCloud.ready&&TogetherPublishing);await page.evaluate(()=>TogetherPublishing.ready);
 await login(page);await openImport(page);
 assert.deepEqual(await page.locator('.import-workspace section.panel > h2').allTextContents(),['1. 원문 넣고 분석하기','2. 공과 기본 정보 확인','3. 미리 보고 게시']);
 assert.equal(await page.locator('#importKO').inputValue(),'');assert.equal(await page.locator('#importTitleKO').inputValue(),'');
 const clipboardRequests=[];page.on('request',r=>{if(r.url().includes('clipboard-probe.invalid'))clipboardRequests.push(r.url());});
 await checkRichPaste(page);assert.deepEqual(clipboardRequests,[]);pass('Webpage paste preserves headings and links at the selected position, updates the draft, and keeps plain-text paste native');
 await page.locator('#importKO').fill(raw);await page.locator('[data-import=analyze]').click();
 assert.equal(await page.locator('#importTitleKO').inputValue(),title);assert.equal(await page.locator('#importDate').inputValue(),'2026-09-14/2026-09-20');assert.equal(await page.locator('#importURL').inputValue(),source);
 await page.locator('#importTitleKO').fill(title+' 수정');await page.locator('[data-import=analyze]').click();assert.equal(await page.locator('#importTitleKO').inputValue(),title+' 수정');
 await page.locator('#importKO').fill('다른 본문입니다. 제목과 기간은 없습니다.');await page.locator('[data-import=analyze]').click();
 for(const id of ['importTitleKO','importDate','importURL'])assert.equal(await page.locator('#'+id).inputValue(),'');
 pass('Input-first order, extracted title/date/source, manual corrections and clearing missing metadata');
 await page.locator('#importKO').fill(raw);await page.locator('[data-import=analyze]').click();await review(page);
 await page.locator('#importTitleKO').fill(title+' 최종');assert.equal(await page.locator('.import-reading-preview').count(),0);assert.equal(await page.locator('[data-import=publish]').isDisabled(),true);await review(page);await confirmReview(page);
 assert.equal((await service.from('together_published_lessons').select('lesson_id').eq('published_by',editor.id)).data.length,0);
 const requests=[];let failFirst=true;
 await page.route('**/rest/v1/rpc/together_publish_lesson',async route=>{const data=route.request().postDataJSON();requests.push(data);lessonIds.add(data.p_lesson.id);if(failFirst){failFirst=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'verification retry'})});}return route.continue();});
 await page.locator('[data-import=publish]').click();await page.locator('#importError:not([hidden])').waitFor();assert.equal(await page.locator('#importKO').inputValue(),raw);assert.equal(await page.locator('.import-reading-preview').count(),1);
 await page.locator('[data-import=publish]').click();await page.locator('.dashboard').waitFor();assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
 const first=requests[1].p_lesson;assert.ok(first.version.length===64);assert.equal(await page.evaluate(()=>TogetherDrafts.read('lesson-import','editor')),null);
 const visitorContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),visitor=await visitorContext.newPage();visitor.on('pageerror',e=>errors.push(e.message));await visitor.goto(origin);await visitor.waitForFunction(id=>!!TogetherPublishing?.getLatest(id),first.id);
 assert.equal(await visitor.evaluate(()=>TogetherCloud.user),null);assert.equal(await visitor.locator(`[data-week="${first.id}@${first.version}"]`).count(),1);
 await visitor.locator(`[data-week="${first.id}@${first.version}"]`).click();assert.match(await visitor.locator('#readerCard').textContent(),new RegExp(runId));
 assert.ok(await visitor.locator('#readerCard a[data-ref-url*="/isa/1"]').count()>0);
 pass('Reviewed exact payload retries safely, publishes to server, clears its draft, and reaches an unsigned visitor');
 await openImport(page);await page.locator('#importLessonPicker').selectOption(first.id+'@'+first.version);await page.locator('[data-import=load]').click();assert.equal(await page.locator('#importKO').inputValue(),raw);
 await page.locator('#importTitleKO').fill(title+' 두 번째');await review(page);await confirmReview(page);await page.locator('[data-import=publish]').click();await page.locator('.dashboard').waitFor();
 const second=await page.evaluate(id=>TogetherPublishing.getLatest(id),first.id);assert.notEqual(second.version,first.version);assert.equal(second.title.ko,title+' 두 번째');
 assert.equal(await page.locator(`.week-grid [data-week^="${first.id}@"]`).count(),1);
 assert.equal((await page.evaluate(id=>TogetherPublishing.getLessons().filter(l=>l.id===id),first.id)).length,2);
 await visitor.reload();await visitor.waitForFunction(({id,version})=>TogetherPublishing?.getLatest(id)?.version===version,{id:first.id,version:second.version});
 pass('Publishing an edit shows one latest card while retaining the previous readable revision');
 await openImport(page);await page.locator('#importLessonPicker').selectOption(first.id+'@'+second.version);await page.locator('[data-import=load]').click();await page.locator('#importTitleKO').fill(title+' 내 수정');await review(page);await confirmReview(page);
 await page.evaluate(async id=>{const latest=TogetherPublishing.getLatest(id),expected=latest.version;latest.version=crypto.randomUUID();latest.title.ko+=' 다른 탭 수정';const result=await TogetherCloud.client.rpc('together_publish_lesson',{p_lesson:latest,p_expected_version:expected});if(result.error)throw Error(result.error.message);},first.id);
 await page.locator('[data-import=publish]').click();await page.locator('#importError:not([hidden])').waitFor();assert.match(await page.locator('#importError').textContent(),/다른 담당자/);assert.equal(await page.locator('#importTitleKO').inputValue(),title+' 내 수정');assert.equal(await page.locator('#importKO').inputValue(),raw);
 pass('A real concurrent edit produces an immediate conflict message and preserves the operator’s work');
 await openImport(page);await page.locator('#importKO').fill(raw+'\n\n아직 게시하지 않은 초안');await page.waitForTimeout(1000);await page.reload();await page.waitForFunction(()=>TogetherAccess.can('content'));await openImport(page);assert.match(await page.locator('#importKO').inputValue(),/아직 게시하지 않은 초안/);assert.equal(await page.locator('[data-import=publish]').isDisabled(),true);
 const old=await page.locator('#importKO').inputValue();await page.evaluate(()=>render());assert.equal(await page.locator('#importKO').inputValue(),old);
 pass('An unfinished import survives reload and background render, with review required again');
 webBrowser=await webkit.launch({headless:true});
 for(const [engineBrowser,name]of [[browser,'chromium'],[webBrowser,'webkit']]){
  const context=await engineBrowser.newContext({viewport:{width:320,height:844},isMobile:true,hasTouch:true}),mobile=await context.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(origin);await mobile.waitForFunction(()=>TogetherCloud.ready&&TogetherPublishing);await login(mobile);await openImport(mobile);await checkRichPaste(mobile);await mobile.locator('#importKO').fill(raw);await mobile.locator('[data-import=analyze]').click();await review(mobile);
  const metrics=await mobile.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,font:parseFloat(getComputedStyle(document.querySelector('#importURL')).fontSize)}));assert.equal(metrics.overflow,false);assert.ok(metrics.font>=16);
  fs.mkdirSync('evidence',{recursive:true});await mobile.screenshot({path:`evidence/import-${name}-320.png`,fullPage:true});await context.close();
 }
 assert.deepEqual(errors,[]);pass('Chromium and WebKit 320px editor/preview fit the viewport with 16px inputs and no runtime errors');
 fs.writeFileSync('evidence/importer-live.json',JSON.stringify({testedAt:new Date().toISOString(),origin,results,cleanup:'Finally removes revisions owned by the tracked disposable editor'},null,2));
}finally{
 if(browser)await browser.close();if(webBrowser)await webBrowser.close();
 if(editor){const rows=ok(await service.from('together_published_lessons').select('lesson_id').eq('published_by',editor.id));for(const row of rows)lessonIds.add(row.lesson_id);for(const id of lessonIds)ok(await service.from('together_published_lessons').delete().eq('lesson_id',id).eq('published_by',editor.id));ok(await service.from('together_staff').delete().eq('user_id',editor.id));ok(await service.auth.admin.deleteUser(editor.id));console.log('Cleanup: tracked editor and',lessonIds.size,'test lesson histories removed');}
}})().catch(e=>{console.error('FAIL',e.message);process.exitCode=1;});
