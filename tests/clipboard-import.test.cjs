const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const E=require('../src/reference-engine.js');
let chromium;
try{({chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/roger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{}
const converter=path.join(__dirname,'../src/clipboard-import.js');
const browserPath=[process.env.CHROMIUM_EXECUTABLE,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(value=>value&&fs.existsSync(value));
const launch=()=>chromium.launch({headless:true,...(browserPath?{executablePath:browserPath}:{})});

test('clipboard HTML converter uses an inert browser template and preserves usable Church structure', {skip:!chromium}, async()=>{
 const browser=await launch();const page=await browser.newPage();const requests=[];page.on('request',request=>requests.push(request.url()));
 try{
  await page.addScriptTag({path:converter});
  const result=await page.evaluate(()=>TogetherClipboardImport.fromHTML('<header><h1>Week</h1><p>September 7–13</p></header><p>Read <a href="/study/scriptures/ot/prov/3?lang=eng&amp;id=p5-p7#p5"><strong>Proverbs [3]</strong></a>.</p><ul><li>First</li><li>Second</li></ul><nav>chrome</nav><img src="https://tracker.invalid/pixel"><script>window.executed=true</script><p hidden>hidden</p>'));
  assert.equal(result.converted,true);assert.equal(result.linkCount,1);
  assert.equal(result.markdown,'# Week\n\nSeptember 7–13\n\nRead [**Proverbs \\[3\\]**](https://www.churchofjesuschrist.org/study/scriptures/ot/prov/3?lang=eng&id=p5-p7#p5).\n\n- First\n- Second');
  assert.equal(E.extractLinks(result.markdown).length,1);assert.deepEqual(E.extractLinks(result.markdown)[0].verses,[5,6,7]);
  assert.equal(await page.evaluate(()=>window.executed===true),false);assert.deepEqual(requests,[]);
 }finally{await browser.close();}
});
test('CF_HTML, Word paragraphs, relative links, and unsafe addresses are handled conservatively', {skip:!chromium}, async()=>{
 const browser=await launch();const page=await browser.newPage();
 try{
  await page.addScriptTag({path:converter});
  const result=await page.evaluate(()=>TogetherClipboardImport.fromHTML('Version:1.0\r\n<!--StartFragment--><p class="MsoNormal"><b>Word</b> <a href="guide.html">guide</a></p><!--EndFragment-->',{sourceURL:'https://example.test/study/lesson/page.html'}));
  assert.deepEqual(result,{markdown:'**Word** [guide](https://example.test/study/lesson/guide.html)',linkCount:1,converted:true});
  const root=await page.evaluate(()=>TogetherClipboardImport.fromHTML('<p><a href="/study/manual/example/one?x=(a)&amp;y=2">Manual</a> <a href="relative.html">relative</a> <a href="javascript:alert(1)">bad</a> <a href="data:text/html,no">data</a> <a href="https://u:p@example.test/x">creds</a></p>'));
  assert.equal(root.markdown,'[Manual](https://www.churchofjesuschrist.org/study/manual/example/one?x=%28a%29&y=2) relative bad data creds');assert.equal(root.linkCount,1);
  const parsed=E.extractLinks(root.markdown);assert.equal(parsed.length,1);assert.equal(new URL(parsed[0].sourceURL).searchParams.get('x'),'(a)');
 }finally{await browser.close();}
});
test('plain and code-wrapped Markdown are not double escaped, and oversized HTML is declined', {skip:!chromium}, async()=>{
 const browser=await launch();const page=await browser.newPage();
 try{
  await page.addScriptTag({path:converter});
  const plain='**Already Markdown**\n\n[Proverbs](https://www.churchofjesuschrist.org/study/scriptures/ot/prov/3)';
  const transformed=await page.evaluate(value=>TogetherClipboardImport.transformPaste({html:`<pre><code>${value}</code></pre>`,text:value}),plain);
  assert.deepEqual(transformed,{markdown:plain,linkCount:0,converted:false});
  const oversized=await page.evaluate(()=>TogetherClipboardImport.fromHTML('<p>'+('x'.repeat(750001))+'</p>'));
 assert.deepEqual(oversized,{markdown:'',linkCount:0,converted:false});
  const spacing=await page.evaluate(()=>TogetherClipboardImport.fromHTML('<p>A<strong> bold </strong><em>italic </em><a href="https://example.test/path"> link </a>word</p>'));
  assert.equal(spacing.markdown,'A **bold** *italic* [link](https://example.test/path) word');
 }finally{await browser.close();}
});
