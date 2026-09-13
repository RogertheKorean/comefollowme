/* Explicit live database check. Disposable lesson IDs and identities are removed in finally. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID,createHash}=require('node:crypto');
const engine=require('../src/reference-engine.js');
const {createClient}=require(process.env.SUPABASE_MODULE||'@supabase/supabase-js');
for(const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const match=line.match(/^(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2];}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!key||!secret)throw Error('Live lesson publishing test requires public configuration and an administration credential');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,secret,options),visitor=createClient(url,key,options);
const users=[],lessonIds=[],results=[];
function pass(name){results.push(name);console.log('PASS',name);}
function ok(result){if(result.error)throw Error(`${result.error.code||'error'}: ${result.error.message}`);return result.data;}
function trackUser(user){if(user?.id&&!users.some(item=>item.id===user.id))users.push(user);return user;}
function trackLesson(id){if(!lessonIds.includes(id))lessonIds.push(id);return id;}
function hash(value){return createHash('sha256').update(value).digest('hex');}
function bounded(builder){return builder.abortSignal(AbortSignal.timeout(60000));}
function lesson(id,text){return engine.validateLesson({
 id,version:hash(text),title:{ko:`게시 검증 ${text}`,en:`Publishing ${text}`},date:{ko:'2026년 9월',en:'September 2026'},
 sourceUrl:{ko:`https://example.org/${id}`,en:''},sourceLabel:'Published Markdown',translationStatus:'user-provided-unverified',alignment:'korean-only',raw:{ko:text,en:''},
 sections:[{id:'intro',ko:'소개',en:'Introduction'}],blocks:[{id:'b1',sectionId:'intro',conceptId:`${id}-${hash(text)}-0`,kind:'text',ko:text,en:''}]
});}
async function makeUser(label,runId,password,role){
 const created=trackUser(ok(await service.auth.admin.createUser({email:`lesson-publish-${runId}-${label}@example.com`,password,email_confirm:true,user_metadata:{display_name:`Lesson ${label}`}})).user);
 if(role)ok(await service.from('together_staff').insert({user_id:created.id,role}));
 const client=createClient(url,key,options);ok(await client.auth.signInWithPassword({email:created.email,password}));return client;
}
async function denied(result,code='42501'){
 if(!result?.error||result.error.code!==code){const error=result?.error||{};console.error('Unexpected denial response',{expected:code,code:error.code||null,status:error.status||null,statusText:error.statusText||null,message:String(error.message||'').replace(/https?:\/\/\S+/g,'[URL omitted]').slice(0,500)});}
 assert.ok(result?.error,'request should be denied');assert.equal(result.error.code,code);
}

(async()=>{
 const runId=randomUUID().slice(0,8),password=`Lesson-${randomUUID()}9!`,id=trackLesson(`test-${randomUUID()}`);
 const [admin,editor,teacher,ordinary]=await Promise.all([
  makeUser('admin',runId,password,'admin'),makeUser('editor',runId,password,'editor'),makeUser('teacher',runId,password,'teacher'),makeUser('ordinary',runId,password,null)
 ]);
 const anonymous=createClient(url,key,options);trackUser(ok(await anonymous.auth.signInAnonymously()).user);
 const first=lesson(id,'first immutable revision'),second=lesson(id,'second immutable revision'),stale=lesson(id,'stale conflicting revision');

 const firstResult=ok(await bounded(admin.rpc('together_publish_lesson',{p_lesson:first,p_expected_version:null})));assert.deepEqual(firstResult.lesson,first);assert.equal(firstResult.idempotent,false);
 const retry=ok(await bounded(admin.rpc('together_publish_lesson',{p_lesson:first,p_expected_version:null})));assert.deepEqual(retry.lesson,first);assert.equal(retry.idempotent,true);
 const secondResult=ok(await bounded(editor.rpc('together_publish_lesson',{p_lesson:second,p_expected_version:first.version})));assert.deepEqual(secondResult.lesson,second);
 pass('Confirmed admin and editor publish, and an exact transport retry is idempotent');

 await denied(await bounded(admin.rpc('together_publish_lesson',{p_lesson:stale,p_expected_version:first.version})),'PT409');
 const history=ok(await bounded(visitor.from('together_published_lessons').select('lesson_id,version,lesson,revision_number,published_at').eq('lesson_id',id).order('revision_number')));
 assert.deepEqual(history.map(row=>row.version),[first.version,second.version]);assert.deepEqual(history.map(row=>row.lesson),[first,second]);
 pass('Stale publishing conflicts while both immutable historical revisions remain publicly readable');

 await denied(await bounded(teacher.rpc('together_publish_lesson',{p_lesson:stale,p_expected_version:second.version})));
 await denied(await bounded(ordinary.rpc('together_publish_lesson',{p_lesson:stale,p_expected_version:second.version})));
 await denied(await bounded(anonymous.rpc('together_publish_lesson',{p_lesson:stale,p_expected_version:second.version})));
 await denied(await bounded(visitor.rpc('together_publish_lesson',{p_lesson:stale,p_expected_version:second.version})));
 pass('Teacher, ordinary, signed-anonymous, and unsigned callers cannot publish');

 await denied(await bounded(admin.rpc('together_publish_lesson',{p_lesson:{id,version:hash('malformed'),hidden:'field'},p_expected_version:second.version})),'22023');
 await denied(await bounded(admin.rpc('together_publish_lesson',{p_lesson:{...stale,title:'scalar'},p_expected_version:second.version})),'22023');
 const direct={lesson_id:id,version:stale.version,lesson:stale,published_by:users[0].id};
 await denied(await bounded(admin.from('together_published_lessons').insert(direct)));
 await denied(await bounded(editor.from('together_published_lessons').update({lesson:stale}).eq('lesson_id',id)));
 await denied(await bounded(admin.from('together_published_lessons').delete().eq('lesson_id',id)));
 pass('Malformed RPC payloads and authenticated direct table writes are denied');
 console.log('RESULT',results.length,'checks passed');
})().catch(error=>{console.error('FAIL',String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]'));process.exitCode=1;}).finally(async()=>{
 let cleanupFailed=false;
 for(const id of lessonIds){const result=await service.from('together_published_lessons').delete().eq('lesson_id',id);if(result.error){cleanupFailed=true;console.error('Temporary lesson cleanup failed:',id,result.error.code||result.error.message);}}
 for(const user of users){const staff=await service.from('together_staff').delete().eq('user_id',user.id);if(staff.error){cleanupFailed=true;console.error('Temporary staff cleanup failed:',user.id);}const removed=await service.auth.admin.deleteUser(user.id);if(removed.error){cleanupFailed=true;console.error('Temporary identity cleanup failed:',user.id);}}
 if(cleanupFailed)process.exitCode=1;else console.log('Cleanup:',lessonIds.length,'exact lesson ID and',users.length,'temporary identities removed');
});
