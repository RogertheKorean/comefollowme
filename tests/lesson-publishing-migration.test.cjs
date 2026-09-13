const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609130006_published_lessons.sql'),'utf8');
const conflicts=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609130007_published_lesson_conflicts.sql'),'utf8');

test('published lesson migration grants public read columns but no direct writes',()=>{
 assert.match(sql,/revoke all on public\.together_published_lessons from anon,authenticated/i);
 assert.match(sql,/grant select\(lesson_id,version,lesson,revision_number,published_at\)[\s\S]*to anon,authenticated/i);
 assert.doesNotMatch(sql,/grant\s+(insert|update|delete)[\s\S]*together_published_lessons\s+to\s+(anon|authenticated)/i);
 assert.match(sql,/for select to anon,authenticated using \(true\)/i);
});

test('publish RPC independently requires confirmed named admin/editor access and hides execution from anon',()=>{
 assert.match(sql,/email_confirmed_at is not null/i);
 assert.match(sql,/coalesce\(u\.is_anonymous,false\)=false/i);
 assert.match(sql,/together_has_role\(array\['admin','editor'\]::text\[\]\)/i);
 assert.match(sql,/revoke all on function public\.together_publish_lesson\(jsonb,text\) from public,anon,authenticated/i);
 assert.match(sql,/grant execute on function public\.together_publish_lesson\(jsonb,text\) to authenticated/i);
});

test('RPC serializes stable IDs, accepts an exact retry first, then enforces optimistic concurrency',()=>{
 assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\(v_lesson_id,0\)\)/i);
 const exact=sql.indexOf('where lesson_id=v_lesson_id and version=v_version');
 const current=sql.indexOf('select version into v_current_version');
 assert.ok(exact>0&&current>exact,'exact idempotency check must precede stale-version check');
 assert.match(sql,/if v_row\.lesson<>p_lesson/i);
 assert.match(sql,/p_expected_version is null or p_expected_version<>v_current_version/i);
 assert.match(sql,/before update or delete on public\.together_published_lessons/i);
});

test('server validates the complete whitelisted lesson shape and bounded content',()=>{
 for(const field of ['title','date','sourceUrl','sourceLabel','translationStatus','alignment','raw','sections','blocks'])assert.match(sql,new RegExp("'"+field+"'"));
 assert.match(sql,/octet_length\(p_lesson::text\)>2500000/i);
 assert.match(sql,/jsonb_array_length\(p_lesson->'sections'\) not between 1 and 200/i);
 assert.match(sql,/jsonb_array_length\(p_lesson->'blocks'\) not between 1 and 2000/i);
 assert.match(sql,/v_total>800000/i);
 assert.match(sql,/exists\(select 1 from jsonb_object_keys\(p_lesson\) k where k<>all/i);
});

test('follow-up migration translates intentional stale edits to HTTP 409 without exposing the internal RPC',()=>{
 assert.match(conflicts,/rename to together_publish_lesson_v1/i);
 assert.match(conflicts,/revoke all on function public\.together_publish_lesson_v1\(jsonb,text\)[\s\S]*from public,anon,authenticated/i);
 assert.match(conflicts,/when serialization_failure then[\s\S]*errcode='PT409'/i);
 assert.match(conflicts,/grant execute on function public\.together_publish_lesson\(jsonb,text\)[\s\S]*to authenticated/i);
});
