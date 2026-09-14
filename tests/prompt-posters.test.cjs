const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202609140008_prompt_posters.sql'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../src/prompts.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/prompts.css'),'utf8');

test('prompt poster bucket is private, image-only, and capped at 5 MB',()=>{
 assert.match(sql,/values\('together-prompt-posters','together-prompt-posters',false,5242880,array\['image\/png','image\/jpeg','image\/webp'\]/i);
 assert.match(sql,/poster_path ~ '\^\[a-f0-9\]\{8\}[^']+\\\.\(png\|jpg\|jpeg\|webp\)\$'/i);
});

test('visitors can download only a poster attached to a public prompt row',()=>{
 assert.match(sql,/create policy together_prompt_posters_read[\s\S]*for select to anon,authenticated[\s\S]*exists \([\s\S]*from public\.together_prompts p[\s\S]*p\.poster_path=name/i);
 assert.doesNotMatch(sql,/public\s*=\s*true/i);
});

test('confirmed prompt authors upload only to their UUID folder and remove only unreferenced objects',()=>{
 assert.match(sql,/split_part\(name,'\/',1\)=\(select auth\.uid\(\)\)::text/i);
 assert.match(sql,/together_can_author_prompt_poster\(\)/i);
 assert.match(sql,/email_confirmed_at is not null/i);
 assert.match(sql,/not exists \([\s\S]*from public\.together_prompts p[\s\S]*p\.poster_path=name/i);
 assert.match(sql,/together_has_role\(array\['admin'\]::text\[\]\)[\s\S]*split_part\(name,'\/',1\)[\s\S]*together_has_role\(array\['teacher'\]::text\[\]\)/i);
 assert.match(sql,/create policy together_prompt_posters_author_read[\s\S]*for select to authenticated[\s\S]*owner_id=\(select auth\.uid\(\)\)::text[\s\S]*split_part\(name,'\/',1\)=\(select auth\.uid\(\)\)::text/i);
 assert.match(sql,/create policy together_prompt_posters_remove[\s\S]*owner_id=\(select auth\.uid\(\)\)::text/i);
});

test('row attachment requires an existing object and a changed path owned by the acting author',()=>{
 assert.match(sql,/before insert or update of poster_path on public\.together_prompts/i);
 assert.match(sql,/from storage\.objects o[\s\S]*o\.bucket_id='together-prompt-posters' and o\.name=new\.poster_path/i);
 assert.match(sql,/split_part\(new\.poster_path,'\/',1\)<>v_uid::text/i);
 assert.match(sql,/errcode='23503'/i);
 assert.match(sql,/errcode='42501'/i);
});

test('prompt UI preserves short links while wiring poster lifecycle and weekly source selection',()=>{
 assert.match(js,/function shareURL\(slug\).*\/p\//);
 assert.match(js,/T\('공유 링크','Share link'\)/);
 assert.match(js,/storage\.from\(BUCKET\)\.download\(path\)/);
 assert.match(js,/storage\.from\(BUCKET\)\.upload\(d\.uploadPath,d\.posterFile/);
 const rowWrite=js.indexOf(".update(payload).eq('id',rowId)"),oldPoster=js.indexOf('const oldPoster=d.poster_path'),oldRemoval=js.indexOf('storage.from(BUCKET).remove([oldPoster])');
 assert.ok(rowWrite>0&&oldPoster>rowWrite&&oldRemoval>oldPoster,'old poster removal must follow the successful row patch');
 assert.match(js,/id="promptLessonPicker"/);
 assert.match(js,/\$\('#promptSource'\)\.value=sourceForLesson\(lesson\)/);
 assert.match(js,/if\(JSON\.parse\(anchor\.value\)\.lessonKey!==next\)anchor\.value=''/);
 assert.match(js,/const choices=pickerLessons\(selectedKey\),latestById=[^;]+;return unknown\+choices\.map/);
 assert.match(js,/defaultLesson=row\|\|a\?readerLesson:latestForLesson\(readerLesson\)/);
 assert.match(js,/T\(' \(이전 버전\)',' \(Earlier version\)'\)/);
 assert.match(js,/d\.uploadComplete=true;if\(!active\(\)\)\{await discardUploadedPoster\(d\);return;\}/);
 assert.match(js,/if\(d\.busy\)\{event\.preventDefault\(\);event\.stopImmediatePropagation\(\);return;\}/);
 assert.match(css,/\.prompt-poster,\.prompt-editor-poster\{[^}]*object-fit:contain/i);
 assert.match(css,/\.prompt-editor-form\{grid-template-columns:minmax\(0,1fr\);min-width:0\}/i);
 assert.match(js,/id="promptReplyForm"/);
});
