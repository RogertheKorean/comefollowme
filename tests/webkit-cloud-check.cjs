/* Focused WebKit/Supabase connectivity probe. Prints no credentials or record bodies. */
const fs=require('node:fs');
const path=require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve(__dirname,'../.browser-cache');
const {webkit,request}=require('C:/Users/roger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const origin=process.env.TEST_SITE_URL||'http://127.0.0.1:4173';
const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
const config=JSON.parse(html.match(/<script id="cloud-config" type="application\/json">([^<]+)<\/script>/)[1]);
const target=new URL('/rest/v1/together_notes?select=id&limit=1',config.url).href;
const relevant=url=>url.startsWith(config.url+'/rest/v1/');
const safeUrl=url=>{const value=new URL(url);return value.origin+value.pathname;};

(async()=>{
 const preflightClient=await request.newContext();
 const preflight=await preflightClient.fetch(target,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'apikey,authorization,x-client-info'}});
 const preflightHeaders=preflight.headers();
 console.log('PREFLIGHT',JSON.stringify({status:preflight.status(),allowOrigin:preflightHeaders['access-control-allow-origin']||null,allowMethods:preflightHeaders['access-control-allow-methods']||null,allowHeaders:preflightHeaders['access-control-allow-headers']||null}));
 await preflightClient.dispose();

 const browser=await webkit.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),events=[];
 page.on('request',req=>{if(relevant(req.url()))events.push({event:'request',method:req.method(),url:safeUrl(req.url())});});
 page.on('response',res=>{if(relevant(res.url())){const headers=res.headers();events.push({event:'response',method:res.request().method(),status:res.status(),url:safeUrl(res.url()),allowOrigin:headers['access-control-allow-origin']||null,vary:headers.vary||null});}});
 page.on('requestfailed',req=>{if(relevant(req.url()))events.push({event:'requestfailed',method:req.method(),url:safeUrl(req.url()),failure:req.failure()?.errorText||null});});
 page.on('pageerror',error=>events.push({event:'pageerror',message:error.message.replace(config.url,'[SUPABASE_ORIGIN]')}));
 await page.goto(origin,{waitUntil:'domcontentloaded'});
 let ready=true;try{await page.waitForFunction(()=>window.TogetherCloud?.ready,{timeout:15000});}catch{ready=false;}
 const forced=await page.evaluate(async()=>{try{await TogetherCloud.sync({force:true});return {resolved:true};}catch(error){return {resolved:false,name:error?.name||null,message:String(error?.message||error).replace(/https?:\/\/\S+/g,'[URL]')};}});
 const state=await page.evaluate(()=>({enabled:TogetherCloud.enabled,ready:TogetherCloud.ready,status:TogetherCloud.status,user:TogetherCloud.user?.id?'present':'none',remoteNotes:state.notes.filter(note=>note.remote).length,statusText:document.querySelector('.cloud-status')?.textContent.trim()||null}));
 console.log('WEBKIT_STATE',JSON.stringify({waitedUntilReady:ready,forcedSync:forced,...state}));
 console.log('WEBKIT_EVENTS',JSON.stringify(events,null,2));
 const churn=await context.newPage(),churnEvents=[];
 churn.on('request',req=>{if(relevant(req.url()))churnEvents.push({event:'request',method:req.method()});});
 churn.on('response',res=>{if(relevant(res.url()))churnEvents.push({event:'response',method:res.request().method(),status:res.status()});});
 churn.on('requestfailed',req=>{if(relevant(req.url()))churnEvents.push({event:'requestfailed',method:req.method(),failure:req.failure()?.errorText||null});});
 churn.on('pageerror',error=>churnEvents.push({event:'pageerror',message:error.message.replace(config.url,'[SUPABASE_ORIGIN]')}));
 for(let index=0;index<3;index++){await churn.goto(origin,{waitUntil:'domcontentloaded'});await churn.waitForSelector('[data-week]');}
 await churn.waitForFunction(()=>TogetherCloud.ready,{timeout:15000});
 console.log('NAVIGATION_CHURN',JSON.stringify(churnEvents,null,2));
 await browser.close();
})().catch(error=>{console.error('PROBE_FAIL',error.message);process.exitCode=1;});
