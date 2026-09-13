const test=require('node:test');
const assert=require('node:assert/strict');
const model=require('../src/cloud-model.js');

const anchor={lessonKey:'lesson@v1',lessonId:'lesson',version:'v1',language:'ko',sectionId:'intro',sourceUrl:'https://example.org/lesson',mode:'selection',quote:'기억할 문장',segments:[{blockId:'b1',start:0,end:6,exact:'기억할 문장'}]};
function row(overrides={}){return {id:'note-1',owner_id:'user-a',author:'Alice',lesson_key:anchor.lessonKey,language:'ko',body:'Reflection',type:'insight',scope:'class',consent:true,anchor,created_at:'2026-09-13T00:00:00Z',updated_at:'2026-09-13T00:00:00Z',together_comments:[{id:'comment-2',owner_id:'user-b',author:'Bob',body:'Later',created_at:'2026-09-13T00:02:00Z'},{id:'comment-1',owner_id:'user-a',author:'Alice',body:'Earlier',created_at:'2026-09-13T00:01:00Z'}],together_reactions:[{owner_id:'user-a'},{owner_id:'user-b'}],snapshot:null,...overrides};}

test('maps ownership for notes, replies, and reactions without mutating source rows',()=>{
 const source=row(),mapped=model.fromRow(source,'user-a');
 assert.equal(mapped.owner,'me');assert.equal(mapped.userId,'user-a');
 assert.deepEqual(mapped.comments.map(c=>[c.id,c.owner]),[['comment-1','me'],['comment-2','user-b']]);
 assert.deepEqual(mapped.likes,['me','user-b']);
 mapped.anchor.quote='changed';assert.equal(source.anchor.quote,'기억할 문장');
});

test('merge removes stale remote and demo records while retaining unsynced local records',()=>{
 const local=[{id:'stale',remote:true},{id:'demo',demo:true},{id:'local',remote:false,demo:false},{id:'note-1',remote:false,demo:false}];
 const merged=model.mergeRows(local,[row()],'user-a');
 assert.deepEqual(merged.map(n=>n.id),['local','note-1']);
 assert.equal(merged[1].remote,true);
});

test('accepts lesson and reference anchors and rejects mismatches or unsafe navigation',()=>{
 assert.equal(model.safeAnchor(anchor,anchor.lessonKey).quote,anchor.quote);
 const reference={...anchor,kind:'scripture',sourceUrl:'https://example.org/scripture',churchSourceUrl:'https://example.org/original',segments:[{verse:3,start:0,end:4,exact:'verse'}],reference:{key:'nt/john/3',verses:[3]}};
 assert.equal(model.safeAnchor(reference,anchor.lessonKey).reference.key,'nt/john/3');
 assert.throws(()=>model.safeAnchor({...anchor,lessonKey:'other'},anchor.lessonKey),/Invalid saved source anchor/);
 assert.throws(()=>model.safeAnchor({...anchor,sourceUrl:'javascript:alert(1)'},anchor.lessonKey),/Invalid saved source URL/);
 assert.throws(()=>model.safeAnchor({...reference,reference:{key:'nt/john/3',verses:['3']}},anchor.lessonKey),/Invalid reference anchor/);
 assert.throws(()=>model.safeAnchor({...anchor,segments:[{blockId:'b1'}]},anchor.lessonKey),/Invalid saved source segment/);
});

test('snapshot mapping permits image data only and normalizes untrusted metadata',()=>{
 const png='data:image/png;base64,aGVsbG8=';
 assert.deepEqual(model.safeSnapshot({data:png,kind:'dom-selection',width:840,height:400}),{data:png,kind:'dom-selection',width:840,height:400});
 assert.equal(model.safeSnapshot({data:'data:text/html;base64,PHNjcmlwdD4='}),null);
 assert.equal(model.safeSnapshot({data:'javascript:alert(1)'}),null);
 assert.deepEqual(model.safeSnapshot({data:png,kind:'"><script>',width:Infinity,height:10001}),{data:png,kind:'dom-capture',width:0,height:0});
});

test('toRow binds ownership to the authenticated user and applies sharing consent rules',()=>{
 const user={id:'user-a',user_metadata:{display_name:'  A very thoughtful member  '}};
 const privateRow=model.toRow({id:'note-2',anchor,language:'ko',body:'  Saved body  ',type:'question',scope:'private',consent:true,snapshot:null},user);
 assert.equal(privateRow.owner_id,'user-a');assert.equal(privateRow.author,'A very thoughtful member');assert.equal(privateRow.body,'Saved body');assert.equal(privateRow.consent,false);
 assert.throws(()=>model.toRow({anchor},null),/Sign in before saving/);
});
