/* Explicit live RLS check for comments and hearts on question replies.
 * Every user and row has an exact disposable UUID and is removed in finally.
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
if(!url||!key||!secret)throw Error('Live prompt discussion test requires public configuration and an administration credential');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const service=createClient(url,secret,options),visitor=createClient(url,key,options);
const COMMENTS='together_prompt_reply_comments',REACTIONS='together_prompt_reply_reactions';
const users=[],promptIds=[],replyIds=[],commentIds=[],reactionKeys=[],legacyNoteIds=[],legacyCommentIds=[],legacyReactionKeys=[],results=[];
const runId=randomUUID().slice(0,12);

function ok(result){if(result.error)throw Error(`${result.error.code||'error'}: ${result.error.message}`);return result.data;}
function pass(name){results.push(name);console.log('PASS',name);}
async function deny(label,builder){const result=await builder;assert.ok(result.error,`${label} should be denied; received ${JSON.stringify(result.data)}`);return result.error;}
async function makeAnonymous(){const client=createClient(url,key,options),user=ok(await client.auth.signInAnonymously()).user;users.push(user.id);return {client,user};}
async function cleanup(label,promise,failures){try{const result=await promise;if(result?.error)failures.push(`${label}: ${result.error.code||result.error.message}`);}catch(error){failures.push(`${label}: ${error.message||error}`);}}

(async()=>{
 const owner=ok(await service.auth.admin.createUser({email:`prompt-discussion-${runId}@example.invalid`,password:`Discussion-${randomUUID()}9!`,email_confirm:true,user_metadata:{display_name:'Discussion fixture'}})).user;users.push(owner.id);
 const [actorA,actorB]=await Promise.all([makeAnonymous(),makeAnonymous()]);
 const promptId=randomUUID();promptIds.push(promptId);ok(await service.from('together_prompts').insert({id:promptId,title:`Discussion fixture ${runId}`,question:'What do you notice?',reading_text:'A disposable reading for nested discussion policy checks.',source_url:'https://www.churchofjesuschrist.org/study/scriptures/nt/john/3?lang=eng',reference_label:null,anchor:null,lesson_key:null,author:'Discussion fixture',created_by:owner.id}));
 const replyId=randomUUID(),otherReplyId=randomUUID();replyIds.push(replyId,otherReplyId);ok(await actorA.client.from('together_prompt_replies').insert({id:replyId,prompt_id:promptId,owner_id:actorA.user.id,author:'Guest A',body:`Parent reply ${runId}`}));ok(await actorB.client.from('together_prompt_replies').insert({id:otherReplyId,prompt_id:promptId,owner_id:actorB.user.id,author:'Guest B',body:`Other parent ${runId}`}));

 const legacyNoteId=randomUUID(),legacyCommentId=randomUUID();legacyNoteIds.push(legacyNoteId);legacyCommentIds.push(legacyCommentId);legacyReactionKeys.push({note_id:legacyNoteId,owner_id:actorB.user.id});ok(await service.from('together_notes').insert({id:legacyNoteId,owner_id:owner.id,lesson_key:`discussion-${runId}`,author:'Existing insight',language:'en',body:'An existing insight must remain untouched.',type:'insight',scope:'class',consent:true,anchor:{lessonKey:`discussion-${runId}`,segments:[],quote:'An existing insight must remain untouched.'}}));ok(await service.from('together_comments').insert({id:legacyCommentId,note_id:legacyNoteId,owner_id:actorA.user.id,author:'Legacy guest',body:'Existing insight comment'}));ok(await service.from('together_reactions').insert({note_id:legacyNoteId,owner_id:actorB.user.id}));const legacyBefore={comment:ok(await service.from('together_comments').select('id,note_id,owner_id,author,body').eq('id',legacyCommentId).single()),reaction:ok(await service.from('together_reactions').select('note_id,owner_id').eq('note_id',legacyNoteId).eq('owner_id',actorB.user.id).single())};

 const commentA={id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:'Guest A',body:`Nested comment A ${runId}`},commentB={id:randomUUID(),reply_id:replyId,owner_id:actorB.user.id,author:'Guest B',body:`Nested comment B ${runId}`};commentIds.push(commentA.id,commentB.id);
 const writtenA=ok(await actorA.client.from(COMMENTS).insert(commentA).select('id,reply_id,owner_id,author,body,created_at').single()),writtenB=ok(await actorB.client.from(COMMENTS).insert(commentB).select('id,reply_id,owner_id,author,body,created_at').single());assert.equal(writtenA.owner_id,actorA.user.id);assert.equal(writtenB.owner_id,actorB.user.id);assert.ok(Math.abs(Date.now()-Date.parse(writtenA.created_at))<60000);
 reactionKeys.push({reply_id:replyId,owner_id:actorA.user.id},{reply_id:replyId,owner_id:actorB.user.id});ok(await actorA.client.from(REACTIONS).insert({reply_id:replyId,owner_id:actorA.user.id}));ok(await actorB.client.from(REACTIONS).insert({reply_id:replyId,owner_id:actorB.user.id}));
 const [publicComments,publicReactions]=await Promise.all([visitor.from(COMMENTS).select('id,reply_id,owner_id,author,body,created_at').eq('reply_id',replyId),visitor.from(REACTIONS).select('reply_id,owner_id,created_at').eq('reply_id',replyId)]);assert.equal(ok(publicComments).length,2);assert.equal(ok(publicReactions).length,2);pass('Two anonymous Auth actors can add owned nested comments and hearts that unsigned visitors can read');

 await deny('unsigned comment insert',visitor.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:'Unsigned',body:'No Auth identity'}));await deny('unsigned reaction insert',visitor.from(REACTIONS).insert({reply_id:otherReplyId,owner_id:actorA.user.id}));await deny('comment owner spoof',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorB.user.id,author:'Spoof',body:'Forged owner'}));await deny('reaction owner spoof',actorA.client.from(REACTIONS).insert({reply_id:otherReplyId,owner_id:actorB.user.id}));await deny('missing comment parent',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:randomUUID(),owner_id:actorA.user.id,author:'Guest A',body:'Missing parent'}));await deny('missing reaction parent',actorA.client.from(REACTIONS).insert({reply_id:randomUUID(),owner_id:actorA.user.id}));pass('Unsigned writes, owner spoofing, and missing parent references are rejected');

 const duplicate=await actorA.client.from(REACTIONS).insert({reply_id:replyId,owner_id:actorA.user.id});assert.equal(duplicate.error?.code,'23505');await deny('nested comment update',actorA.client.from(COMMENTS).update({body:'Changed'}).eq('id',commentA.id));await deny('blank nested author',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:' ',body:'Body'}));await deny('blank nested comment',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:'Guest A',body:' '}));await deny('oversized nested comment',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:'Guest A',body:'x'.repeat(1501)}));await deny('oversized nested author',actorA.client.from(COMMENTS).insert({id:randomUUID(),reply_id:replyId,owner_id:actorA.user.id,author:'a'.repeat(51),body:'Body'}));await deny('client supplied nested timestamp',actorA.client.from(COMMENTS).insert({...commentA,id:randomUUID(),created_at:'2000-01-01T00:00:00Z'}));pass('Per-actor heart uniqueness, immutable rows, bounded comment fields, and server-controlled timestamps are enforced');

 await deny('other actor comment delete',actorA.client.from(COMMENTS).delete().eq('id',commentB.id).select('id').single());assert.equal(ok(await service.from(COMMENTS).select('id').eq('id',commentB.id)).length,1);ok(await actorA.client.from(COMMENTS).delete().eq('id',commentA.id).select('id').single());commentIds.splice(commentIds.indexOf(commentA.id),1);
 await deny('other actor reaction delete',actorA.client.from(REACTIONS).delete().eq('reply_id',replyId).eq('owner_id',actorB.user.id).select('reply_id').single());assert.equal(ok(await service.from(REACTIONS).select('reply_id').eq('reply_id',replyId).eq('owner_id',actorB.user.id)).length,1);ok(await actorA.client.from(REACTIONS).delete().eq('reply_id',replyId).eq('owner_id',actorA.user.id).select('reply_id').single());reactionKeys.splice(reactionKeys.findIndex(item=>item.reply_id===replyId&&item.owner_id===actorA.user.id),1);reactionKeys.push({reply_id:replyId,owner_id:actorA.user.id});ok(await actorA.client.from(REACTIONS).insert({reply_id:replyId,owner_id:actorA.user.id}));pass('Actors can remove their own comment and heart while another actor cannot remove them');

 ok(await actorA.client.from('together_prompt_replies').delete().eq('id',replyId).select('id').single());replyIds.splice(replyIds.indexOf(replyId),1);assert.equal(ok(await service.from(COMMENTS).select('id').eq('reply_id',replyId)).length,0);assert.equal(ok(await service.from(REACTIONS).select('reply_id').eq('reply_id',replyId)).length,0);for(let index=reactionKeys.length-1;index>=0;index--)if(reactionKeys[index].reply_id===replyId)reactionKeys.splice(index,1);for(let index=commentIds.length-1;index>=0;index--)if([commentA.id,commentB.id].includes(commentIds[index]))commentIds.splice(index,1);
 const legacyAfter={comment:ok(await service.from('together_comments').select('id,note_id,owner_id,author,body').eq('id',legacyCommentId).single()),reaction:ok(await service.from('together_reactions').select('note_id,owner_id').eq('note_id',legacyNoteId).eq('owner_id',actorB.user.id).single())};assert.deepEqual(legacyAfter,legacyBefore);pass('Deleting a parent prompt reply cascades its nested discussion while existing insight comments and reactions stay unchanged');
 console.log('RESULT',results.length,'checks passed');
})().catch(error=>{console.error('FAIL',String(error.message).replace(/https?:\/\/\S+/g,'[URL omitted]'));process.exitCode=1;}).finally(async()=>{
 const failures=[];
 for(const id of commentIds)await cleanup(`nested comment ${id}`,service.from(COMMENTS).delete().eq('id',id),failures);
 for(const key of reactionKeys)await cleanup(`nested reaction ${key.reply_id}/${key.owner_id}`,service.from(REACTIONS).delete().eq('reply_id',key.reply_id).eq('owner_id',key.owner_id),failures);
 for(const id of replyIds)await cleanup(`prompt reply ${id}`,service.from('together_prompt_replies').delete().eq('id',id),failures);
 for(const id of promptIds)await cleanup(`prompt ${id}`,service.from('together_prompts').delete().eq('id',id),failures);
 for(const id of legacyCommentIds)await cleanup(`legacy comment ${id}`,service.from('together_comments').delete().eq('id',id),failures);
 for(const key of legacyReactionKeys)await cleanup(`legacy reaction ${key.note_id}/${key.owner_id}`,service.from('together_reactions').delete().eq('note_id',key.note_id).eq('owner_id',key.owner_id),failures);
 for(const id of legacyNoteIds)await cleanup(`legacy note ${id}`,service.from('together_notes').delete().eq('id',id),failures);
 for(const id of users)await cleanup(`user ${id}`,service.auth.admin.deleteUser(id),failures);
 console.log(`Cleanup: prompts=${promptIds.length} replies=${replyIds.length} comments=${commentIds.length} reactions=${reactionKeys.length} legacyNotes=${legacyNoteIds.length} users=${users.length}`);if(failures.length){for(const issue of failures)console.error('Cleanup failed',issue);process.exitCode=1;}
});
