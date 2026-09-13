const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('browser builds accept public configuration and reject missing or privileged credentials',()=>{
 const tempRoot=fs.realpathSync(os.tmpdir());
 const temporary=fs.mkdtempSync(path.join(tempRoot,'together-public-config-'));
 try{
  for(const dir of ['src','content','scripts'])fs.cpSync(path.join(__dirname,'..',dir),path.join(temporary,dir),{recursive:true});
  const baseEnv={...process.env};delete baseEnv.SUPABASE_URL;delete baseEnv.SUPABASE_PUBLISHABLE_KEY;
  const project='https://example.supabase.co';
  const jwt=role=>'header.'+Buffer.from(JSON.stringify({role})).toString('base64url')+'.signature';
  const cases=[
   {label:'local mode',env:{},allowed:true},
   {label:'publishable',env:{SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},allowed:true},
   {label:'legacy anon',env:{SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:jwt('anon')},allowed:true},
   {label:'secret',env:{SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:'sb_secret_fixture'},allowed:false},
   {label:'service role',env:{SUPABASE_URL:project,SUPABASE_PUBLISHABLE_KEY:jwt('service_role')},allowed:false},
   {label:'missing key',env:{SUPABASE_URL:project},allowed:false},
   {label:'lookalike project host',env:{SUPABASE_URL:'https://example.supabase.co.evil.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},allowed:false}
  ];
  for(const item of cases){
   const result=spawnSync(process.execPath,[path.join(temporary,'scripts/build.mjs')],{encoding:'utf8',env:{...baseEnv,...item.env}});
   assert.equal(result.status===0,item.allowed,item.label);
   if(item.allowed){const html=fs.readFileSync(path.join(temporary,'public/index.html'),'utf8');const config=JSON.parse(html.match(/<script id="cloud-config"[^>]*>(.*?)<\/script>/s)[1]);assert.equal(config.key,item.env.SUPABASE_PUBLISHABLE_KEY||'');}
  }
 }finally{
  const resolved=fs.realpathSync(temporary);
  assert.equal(path.dirname(resolved).toLowerCase(),tempRoot.toLowerCase());
  assert.ok(path.basename(resolved).startsWith('together-public-config-'));
  fs.rmSync(resolved,{recursive:true,force:true});
 }
});
