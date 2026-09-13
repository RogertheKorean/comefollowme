/* Mapping between persisted records and the reader's view model. */
(function(root){
 'use strict';
 function cloneJSON(value){
  const json=JSON.stringify(value);if(json.length>100000)throw Error('Saved source anchor is too large');return JSON.parse(json);
 }
 function safeHttpUrl(value){if(value===undefined)return;try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))throw Error();}catch{throw Error('Invalid saved source URL');}}
 function safeAnchor(value,lessonKey){
  if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.quote!=='string'||value.lessonKey!==lessonKey||!Array.isArray(value.segments))throw Error('Invalid saved source anchor');
  if(typeof value.language!=='string'||typeof value.sectionId!=='string'||typeof value.mode!=='string'||value.segments.length>100)throw Error('Invalid saved source anchor');
  for(const segment of value.segments)if(!segment||typeof segment!=='object'||Array.isArray(segment)||typeof segment.exact!=='string'||(!segment.blockId&&!Number.isInteger(segment.verse)))throw Error('Invalid saved source segment');
  if(['scripture','reference'].includes(value.kind)&&(!value.reference||typeof value.reference.key!=='string'||!Array.isArray(value.reference.verses)||value.reference.verses.some(v=>!Number.isInteger(v))))throw Error('Invalid reference anchor');
  safeHttpUrl(value.sourceUrl);safeHttpUrl(value.churchSourceUrl);
  return cloneJSON(value);
 }
 function safeSnapshot(value){
  if(!value||typeof value.data!=='string'||value.data.length>1500000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.data))return null;
  const width=Number(value.width),height=Number(value.height),kind=typeof value.kind==='string'&&/^[a-z0-9-]{1,50}$/i.test(value.kind)?value.kind:'dom-capture';
  return {data:value.data,kind,width:Number.isFinite(width)&&width>=0&&width<=10000?width:0,height:Number.isFinite(height)&&height>=0&&height<=10000?height:0};
 }
 function fromRow(row,userId){
  if(!row||typeof row.author!=='string'||typeof row.owner_id!=='string')throw Error('Invalid saved source anchor');
  const anchor=safeAnchor(row.anchor,row.lesson_key);
  const owner=id=>id===userId?'me':id;
  return {id:row.id,owner:owner(row.owner_id),userId:row.owner_id,author:row.author,demo:false,remote:true,language:row.language,body:row.body,type:row.type,scope:row.scope,consent:row.consent,anchor,snapshot:safeSnapshot(row.snapshot),created:row.created_at,updated:row.updated_at,
   comments:(row.together_comments||[]).map(c=>({id:c.id,owner:owner(c.owner_id),author:c.author,body:c.body,created:c.created_at,demo:false})).sort((a,b)=>a.created.localeCompare(b.created)),
   likes:(row.together_reactions||[]).map(r=>owner(r.owner_id))};
 }
 function toRow(note,user){
  if(!user?.id)throw Error('Sign in before saving');
  const anchor=safeAnchor(note.anchor,note.anchor?.lessonKey);
  return {id:note.id,owner_id:user.id,author:(user.user_metadata?.display_name||'반원').trim().slice(0,50)||'반원',lesson_key:anchor.lessonKey,language:note.language,body:note.body.trim(),type:note.type,scope:note.scope,consent:note.scope==='class'&&note.consent===true,anchor,snapshot:safeSnapshot(note.snapshot)};
 }
 function mergeRows(local,rows,userId){const records=rows.flatMap(r=>{try{return [fromRow(r,userId)];}catch{return [];}}),ids=new Set(records.map(n=>n.id));return [...local.filter(n=>!n.remote&&!n.demo&&!ids.has(n.id)),...records];}
 const api={safeAnchor,safeSnapshot,fromRow,toRow,mergeRows};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TogetherCloudModel=api;
})(typeof window!=='undefined'?window:globalThis);
