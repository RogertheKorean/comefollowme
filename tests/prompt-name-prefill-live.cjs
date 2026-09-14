/* Exact disposable fixtures; verifies names and drafts through real browser sessions. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {createClient}=require(process.env.SUPABASE_MODULE||'@supabase/supabase-js');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2];}
const opts={auth:{persistSession:false,autoRefreshToken:false}},service=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,opts);
const runId=randomUUID(),password='Prefill-'+randomUUID()+'9!',promptId=randomUUID(),users=new Set(),watchers=[],results=[],errors=[];
const origin=process.env.TEST_SITE_URL||'http://127.0.0.1:4174';
let chrome,safari,promptCreated=false;
const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
const pass=name=>{results.push(name);console.log('PASS',name);};
async function identity(displayName){const user=ok(await service.auth.admin.createUser({email:'prefill-'+randomUUID()+'@example.invalid',password,email_confirm:true,user_metadata:displayName?{display_name:displayName}:{}})).user;users.add(user.id);return user;}
function watch(page){page.on('pageerror',e=>errors.push(e.message));page.on('response',response=>{if(response.url().includes('/auth/v1/signup')&&response.ok())watchers.push(response.json().then(data=>{if(data.user?.id)users.add(data.user.id);}));});}
async function ready(page){await page.waitForFunction(()=>TogetherCloud.ready&&TogetherPrompts.getState().current&&!TogetherPrompts.getState().loading);}
async function saved(page){await page.waitForFunction(id=>TogetherDrafts.status('prompt-reply',id)?.status==='saved',promptId);}
async function reloadDraft(page,body,name){await page.reload();await ready(page);await page.waitForFunction(({body,name})=>document.querySelector('#promptReplyBody')?.value===body&&document.querySelector('#promptReplyName')?.value===name,{body,name});}
async function profile(page,name){await page.locator('[data-cloud=profile]').click();await page.locator('#participantName').fill(name);await page.locator('#participantForm').evaluate(form=>form.requestSubmit());await page.waitForFunction(()=>!document.querySelector('#modal')?.open);}
async function login(page,user){await page.evaluate(()=>TogetherCloud.showAuth('signin'));await page.locator('#authEmail').fill(user.email);await page.locator('#authPassword').fill(password);await page.locator('[data-cloud-submit]').click();await page.waitForFunction(id=>TogetherCloud.ready&&TogetherCloud.user?.id===id,user.id);await ready(page);}
async function send(page){await page.locator('#promptReplyForm [data-prompt-submit]').click();await page.waitForFunction(()=>!TogetherPrompts.getState().replySubmitting&&document.querySelector('#promptReplyBody')?.value==='');}
(async()=>{
 try{
  const teacher=await identity('테스트 교사'),unnamed=await identity('');
  const row=ok(await service.from('together_prompts').insert({id:promptId,title:'Name prefill '+runId,question:'Share your thought.',reading_text:'Name preference verification.',source_url:'https://www.churchofjesuschrist.org/study/scriptures/ot/isa/1?lang=kor',author:'Test teacher',created_by:teacher.id}).select('slug').single());promptCreated=true;
  const link=origin+'/p/'+row.slug;
  chrome=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  const guest=await chrome.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});watch(guest);await guest.goto(link);await ready(guest);
  assert.equal(await guest.locator('#promptReplyName').inputValue(),'');await profile(guest,'새벽반 민준');assert.equal(await guest.locator('#promptReplyName').inputValue(),'새벽반 민준');assert.equal(await guest.evaluate(()=>TogetherCloud.user),null);
  await guest.reload();await ready(guest);assert.equal(await guest.locator('#promptReplyName').inputValue(),'새벽반 민준');pass('A saved visitor name prefills immediately and after reload without creating an identity');
  await guest.locator('#promptReplyBody').fill('작성 중인 답변 '+runId);await guest.locator('#promptReplyName').fill('답변에 쓸 별명');await profile(guest,'다른 프로필 이름');assert.equal(await guest.locator('#promptReplyName').inputValue(),'답변에 쓸 별명');await saved(guest);
  await reloadDraft(guest,'작성 중인 답변 '+runId,'답변에 쓸 별명');await guest.evaluate(()=>render());assert.equal(await guest.locator('#promptReplyName').inputValue(),'답변에 쓸 별명');pass('An edited alias and body survive profile changes, background render, and draft reload');
  await guest.locator('#promptReplyName').fill('');await saved(guest);await reloadDraft(guest,'작성 중인 답변 '+runId,'');await send(guest);
  const guestRow=ok(await service.from('together_prompt_replies').select('owner_id,author').eq('prompt_id',promptId).eq('body','작성 중인 답변 '+runId).single());users.add(guestRow.owner_id);assert.equal(guestRow.author,'익명');assert.equal(await guest.locator('#promptReplyName').inputValue(),'');pass('An intentionally cleared name remains blank across reload and submits as Anonymous');
  const signed=await chrome.newPage({viewport:{width:1440,height:1000}});watch(signed);await signed.goto(link);await ready(signed);await profile(signed,'공용 기기 별명');await login(signed,teacher);
  await signed.waitForFunction(()=>document.querySelector('#promptReplyName')?.value==='테스트 교사');
  await signed.evaluate(id=>{TogetherDrafts.save('prompt-reply',id,{body:'이전 버전의 초안',name:''});TogetherDrafts.flush('prompt-reply',id);},promptId);
  await reloadDraft(signed,'이전 버전의 초안','테스트 교사');await send(signed);
  const signedRow=ok(await service.from('together_prompt_replies').select('author,owner_id').eq('prompt_id',promptId).eq('body','이전 버전의 초안').single());assert.equal(signedRow.author,'테스트 교사');assert.equal(signedRow.owner_id,teacher.id);assert.equal(await signed.evaluate(()=>localStorage.getItem('together-participant-name')),'공용 기기 별명');assert.equal(await signed.locator('#promptReplyName').inputValue(),'테스트 교사');pass('A signed-in profile fills new and legacy blank-name drafts, submits correctly, and stays filled after success');
  await signed.locator('#promptReplyBody').fill('첫 계정의 비공개 초안');await saved(signed);
  await signed.evaluate(()=>TogetherCloud.client.auth.signOut());await signed.waitForFunction(()=>TogetherCloud.user===null&&TogetherCloud.ready);await login(signed,unnamed);
  await signed.waitForFunction(()=>document.querySelector('#promptReplyName')?.value===''&&document.querySelector('#promptReplyBody')?.value==='');pass('Account changes isolate drafts and an unnamed account does not borrow the previous account or device nickname');
  safari=await webkit.launch({headless:true});const mobile=await safari.newPage({viewport:{width:320,height:844},isMobile:true,hasTouch:true});watch(mobile);await mobile.goto(link);await ready(mobile);await profile(mobile,'웹킷 이름');assert.equal(await mobile.locator('#promptReplyName').inputValue(),'웹킷 이름');await mobile.reload();await ready(mobile);assert.equal(await mobile.locator('#promptReplyName').inputValue(),'웹킷 이름');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await mobile.evaluate(()=>TogetherCloud.user),null);pass('WebKit at 320px preserves the saved visitor name without overflow or sign-in');
  assert.deepEqual(errors,[]);fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/prompt-name-prefill-live.json',JSON.stringify({testedAt:new Date().toISOString(),origin,results,temporaryPromptId:promptId,cleanup:'Exact fixture prompt and tracked identities removed in finally'},null,2));console.log('RESULT',results.length,'checks passed');
 }finally{
  if(chrome)await chrome.close();if(safari)await safari.close();await Promise.all(watchers);
  if(promptCreated)ok(await service.from('together_prompts').delete().eq('id',promptId));
  for(const id of users)ok(await service.auth.admin.deleteUser(id));
  console.log('Cleanup: one fixture prompt and',users.size,'tracked test identities removed');
 }
})().catch(error=>{console.error('FAIL',error.message);process.exitCode=1;});
