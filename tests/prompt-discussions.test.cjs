'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609140009_prompt_reply_discussions.sql'),'utf8');

test('reply discussions use bounded rows and cascade from the parent reply',()=>{
 assert.match(sql,/create table public\.together_prompt_reply_comments[\s\S]*id uuid primary key[\s\S]*reply_id uuid not null references public\.together_prompt_replies\(id\) on delete cascade[\s\S]*author text not null check \(char_length\(btrim\(author\)\) between 1 and 50\)[\s\S]*body text not null check \(char_length\(btrim\(body\)\) between 1 and 1500\)/i);
 assert.match(sql,/create table public\.together_prompt_reply_reactions[\s\S]*reply_id uuid not null references public\.together_prompt_replies\(id\) on delete cascade[\s\S]*primary key\(reply_id,owner_id\)/i);
});

test('public receives read only access and clients cannot supply server timestamps',()=>{
 assert.match(sql,/revoke all on public\.together_prompt_reply_comments,public\.together_prompt_reply_reactions from anon,authenticated/i);
 assert.match(sql,/grant select on public\.together_prompt_reply_comments,public\.together_prompt_reply_reactions to anon,authenticated/i);
 assert.match(sql,/grant insert\(id,reply_id,owner_id,author,body\) on public\.together_prompt_reply_comments to authenticated/i);
 assert.match(sql,/grant insert\(reply_id,owner_id\) on public\.together_prompt_reply_reactions to authenticated/i);
 assert.doesNotMatch(sql,/grant (?:[^;]*update|insert\([^)]*created_at)/i);
});

test('authenticated actors can create for a valid parent and remove only their own rows',()=>{
 for(const kind of ['comments','reactions']){
  assert.match(sql,new RegExp(`create policy together_prompt_reply_${kind}_read[\\s\\S]*for select to anon,authenticated[\\s\\S]*from public\\.together_prompt_replies r[\\s\\S]*r\\.id=reply_id`,'i'));
  assert.match(sql,new RegExp(`create policy together_prompt_reply_${kind}_create[\\s\\S]*for insert to authenticated[\\s\\S]*owner_id=\\(select auth\\.uid\\(\\)\\)[\\s\\S]*from public\\.together_prompt_replies r`,'i'));
  assert.match(sql,new RegExp(`create policy together_prompt_reply_${kind}_remove[\\s\\S]*for delete to authenticated[\\s\\S]*owner_id=\\(select auth\\.uid\\(\\)\\)`,'i'));
 }
});

test('insert triggers always replace created_at with server time',()=>{
 assert.match(sql,/new\.created_at=now\(\)/i);
 assert.match(sql,/create trigger together_prompt_reply_comments_timestamp[\s\S]*before insert on public\.together_prompt_reply_comments/i);
 assert.match(sql,/create trigger together_prompt_reply_reactions_timestamp[\s\S]*before insert on public\.together_prompt_reply_reactions/i);
});
