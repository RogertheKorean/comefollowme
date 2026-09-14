/* Shared interaction primitives for member insights and question responses. */
'use strict';
window.TogetherDiscussion={
 actionsHTML({id,target='note',liked=false,likes=0,comments=0,busy=false}){
  const attrs=action=>target==='note'?`data-action="${action==='heart'?'like':'thread'}" data-id="${esc(id)}"`:`data-discussion-action="${action}" data-discussion-id="${esc(id)}"`;
  return `<button type="button" ${attrs('heart')} class="${liked?'active':''}" aria-pressed="${!!liked}" aria-label="${tr('공감','Appreciate')}" ${busy?'disabled':''}>${icon('heart')} ${likes}</button><button type="button" ${attrs('thread')} aria-label="${tr('댓글 보기','View replies')}">${icon('chat')} ${comments}</button>`;
 },
 commentsHTML(comments,{name=authorName,stamp=c=>c.demo?tr('예시','Sample'):tr('방금 기록','Recorded here'),canDelete=()=>false}={}){
  return comments.map(c=>`<article class="reply">${avatar({...c,owner:c.owner||(c.owner_id===window.TogetherCloud?.user?.id?'me':c.owner_id||'guest')})}<div class="reply-body"><strong>${esc(name(c))}</strong><small>${esc(stamp(c))}</small><p>${esc(c.body)}</p>${canDelete(c)?`<button type="button" class="text-btn" data-discussion-delete="${esc(c.id)}">${tr('삭제','Delete')}</button>`:''}</div></article>`).join('');
 },
 async setReaction({table,column,id,userId,liked}){
  const c=window.TogetherCloud.client;
  const result=liked?await c.from(table).delete().eq(column,id).eq('owner_id',userId):await c.from(table).insert({[column]:id,owner_id:userId});
  if(result.error&&!(result.error.code==='23505'&&!liked))throw result.error;
  if(result.error){const check=await c.from(table).select('owner_id').eq(column,id).eq('owner_id',userId).single();if(check.error)throw check.error;}
 }
};
