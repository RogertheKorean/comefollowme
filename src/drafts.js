/* Local-only, identity-scoped drafts. Nothing in this module writes to Supabase. */
'use strict';
(function(root,factory){
 const create=factory();
 if(typeof module==='object'&&module.exports)module.exports=create;
 if(root?.document)root.TogetherDrafts=create(root);
})(typeof globalThis==='object'?globalThis:this,function(){
 const VERSION=1,DELAY=800;
 const encode=value=>encodeURIComponent(String(value));
 const validPart=value=>typeof value==='string'&&value.length>0&&value.length<=500;
 const same=(left,right)=>left?.body===right?.body&&left?.name===right?.name;

 return function createDrafts(env={}){
  const doc=env.document;
  const timers={set:(env.setTimeout||setTimeout).bind(env),clear:(env.clearTimeout||clearTimeout).bind(env)};
  const pending=new Map(),states=new Map(),knownKeys=new Set();
  const project=projectId(env);
  const prefix=`together-draft:v${VERSION}:${encode(project)}:`;
  const visitorKey=`together-draft-visitor:v${VERSION}:${encode(project)}`;
  let visitorToken=null,lastTransition=null;

  function storage(){try{return env.localStorage||null;}catch{return null;}}
  function randomToken(){try{return env.crypto?.randomUUID?.()||crypto.randomUUID();}catch{return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}}
  function visitor(){
   if(visitorToken)return visitorToken;
   const store=storage();
   try{visitorToken=store?.getItem(visitorKey)||null;}catch{}
   if(!visitorToken){visitorToken=randomToken();try{store?.setItem(visitorKey,visitorToken);}catch{}}
   return visitorToken;
  }
  function identityScope(){const id=env.TogetherCloud?.user?.id;return id?`user/${id}`:`visitor/${visitor()}`;}
  function storageKey(kind,target,scope=identityScope()){return `${prefix}${encode(scope)}:${encode(kind)}:${encode(target)}`;}
  function parse(value){
   try{const item=JSON.parse(value);if(item?.version!==VERSION||typeof item.body!=='string'||typeof item.updatedAt!=='string')return null;const result={body:item.body,updatedAt:item.updatedAt};if(typeof item.name==='string')result.name=item.name;return result;}catch{return null;}
  }
  function normalize(data){if(!data||typeof data.body!=='string')return null;const result={body:data.body};if(typeof data.name==='string')result.name=data.name;return result;}
  function nextTimestamp(previous){const now=new Date(),prior=Date.parse(previous?.updatedAt||'');if(Number.isFinite(prior)&&prior>=now.getTime())now.setTime(prior+1);return now.toISOString();}
  function detail(kind,target,statusValue,updatedAt=null){return {kind,target,status:statusValue,updatedAt};}
  function emit(kind,target,statusValue,updatedAt=null){
   const value=detail(kind,target,statusValue,updatedAt);states.set(`${kind}\n${target}`,value);
   try{doc?.dispatchEvent?.(new env.CustomEvent('together:draft-status',{detail:value}));}catch{try{doc?.dispatchEvent?.({type:'together:draft-status',detail:value});}catch{}}
   return value;
  }
  function stored(key){const store=storage();if(!store)return null;try{return parse(store.getItem(key));}catch{return null;}}
  function read(kind,target){
   if(!validPart(kind)||!validPart(target))return null;
   const key=storageKey(kind,target),queued=pending.get(key);
   if(queued)return {...queued.data,updatedAt:queued.updatedAt};
   return stored(key);
  }
  function schedule(entry){if(entry.timer)timers.clear(entry.timer);entry.timer=timers.set(()=>commit(entry),DELAY);}
  function save(kind,target,data){
   if(!validPart(kind)||!validPart(target)){emit(String(kind||''),String(target||''),'error',null);return false;}
   const normalized=normalize(data);if(!normalized){emit(kind,target,'error',null);return false;}
   const key=storageKey(kind,target),queued=pending.get(key),existing=queued?.data||stored(key);
   if(same(existing,normalized)){
    if(queued&&!queued.timer){emit(kind,target,'saving',queued.updatedAt);schedule(queued);}
    else if(!queued)emit(kind,target,'saved',existing.updatedAt);
    return false;
   }
   if(queued?.timer)timers.clear(queued.timer);
   const entry={key,kind,target,data:normalized,updatedAt:nextTimestamp(existing),timer:null};
   pending.set(key,entry);knownKeys.add(key);emit(kind,target,'saving',entry.updatedAt);schedule(entry);return true;
  }
  function commit(entry){
   if(pending.get(entry.key)!==entry)return true;
   if(entry.timer){timers.clear(entry.timer);entry.timer=null;}
   const item={version:VERSION,...entry.data,updatedAt:entry.updatedAt};
   try{const store=storage();if(!store)throw Error('Local storage unavailable');store.setItem(entry.key,JSON.stringify(item));if(entry.sourceKey)store.removeItem(entry.sourceKey);pending.delete(entry.key);knownKeys.add(entry.key);if(entry.sourceKey)knownKeys.delete(entry.sourceKey);emit(entry.kind,entry.target,'saved',entry.updatedAt);return true;}
   catch{emit(entry.kind,entry.target,'error',entry.updatedAt);return false;}
  }
  function matches(entry,kind,target){return (kind===undefined||entry.kind===kind)&&(target===undefined||entry.target===target);}
  function flush(kind,target){let ok=true;for(const entry of [...pending.values()])if(matches(entry,kind,target)&&!commit(entry))ok=false;return ok;}
  function clear(kind,target){
   if(!validPart(kind)||!validPart(target))return false;
   const key=storageKey(kind,target),entry=pending.get(key);if(entry?.timer)timers.clear(entry.timer);if(entry)entry.timer=null;pending.delete(key);
   try{const store=storage();if(!store)throw Error('Local storage unavailable');store.removeItem(key);knownKeys.delete(key);emit(kind,target,'saved',null);return true;}catch{if(entry)pending.set(key,entry);emit(kind,target,'error',entry?.updatedAt||stored(key)?.updatedAt||null);return false;}
  }
  function status(kind,target){return states.get(`${kind}\n${target}`)||null;}
  function keysFor(scope){
   const start=`${prefix}${encode(scope)}:`,keys=new Set([...knownKeys].filter(key=>key.startsWith(start))),store=storage();
   try{for(let index=0;index<store.length;index++){const key=store.key(index);if(key?.startsWith(start))keys.add(key);}}catch{}
   return [...keys];
  }
  function migrateGuest(newUserId){
   if(!newUserId)return;flush();
   const fromScope=`visitor/${visitor()}`,toScope=`user/${newUserId}`,fromStart=`${prefix}${encode(fromScope)}:`,toStart=`${prefix}${encode(toScope)}:`,store=storage();
   for(const oldKey of keysFor(fromScope)){
    let raw=null,oldValue=null;try{raw=store?.getItem(oldKey);oldValue=parse(raw);}catch{}if(!oldValue)continue;
    const suffix=oldKey.slice(fromStart.length),newKey=toStart+suffix,newValue=stored(newKey);
    try{if(!newValue||oldValue.updatedAt>newValue.updatedAt)store.setItem(newKey,raw);store.removeItem(oldKey);knownKeys.delete(oldKey);knownKeys.add(newKey);}
    catch{if(newValue&&newValue.updatedAt>=oldValue.updatedAt)continue;
     const separator=suffix.indexOf(':');if(separator<1)continue;
     try{const kind=decodeURIComponent(suffix.slice(0,separator)),target=decodeURIComponent(suffix.slice(separator+1)),data={body:oldValue.body};if(typeof oldValue.name==='string')data.name=oldValue.name;const current=pending.get(newKey);if(!current||current.updatedAt<oldValue.updatedAt){if(current?.timer)timers.clear(current.timer);pending.set(newKey,{key:newKey,kind,target,data,updatedAt:oldValue.updatedAt,timer:null,sourceKey:oldKey});knownKeys.add(newKey);}}catch{}
    }
   }
   for(const [oldKey,entry]of [...pending])if(oldKey.startsWith(fromStart)){
    const newKey=toStart+oldKey.slice(fromStart.length),current=pending.get(newKey);
    pending.delete(oldKey);knownKeys.delete(oldKey);
    if(current&&current.updatedAt>=entry.updatedAt)continue;
    if(current?.timer)timers.clear(current.timer);
    entry.key=newKey;entry.timer=null;entry.sourceKey=current?.sourceKey||oldKey;pending.set(newKey,entry);knownKeys.add(newKey);
   }
   states.clear();for(const entry of pending.values())if(entry.key.startsWith(toStart)&&!entry.timer)emit(entry.kind,entry.target,'error',entry.updatedAt);
  }
  function identityEvent(event){
   const value=event?.detail||{};if(!Object.prototype.hasOwnProperty.call(value,'previousUserId'))return;
   const next=value.newUserId||value.userId||null,signature=`${value.previousUserId||''}>${next||''}:${value.adoptingGuest===true}`;
   if(signature===lastTransition)return;lastTransition=signature;
   if(value.adoptingGuest&&!value.previousUserId)migrateGuest(next);else{flush();states.clear();}
  }
  env.addEventListener?.('pagehide',()=>flush());
  doc?.addEventListener?.('visibilitychange',()=>{if(doc.hidden)flush();});
  doc?.addEventListener?.('together:before-identity',identityEvent);
  doc?.addEventListener?.('together:identity',identityEvent);
  return {read,save,flush,clear,status};
 };

 function projectId(env){
  const raw=env.TogetherCloud?.client?.supabaseUrl;
  try{if(raw)return new URL(raw).host.toLowerCase();}catch{}
  try{return `local@${env.location?.origin||'unknown'}`;}catch{return 'local@unknown';}
 }
});
