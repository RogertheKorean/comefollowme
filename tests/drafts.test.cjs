const test=require('node:test'),assert=require('node:assert/strict');
const createDrafts=require('../src/drafts.js');

test('retains an explicitly cleared reply name across reload and guest adoption',()=>{
 const h=harness();
 h.api.save('prompt-reply','name-choice',{body:'My reply',name:'',nameEdited:false});h.api.flush();
 assert.equal(h.api.save('prompt-reply','name-choice',{body:'My reply',name:'',nameEdited:true}),true);
 h.api.flush();
 const reloaded=harness(h.store);
 assert.equal(reloaded.api.read('prompt-reply','name-choice').nameEdited,true);
 reloaded.fireDocument('together:before-identity',{previousUserId:null,newUserId:'guest-name-choice',adoptingGuest:true});
 reloaded.cloud.user={id:'guest-name-choice',is_anonymous:true};
 assert.equal(reloaded.api.read('prompt-reply','name-choice').nameEdited,true);
 assert.equal(reloaded.api.read('prompt-reply','name-choice').name,'');
});

function memoryStorage(){
 const values=new Map();let writes=0,fail=false;
 return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.has(key)?values.get(key):null,setItem(key,value){if(fail)throw Error('QuotaExceededError');writes++;values.set(key,String(value));},removeItem(key){if(fail)throw Error('QuotaExceededError');values.delete(key);},values,set fail(value){fail=value;},get writes(){return writes;}};
}
function harness(store=memoryStorage(),url='https://alpha.supabase.co'){
 const documentListeners=new Map(),windowListeners=new Map(),events=[],timers=new Map();let timerId=0;
 const document={hidden:false,addEventListener(type,fn){if(!documentListeners.has(type))documentListeners.set(type,[]);documentListeners.get(type).push(fn);},dispatchEvent(event){events.push(event);for(const fn of documentListeners.get(event.type)||[])fn(event);return true;}};
 class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
 const cloud={user:null,client:{supabaseUrl:url}};
 const env={document,CustomEvent,TogetherCloud:cloud,localStorage:store,location:{origin:'https://example.test'},crypto:{randomUUID:()=>`visitor-${url.match(/https:\/\/([^.]*)/)?.[1]}`},setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},addEventListener(type,fn){if(!windowListeners.has(type))windowListeners.set(type,[]);windowListeners.get(type).push(fn);}};
 const fireDocument=(type,detail)=>document.dispatchEvent(new CustomEvent(type,{detail}));
 const fireWindow=type=>{for(const fn of windowListeners.get(type)||[])fn({type});};
 const runTimers=()=>{for(const [id,timer]of [...timers]){timers.delete(id);timer.fn();}};
 return {api:createDrafts(env),cloud,document,events,store,timers,fireDocument,fireWindow,runTimers};
}

test('debounces for 800 ms, reads pending text immediately and avoids unchanged writes',()=>{
 const h=harness();
 assert.equal(h.api.save('note-comment','note-1',{body:'한 글자',name:'로저'}),true);
 const queuedWrites=h.store.writes;
 assert.equal([...h.timers.values()][0].delay,800);
 assert.deepEqual(h.api.read('note-comment','note-1'),{body:'한 글자',name:'로저',updatedAt:h.api.status('note-comment','note-1').updatedAt});
 assert.equal(h.api.save('note-comment','note-1',{body:'한 글자',name:'로저'}),false);
 assert.equal(h.store.writes,queuedWrites);
 h.runTimers();
 assert.equal(h.store.writes,queuedWrites+1);
 assert.equal(h.api.status('note-comment','note-1').status,'saved');
 assert.equal(h.api.save('note-comment','note-1',{body:'한 글자',name:'로저'}),false);
 assert.equal(h.store.writes,queuedWrites+1);
 assert.deepEqual(h.events.at(-1).detail,{kind:'note-comment',target:'note-1',status:'saved',updatedAt:h.api.read('note-comment','note-1').updatedAt});
});

test('flushes pending drafts on hidden visibility, pagehide, or an explicit target flush',()=>{
 const h=harness();
 h.api.save('prompt-reply','prompt-1',{body:'first'});h.document.hidden=true;h.fireDocument('visibilitychange');
 assert.equal(h.api.status('prompt-reply','prompt-1').status,'saved');
 h.api.save('prompt-reply','prompt-2',{body:'second'});h.fireWindow('pagehide');
 assert.equal(h.api.status('prompt-reply','prompt-2').status,'saved');
 h.api.save('prompt-reply','prompt-3',{body:'third'});assert.equal(h.api.flush('prompt-reply','prompt-3'),true);
 assert.equal(h.api.read('prompt-reply','prompt-3').body,'third');
});

test('adopts signed-out drafts only for the first anonymous identity transition',()=>{
 const h=harness();
 h.api.save('prompt-reply','prompt-1',{body:'guest draft'});h.api.flush();
 h.fireDocument('together:before-identity',{previousUserId:null,newUserId:'anonymous-1',adoptingGuest:true});
 h.cloud.user={id:'anonymous-1',is_anonymous:true};
 assert.equal(h.api.read('prompt-reply','prompt-1').body,'guest draft');
 h.api.save('prompt-reply','prompt-2',{body:'anonymous only'});h.api.flush();
 h.fireDocument('together:before-identity',{previousUserId:'anonymous-1',newUserId:'operator-1',adoptingGuest:false});
 h.cloud.user={id:'operator-1',is_anonymous:false};
 assert.equal(h.api.read('prompt-reply','prompt-1'),null);
 assert.equal(h.api.read('prompt-reply','prompt-2'),null);
 h.cloud.user={id:'anonymous-1',is_anonymous:true};
 assert.equal(h.api.read('prompt-reply','prompt-2').body,'anonymous only');
});

test('keeps unsaved text in memory and reports errors when storage quota fails',()=>{
 const h=harness();h.store.fail=true;
 assert.doesNotThrow(()=>h.api.save('note-comment','note-2',{body:'do not lose me'}));
 assert.doesNotThrow(()=>h.runTimers());
 assert.equal(h.api.status('note-comment','note-2').status,'error');
 assert.equal(h.api.read('note-comment','note-2').body,'do not lose me');
 h.store.fail=false;
 assert.equal(h.api.flush('note-comment','note-2'),true);
 assert.equal(h.api.status('note-comment','note-2').status,'saved');
 assert.equal(h.api.read('note-comment','note-2').body,'do not lose me');
});

test('keeps the newest pending guest text during an adoption with storage errors',()=>{
 const h=harness();
 h.api.save('prompt-reply','prompt-q',{body:'older stored text'});h.api.flush();
 h.api.save('prompt-reply','prompt-q',{body:'newest pending text'});h.store.fail=true;
 h.fireDocument('together:before-identity',{previousUserId:null,newUserId:'anonymous-q',adoptingGuest:true});
 h.cloud.user={id:'anonymous-q',is_anonymous:true};
 assert.equal(h.api.read('prompt-reply','prompt-q').body,'newest pending text');
 assert.equal(h.api.status('prompt-reply','prompt-q').status,'error');
 h.store.fail=false;assert.equal(h.api.flush(),true);
 h.cloud.user=null;assert.equal(h.api.read('prompt-reply','prompt-q'),null);
 h.cloud.user={id:'anonymous-q',is_anonymous:true};assert.equal(h.api.read('prompt-reply','prompt-q').body,'newest pending text');
});

test('clear cancels pending writes and project and account scopes stay isolated',()=>{
 const store=memoryStorage(),first=harness(store,'https://alpha.supabase.co');
 first.api.save('prompt-reply','prompt-9',{body:'remove'});assert.equal(first.api.clear('prompt-reply','prompt-9'),true);first.runTimers();assert.equal(first.api.read('prompt-reply','prompt-9'),null);
 first.cloud.user={id:'user-a'};first.api.save('prompt-reply','prompt-9',{body:'account A'});first.api.flush();
 first.cloud.user={id:'user-b'};assert.equal(first.api.read('prompt-reply','prompt-9'),null);
 const second=harness(store,'https://beta.supabase.co');second.cloud.user={id:'user-a'};assert.equal(second.api.read('prompt-reply','prompt-9'),null);
 first.cloud.user={id:'user-a'};assert.equal(first.api.read('prompt-reply','prompt-9').body,'account A');
});
