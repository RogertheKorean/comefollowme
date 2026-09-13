const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../src/import-model.js');

test('actual lesson Markdown reads its dated title after the image caption and ignores scripture headings',()=>{
 const lesson=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/lesson.json'),'utf8'));
 const result=M.extractMetadata(lesson.raw);
 assert.deepEqual(result.title,{ko:'네 길을 지도하시리라',en:'He Shall Direct Thy Paths'});
 assert.equal(result.date,'9월 7일–13일');
 assert.equal(result.sourceUrl,'');
 assert.deepEqual(result.warnings,[]);
});
test('a different week reads explicit frontmatter, normalizes a reliable cross-year range, and uses the labeled source',()=>{
 const markdown=`---\ntitle:\n  ko: 새해 공과\n  en: New Year Lesson\ndate: 2026-12-29/2027-01-04\nsourceUrl: https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/52?lang=kor\n---\n# [창세기 1장](https://www.churchofjesuschrist.org/study/scriptures/ot/gen/1?lang=kor)`;
 const result=M.extractMetadata({ko:markdown,en:markdown});
 assert.deepEqual(result.title,{ko:'새해 공과',en:'New Year Lesson'});
 assert.equal(result.date,'2026-12-29/2027-01-04');
 assert.equal(result.sourceUrl,'https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/52?lang=kor');
});
test('unknown metadata stays blank and a links-only scripture heading is never a lesson title',()=>{
 const result=M.extractMetadata({ko:'# [잠언 1–4장](https://www.churchofjesuschrist.org/study/scriptures/ot/prov/1?lang=kor)',en:'# [Proverbs 1–4](https://www.churchofjesuschrist.org/study/scriptures/ot/prov/1?lang=eng)'});
 assert.deepEqual(result,{title:{ko:'',en:''},date:'',sourceUrl:'',warnings:[]});
});
test('single-language dated Markdown preserves a no-year date without guessing the current year',()=>{
 const result=M.extractMetadata({ko:'**9월 29일\\~10월 5일: “새로운 길”**'});
 assert.deepEqual(result.title,{ko:'새로운 길',en:''});
 assert.equal(result.date,'9월 29일–10월 5일');
});
test('English cross-month dates with an explicit year become ISO ranges',()=>{
 const result=M.extractMetadata({en:'**September 29–October 5, 2026: “A New Path”**'});
 assert.deepEqual(result.title,{ko:'',en:'A New Path'});
 assert.equal(result.date,'2026-09-29/2026-10-05');
});
test('unsafe and non-HTTPS source labels are blanked instead of imported',()=>{
 const result=M.extractMetadata({ko:'제목: 안전한 제목\n출처: javascript:alert(1)',en:'Title: Safe title\nSource URL: https://user:pass@example.test/lesson'});
 assert.equal(result.sourceUrl,'');
 assert.ok(result.warnings.includes('invalid-source-url'));
});
test('an explicit source label may use a Markdown link',()=>{
 const url='https://example.test/official-lesson';
 assert.equal(M.extractMetadata({en:`Source URL: [Official lesson](${url})`}).sourceUrl,url);
});
test('common Korean source and period labels, including flat source_url frontmatter, are recognized',()=>{
 const url='https://example.test/lesson-source';
 for(const label of ['원문 URL','원문 주소','공과 원문 URL'])assert.equal(M.extractMetadata({ko:`${label}: ${url}`}).sourceUrl,url);
 const front=`---\nsource_url: ${url}\n---\n공과 기간: 2026년 12월 28일–1월 3일`;
 assert.equal(M.extractMetadata({ko:front}).sourceUrl,url);
 assert.equal(M.extractMetadata({ko:front}).date,'2026-12-28/2027-01-03');
});
test('ISO-range title lines normalize and invalid explicit dates remain readable with a warning',()=>{
 const ranged=M.extractMetadata({en:'**2026-09-14 — 2026-09-20: “A Weekly Lesson”**'});
 assert.equal(ranged.date,'2026-09-14/2026-09-20');
 assert.equal(ranged.title.en,'A Weekly Lesson');
 const invalid=M.extractMetadata({ko:'기간: 2026년 2월 30일'});
 assert.equal(invalid.date,'2026년 2월 30일');
 assert.ok(invalid.warnings.includes('invalid-date'));
});
test('a clear standalone current-lesson manual link is accepted, but other manual references are not inferred',()=>{
 const current='https://www.churchofjesuschrist.org/study/manual/come-follow-me-for-home-and-church-old-testament-2026/38?lang=eng';
 const other='https://www.churchofjesuschrist.org/study/manual/scripture-helps-old-testament/35-proverbs?lang=eng';
 assert.equal(M.extractMetadata({en:`[This lesson](${current})\n[Study help](${other})`}).sourceUrl,current);
 assert.equal(M.extractMetadata({en:`[Study help](${other})`}).sourceUrl,'');
 const impostor=current.replace('www.churchofjesuschrist.org','churchofjesuschrist.org.evil.example');
 assert.equal(M.extractMetadata({en:`[This lesson](${impostor})`}).sourceUrl,'');
});
