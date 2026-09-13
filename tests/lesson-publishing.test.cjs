const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../src/reference-engine.js');
const {createPublishing}=require('../src/lesson-publishing.js');

function lesson(id='cfm-2026-38',version='a'.repeat(64),ko='검토한 본문'){
 return engine.validateLesson({
  id,version,title:{ko:'검토한 공과',en:'Reviewed lesson'},date:{ko:'2026년 9월',en:'September 2026'},
  sourceUrl:{ko:'https://example.org/lesson',en:''},sourceLabel:'Published Markdown',translationStatus:'user-provided-unverified',alignment:'korean-only',
  raw:{ko,en:''},sections:[{id:'intro',ko:'소개',en:'Introduction'}],
  blocks:[{id:'b1',sectionId:'intro',conceptId:id+'-b1',kind:'text',ko,en:''}]
 });
}
function queryClient(pages,rpc,probes=[]){
 const calls={from:0,ranges:[],probes:0,rpc:[]};
 return {calls,from(table){
  assert.equal(table,'together_published_lessons');calls.from++;
  let probe=false;
  const chain={select(columns,options){probe=options?.count==='exact';return chain;},order(){return chain;},limit(){assert.equal(probe,true);calls.probes++;return Promise.resolve(probes.shift()||{data:[],count:0,error:null});},range(from,to){calls.ranges.push([from,to]);return Promise.resolve(pages.shift()||{data:[],error:null});}};
  return chain;
 },async rpc(name,args){calls.rpc.push([name,args]);return rpc?rpc(name,args):{data:null,error:null};}};
}
function row(value,revision){return {lesson_id:value.id,version:value.version,lesson:value,revision_number:revision,published_at:`2026-09-${String(revision).padStart(2,'0')}T00:00:00Z`};}

test('public load keeps immutable history and selects the highest revision per stable id without authentication',async()=>{
 const old=lesson('same','1'.repeat(64),'이전 본문'),latest=lesson('same','2'.repeat(64),'새 본문'),other=lesson('other','3'.repeat(64));
 const client=queryClient([{data:[row(old,1),row(other,2),row(latest,3)],error:null}]);
 const cloud={enabled:true,client,user:null};const events=[];
 const api=createPublishing({engine,getCloud:()=>cloud,getAccess:()=>null,emit:(name,detail)=>events.push([name,detail])});
 await api.load();
 assert.equal(client.calls.rpc.length,0);
 assert.deepEqual(api.getLessons().map(x=>x.version),[old.version,other.version,latest.version]);
 assert.equal(api.getLatest('same').version,latest.version);
 assert.deepEqual(api.getLatestLessons().map(x=>x.id),['other','same']);
 assert.equal(events.at(-1)[0],'together:lessons');
 assert.equal(events.at(-1)[1].source,'load');
 const copy=api.getLatest('same');copy.title.ko='mutated';assert.equal(api.getLatest('same').title.ko,'검토한 공과');
});

test('load paginates public revisions and exposes failures without discarding prior data',async()=>{
 const first=Array.from({length:200},(_,i)=>row(lesson('id-'+i,String(i).padStart(64,'0')),i+1));
 const final=row(lesson('last','f'.repeat(64)),201);const events=[];
 const client=queryClient([{data:first,error:null},{data:[final],error:null}],null,[{data:null,error:{message:'offline'}}]);
 const api=createPublishing({engine,getCloud:()=>({enabled:true,client,user:null}),emit:(name,detail)=>events.push([name,detail])});
 await api.load();assert.equal(api.getLessons().length,201);assert.deepEqual(client.calls.ranges.slice(0,2),[[0,199],[200,399]]);
 await assert.rejects(api.load(),error=>error.message==='offline');assert.equal(api.error.message,'offline');assert.equal(api.getLessons().length,201);assert.equal(events.at(-1)[0],'together:lessons-error');
});

test('unchanged refresh probes metadata and avoids another full-history body fetch or event',async()=>{
 const value=lesson(),events=[];const client=queryClient([{data:[row(value,7)],error:null}],null,[{data:[{revision_number:7}],count:1,error:null}]);
 const api=createPublishing({engine,getCloud:()=>({enabled:true,client,user:null}),emit:(name,detail)=>events.push([name,detail])});
 await api.load();await api.load();assert.deepEqual(client.calls.ranges,[[0,199]]);assert.equal(client.calls.probes,1);assert.equal(events.filter(([name])=>name==='together:lessons').length,1);assert.deepEqual(api.getLessons(),[value]);
});

test('publish sends the exact reviewed payload and optimistic version token, then refreshes history',async()=>{
 const previous=lesson('same','1'.repeat(64),'이전'),next=lesson('same','2'.repeat(64),'다음');
 const pages=[{data:[row(previous,1)],error:null},{data:[row(previous,1),row(next,2)],error:null}];
 const client=queryClient(pages,async(name,args)=>{assert.equal(name,'together_publish_lesson');return {data:{lesson:args.p_lesson,idempotent:false},error:null};},[{data:[{revision_number:2}],count:2,error:null}]);
 const cloud={enabled:true,client,user:{id:'operator',is_anonymous:false}};
 const api=createPublishing({engine,getCloud:()=>cloud,getAccess:()=>({can:p=>p==='content'}),emit:()=>{}});
 await api.load();const result=await api.publish(next,{expectedVersion:previous.version});
 assert.deepEqual(result,next);assert.deepEqual(client.calls.rpc[0],["together_publish_lesson",{p_lesson:next,p_expected_version:previous.version}]);
 assert.equal(api.getLatest('same').version,next.version);assert.equal(api.error,null);
});

test('publish rejects unreviewed normalization, anonymous identities, and missing live content access',async()=>{
 const clean=lesson(),withHidden={...clean,notes:[{private:true}]};
 const cloud={enabled:true,client:queryClient([]),user:{id:'operator',is_anonymous:false}};
 let api=createPublishing({engine,getCloud:()=>cloud,getAccess:()=>({can:()=>true}),emit:()=>{}});
 await assert.rejects(api.publish(withHidden),error=>error.code==='review_mismatch');
 cloud.user={id:'guest',is_anonymous:true};await assert.rejects(api.publish(clean),error=>error.code==='named_sign_in_required');
 cloud.user={id:'operator',is_anonymous:false};api=createPublishing({engine,getCloud:()=>cloud,getAccess:()=>({can:()=>false}),emit:()=>{}});
 await assert.rejects(api.publish(clean),error=>error.code==='content_access_required');
 assert.equal(cloud.client.calls.rpc.length,0);
});

test('publish rejects a reviewed payload above the server UTF-8 JSON limit before transport',async()=>{
 const seed=lesson(),text='한'.repeat(100000),blocks=Array.from({length:4},(_,i)=>({...seed.blocks[0],id:'b'+i,conceptId:'large-'+i,ko:text,en:text}));
 const huge=engine.validateLesson({...seed,raw:{ko:text.repeat(4),en:text.repeat(4)},blocks});
 const client=queryClient([]),api=createPublishing({engine,getCloud:()=>({enabled:true,client,user:{id:'operator',is_anonymous:false}}),getAccess:()=>({can:()=>true}),emit:()=>{}});
 await assert.rejects(api.publish(huge),error=>error.code==='invalid_lesson_size');assert.equal(client.calls.rpc.length,0);
});

test('publish suppresses a successful response if the signed-in identity changes mid-flight',async()=>{
 const value=lesson();const cloud={enabled:true,user:{id:'operator-a',is_anonymous:false}};
 const client=queryClient([],async()=>{cloud.user={id:'operator-b',is_anonymous:false};return {data:{lesson:value,idempotent:false},error:null};});cloud.client=client;
 const api=createPublishing({engine,getCloud:()=>cloud,getAccess:()=>({can:()=>true}),emit:()=>{}});
 await assert.rejects(api.publish(value),error=>error.code==='identity_changed');assert.equal(api.getLessons().length,0);
});
