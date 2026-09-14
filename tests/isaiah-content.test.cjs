const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const E=require('../src/reference-engine.js');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'../content',name)));
const chapters=read('scriptures.json').chapters,coverage=read('reference-coverage-2026-09-14.json'),receipts=read('isaiah-source-receipts.json');
const docs=read('deployment-content.json').documents.map(E.validateDocument);
const expected={};
for(const [book,start,counts]of [['ot/isa',1,[31,22,26,6,30,13,25,22,21,34,16,6]],['ot/2-kgs',15,[38,20,41,37,37,21]],['ot/2-chr',26,[23,9,27,36,27,21,33]],['nt/matt',1,[25]],['nt/matt',4,[25]],['nt/matt',21,[46]],['nt/luke',1,[80]]])counts.forEach((count,i)=>expected[book+'/'+(start+i)]=count);

test('weekly chapter ranges have complete contiguous KRV and KJV verses',()=>{
 assert.deepEqual([...coverage.scripture_chapters].sort(),Object.keys(expected).sort());
 for(const language of ['ko','en']){
  let total=0;
  for(const [key,count]of Object.entries(expected)){
   const c=chapters[key];assert.ok(c,key);assert.equal(c.coverage,'full');
   assert.deepEqual(Object.keys(c.verses[language]).map(Number),Array.from({length:count},(_,i)=>i+1),key+' '+language);
   for(const text of Object.values(c.verses[language]))assert.ok(text.trim()&&!/[<>\uFFFD]/.test(text));
   total+=count;
  }
  assert.equal(total,798);
 }
});

test('each imported verse set matches its recorded source receipt and attribution',()=>{
 assert.equal(receipts.length,58);
 for(const r of receipts){
  const c=chapters[r.key],hash=crypto.createHash('sha256').update(JSON.stringify(c.verses[r.language])).digest('hex');
  assert.equal(hash,r.text_sha256,r.key+' '+r.language);assert.equal(c.source[r.language],r.url);
  assert.match(r.page_sha256,/^[a-f0-9]{64}$/);assert.ok(c.provenance[r.language]);
  assert.match(c.edition.ko,/개역한글/);assert.match(c.edition.en,/King James|KJV/);
 }
 assert.match(chapters['ot/isa/1'].verses.en[18],/though your sins be as scarlet/);
 assert.match(chapters['ot/isa/1'].verses.ko[18],/주홍/);
 assert.match(chapters['ot/isa/12'].verses.en[6],/Holy One of Israel/);
});

test('every inventoried weekly link resolves to text or a labeled guide in both languages',()=>{
 assert.equal(coverage.links.length,28);assert.deepEqual(coverage.link_counts,{ko:76,en:79});
 for(const link of coverage.links)for(const language of ['ko','en']){
  const c=chapters[link.key],d=docs.find(d=>d.key===link.key&&d.language===language);
  assert.ok(c?.verses[language]||d?.blocks.length,link.key+' '+language);
  if(!c)continue;
  for(const url of link.urls){
   const parsed=E.parse(url),blocks=Object.keys(c.verses[language]).map(n=>({id:'p'+n}));
   assert.deepEqual(E.resolveTargets(parsed.targets,blocks).missing,[],url);
  }
 }
});

test('source guides retain local paragraph identity and honest coverage',()=>{
 assert.equal(docs.length,26);
 const full=docs.filter(d=>d.coverage==='full');assert.equal(full.length,1);
 assert.equal(full[0].key,'/study/manual/hymns/high-on-the-mountain-top');assert.equal(full[0].language,'en');assert.equal(full[0].blocks.length,4);
 for(const d of docs){
  assert.ok(d.blocks.every(b=>b.sourceId===false));
  if(d.coverage==='summary')assert.ok(d.blocks.every(b=>b.id.startsWith('summary-')));
 }
 const guide=docs.find(d=>d.key==='bofm/1-ne/19'&&d.language==='ko');
 assert.deepEqual(E.resolveTargets(E.targetSpec('p23'),guide.blocks).missing,['p23']);
 const manual=docs.find(d=>d.key.includes('scripture-helps-old-testament'));
 assert.deepEqual(E.resolveTargets(E.targetSpec('p_gKifo-p_oivkY'),manual.blocks).missing,['p_gKifo–p_oivkY']);
});

test('English source language survives validation without changing document identity',()=>{
 const d=docs.find(d=>d.key.includes('scripture-reading-and-revelation')&&d.language==='ko');
 assert.equal(d.sourceLanguage,'en');assert.equal(E.validateDocument(d).revision,d.revision);
 assert.throws(()=>E.validateDocument({...d,sourceLanguage:'invalid'}));
 const {sourceLanguage,...ordinary}=d;
 assert.equal(E.validateDocument(ordinary).key,d.key);
 assert.notEqual(E.validateDocument(ordinary).revision,d.revision);
});
