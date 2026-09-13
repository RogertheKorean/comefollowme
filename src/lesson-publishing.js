/* Public lesson revisions and operator-only publishing through Supabase RLS/RPC. */
(function(global){
 'use strict';

 const PAGE_SIZE=200;
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 const utf8Size=value=>typeof TextEncoder==='function'?new TextEncoder().encode(value).byteLength:typeof Buffer!=='undefined'?Buffer.byteLength(value,'utf8'):value.length*3;
 function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
 }
 function errorWithCode(message,code){const error=new Error(message);error.code=code;return error;}

 function createPublishing(options={}){
  const getCloud=options.getCloud||(()=>global.TogetherCloud||null);
  const getAccess=options.getAccess||(()=>global.TogetherAccess||null);
  const engine=options.engine||global.ReferenceEngine;
  const emit=options.emit||((name,detail)=>{
   if(global.document?.dispatchEvent&&typeof global.CustomEvent==='function')global.document.dispatchEvent(new global.CustomEvent(name,{detail}));
  });
  let rows=[],loaded=false,loadGeneration=0;
  const api={ready:null,error:null,load,publish,getLessons,getLatest,getLatestLessons};

  function checkedLesson(value){
   if(!engine?.validateLesson)throw errorWithCode('Lesson validation is unavailable.','validation_unavailable');
   let lesson;
   try{lesson=engine.validateLesson(value);}catch(error){throw errorWithCode(error?.message||'Invalid lesson content.','invalid_lesson');}
   if(canonical(lesson)!==canonical(value))throw errorWithCode('Publish the exact validated lesson that was reviewed.','review_mismatch');
   if(utf8Size(JSON.stringify(lesson))>2500000)throw errorWithCode('The reviewed lesson exceeds the 2.5 MB publishing limit.','invalid_lesson_size');
   return lesson;
  }
  function normalizedRow(row){
   if(!row||typeof row!=='object'||row.lesson_id!==row.lesson?.id||row.version!==row.lesson?.version)throw errorWithCode('The lesson service returned an invalid revision.','invalid_server_row');
   const lesson=checkedLesson(row.lesson);
   const revision=Number(row.revision_number);
   if(!Number.isSafeInteger(revision)||revision<1)throw errorWithCode('The lesson service returned an invalid revision number.','invalid_server_row');
   return {lesson_id:row.lesson_id,version:row.version,lesson,revision_number:revision,published_at:String(row.published_at||'')};
  }
  function snapshots(source){
   const all=source.map(row=>clone(row.lesson));
   const latest=new Map();
   for(const row of source){const previous=latest.get(row.lesson_id);if(!previous||row.revision_number>previous.revision_number)latest.set(row.lesson_id,row);}
   return {lessons:all,latest:[...latest.values()].sort((a,b)=>a.revision_number-b.revision_number).map(row=>clone(row.lesson))};
  }
  function getLessons(){return snapshots(rows).lessons;}
  function getLatestLessons(){return snapshots(rows).latest;}
  function getLatest(id){
   if(typeof id!=='string')return null;
   let match=null;
   for(const row of rows)if(row.lesson_id===id&&(!match||row.revision_number>match.revision_number))match=row;
   return match?clone(match.lesson):null;
  }
  function announce(source){const detail=snapshots(rows);detail.source=source;emit('together:lessons',detail);return detail.lessons;}

  async function load(source='load'){
   const generation=++loadGeneration,cloud=getCloud();
   if(!cloud?.enabled||!cloud.client){rows=[];loaded=true;api.error=null;return announce(source);}
   try{
    if(loaded){
     const {data,error,count}=await cloud.client.from('together_published_lessons').select('revision_number',{count:'exact'}).order('revision_number',{ascending:false}).limit(1);
     if(error)throw error;
     if(generation!==loadGeneration)return getLessons();
     const remoteMax=Array.isArray(data)&&data.length?Number(data[0].revision_number):0;
     const localMax=rows.reduce((max,row)=>Math.max(max,row.revision_number),0);
     if(Number(count)===rows.length&&remoteMax===localMax){const recovered=!!api.error;api.error=null;return recovered?announce(source):getLessons();}
    }
    const found=[];
    for(let offset=0;;offset+=PAGE_SIZE){
     let query=cloud.client.from('together_published_lessons').select('lesson_id,version,lesson,revision_number,published_at').order('revision_number',{ascending:true}).range(offset,offset+PAGE_SIZE-1);
     const {data,error}=await query;
     if(error)throw error;
     if(generation!==loadGeneration)return getLessons();
     const page=Array.isArray(data)?data:[];
     found.push(...page.map(normalizedRow));
     if(page.length<PAGE_SIZE)break;
    }
    if(generation!==loadGeneration)return getLessons();
    rows=found;loaded=true;api.error=null;return announce(source);
   }catch(error){
    if(generation===loadGeneration){api.error=error;emit('together:lessons-error',{error,source});}
    throw error;
   }
  }

  async function publish(reviewedLesson,{expectedVersion=null}={}){
   const lesson=checkedLesson(reviewedLesson);
   if(expectedVersion!==null&&(typeof expectedVersion!=='string'||!/^[-\w]{1,100}$/.test(expectedVersion)))throw errorWithCode('Invalid expected lesson version.','invalid_expected_version');
   const cloud=getCloud(),user=cloud?.user;
   if(!cloud?.enabled||!cloud.client)throw errorWithCode('Lesson publishing is not configured.','publishing_unavailable');
   if(!user?.id||user.is_anonymous)throw errorWithCode('Sign in with a confirmed operator account before publishing.','named_sign_in_required');
   if(!getAccess()?.can?.('content'))throw errorWithCode('Admin or editor access is required to publish lessons.','content_access_required');
   const userId=user.id,cloudRevision=cloud.revision;
   const sameIdentity=()=>getCloud()?.user?.id===userId&&!getCloud()?.user?.is_anonymous&&getCloud()?.revision===cloudRevision;
   try{
    const {data,error}=await cloud.client.rpc('together_publish_lesson',{p_lesson:lesson,p_expected_version:expectedVersion});
    if(error)throw error;
    if(!sameIdentity())throw errorWithCode('The signed-in account changed while the lesson was publishing. Reload published lessons before continuing.','identity_changed');
    const returned=data?.lesson;
    if(!returned||canonical(checkedLesson(returned))!==canonical(lesson))throw errorWithCode('The lesson service returned different content.','publish_response_mismatch');
    await load('publish');
    if(!sameIdentity())throw errorWithCode('The signed-in account changed while the lesson was publishing. Reload published lessons before continuing.','identity_changed');
    api.error=null;
    return clone(returned);
   }catch(error){throw error;}
  }

  return api;
 }

 const exported={createPublishing,canonical};
 if(typeof module!=='undefined'&&module.exports)module.exports=exported;
 if(global.document){const publishing=createPublishing();global.TogetherPublishing=publishing;publishing.ready=publishing.load().catch(()=>publishing.getLessons());}
})(typeof globalThis!=='undefined'?globalThis:this);
