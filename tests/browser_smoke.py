"""Run with `python tests/browser_smoke.py --url http://127.0.0.1:4173`.
The --isolated option is for constrained CI: set_content and a localStorage double.
That option tests the DOM app, not browser-origin persistence or Vercel hosting.
Requires Python playwright and a Chromium browser; no production dependencies.
"""
import argparse, json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--isolated',action='store_true');parser.add_argument('--url',default='http://127.0.0.1:4173');args=parser.parse_args()
results=[]; errors=[]; requests=[];popups=[]

def check(name, value):
    assert value, name
    results.append({'name':name,'status':'passed'})
    print('PASS',name,flush=True)

with sync_playwright() as pw:
    exe=os.environ.get('CHROMIUM_EXECUTABLE') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None)
    browser=pw.chromium.launch(executable_path=exe,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
    def newpage(saved=None,mobile=False):
        p=context.new_page();p.set_default_timeout(4500)
        p.on('pageerror',lambda e:errors.append(str(e)));p.on('popup',lambda q:popups.append(q))
        p.on('request',lambda q:requests.append(q.url))
        if mobile:p.set_viewport_size({'width':390,'height':844})
        if args.isolated:
            p.evaluate('''saved=>{const s=saved||{};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=String(v),removeItem:k=>delete s[k],clear:()=>Object.keys(s).forEach(k=>delete s[k])}});window.__testStorage=s;}''',saved)
            p.set_content((ROOT/'public/index.html').read_text())
        else:p.goto(args.url)
        p.wait_for_timeout(120);return p
    page=newpage()
    try:
        check('Clean initial render',not errors and page.locator('#readerCard').count()==1)
        check('No external href in normal lesson links',page.locator('a[href^="http"]').count()==0)
        check('Local demo / unofficial notice displayed','로컬 데모' in page.locator('body').inner_text())
        page.screenshot(path=str(ROOT/'evidence/01-study.png'))
        page.click('[data-v3="demo-talk"]');page.wait_for_timeout(300)
        check('Conference opens in same reference pane','그러므로' in page.locator('#referenceTitle').inner_text())
        check('Conference is unmistakably labeled summary',page.locator('.summary-notice').count()==1)
        check('Four locally selectable summary paragraphs',page.locator('#referenceBody .verse-row').count()==4)
        page.click('[data-enhance="ref-select-verse"][data-verse="1"]')
        check('Actual local unit ID stored',page.evaluate('selectedAnchor.segments[0].unitId')=='summary-1')
        page.click('[data-enhance="ref-highlight"]')
        check('Reference highlight saved',page.evaluate('state.highlights.length')==1)
        check('Highlight painted on reference text',page.locator('#referenceBody mark').count()>0)
        page.screenshot(path=str(ROOT/'evidence/02-conference.png'))
        page.click('[data-v3="reference-language"][data-language="en"]')
        check('Pane English text available','uncertain' in page.locator('#referenceBody').inner_text().lower())
        check('Korean marks do not transfer by offsets to English',page.locator('#referenceBody mark').count()==0)
        page.click('[data-v3="reference-language"][data-language="ko"]')
        check('Korean highlight returns',page.locator('#referenceBody mark').count()>0)
        # Nested reference and back preserve source and scrolling.
        nested=page.locator('#referenceBody a[data-ref-url]').first;nested.scroll_into_view_if_needed()
        before=page.evaluate('document.querySelector("#referenceBody").scrollTop')
        nested.click();page.wait_for_timeout(80)
        check('Nested scripture opens in same pane','전도서' in page.locator('#referenceTitle').inner_text())
        page.click('[data-v3="ref-back"]');page.wait_for_timeout(80)
        check('Back restores reference and scroll',('그러므로' in page.locator('#referenceTitle').inner_text()) and abs(page.evaluate('document.querySelector("#referenceBody").scrollTop')-before)<5)
        # Accurate substring DOM selection, not just whole paragraphs.
        page.locator('[data-verse-text="2"]').scroll_into_view_if_needed()
        page.evaluate('''()=>{const el=document.querySelector('[data-verse-text="2"]'),n=el.firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,16);getSelection().removeAllRanges();getSelection().addRange(r);selectionChanged();}''')
        check('Selected substring offsets are exact',page.evaluate('selectedAnchor.segments[0].end')==16)
        page.click('[data-enhance="ref-insight"]');page.wait_for_function('composer && !composer.capturePending')
        check('Composer has image above thought field',page.locator('#snapshotSlot img').count()==1 and page.locator('#insightText').count()==1)
        kind=page.evaluate('composer.snapshot.kind');check('Capture result identified honestly',kind.startswith('dom-') or 'fallback' in kind or 'quote' in kind)
        page.click('[data-enhance="share-insight"]');check('Empty thought validation',page.locator('#composerError').is_visible())
        page.fill('#insightText','주님께 시선을 돌릴 때 마음이 차분해졌던 경험을 나누고 싶습니다.')
        page.check('#classConsent');page.wait_for_timeout(70)
        page.screenshot(path=str(ROOT/'evidence/03-composer.png'))
        page.click('[data-enhance="share-insight"]');page.wait_for_timeout(100)
        note=page.evaluate('state.notes.find(n=>n.owner==="me")');nid=note['id']
        check('Shared thought stores source language / revision / unit',note['anchor']['language']=='ko' and note['anchor']['reference']['revision'] and note['anchor']['segments'][0]['unitId']=='summary-2')
        check('Presentation consent separate from class scope',note['scope']=='class' and note['consent'])
        check('Image preserved with post',note['snapshot']['data'].startswith('data:image/'))
        page.click('[data-enhance="view-post"]');page.wait_for_timeout(100)
        page.locator(f'#app [data-note="{nid}"] [data-action="thread"]').click();page.fill('#replyText','저도 기억하고 실천해 보겠습니다.');page.click('[data-action="send-reply"]')
        check('Reply added locally',page.evaluate('state.notes.find(n=>n.owner==="me").comments.length')==1)
        page.click('#modal [data-action="modal-close"]')
        page.locator(f'#app [data-note="{nid}"] [data-action="source"]').click();page.wait_for_timeout(100)
        check('Go to reference restores pinned version and quote',page.evaluate('reference.pinnedRevision')==note['anchor']['reference']['revision'] and page.locator('#referenceBody mark').count()>0)
        # Register a different version of the same URL. Entirely original test-only text.
        page.evaluate('showRegister(reference.sourceURL,"검증용 새 본문","ko")')
        page.fill('#refTitle','검증용 새 본문')
        page.fill('#refBody','{#p1}\n이 문장은 프로그램 검증용으로 작성된 새 본문입니다.\n\n{#p2}\n두 번째 검증 문단입니다.')
        page.click('[data-v3="reference-save"]');check('Registration requires reviewed preview',page.locator('#refImportError').is_visible())
        page.click('[data-v3="reference-preview"]');page.check('#refRights');page.click('[data-v3="reference-save"]');page.wait_for_timeout(300)
        check('Registered full text replaces summary for ordinary link','검증용 새 본문'==page.locator('#referenceTitle').inner_text() and page.locator('.summary-notice').count()==0)
        page.evaluate('(a)=>goToAnchor(a)',note['anchor']);page.wait_for_timeout(300)
        check('Old reflection returns to old archived summary instead of new text','그러므로' in page.locator('#referenceTitle').inner_text() and page.evaluate('reference.pinnedRevision')==note['anchor']['reference']['revision'])
        # Missing opaque IDs stay explicit; they are never guessed from row counts.
        page.evaluate('openReference(RE.parse(RE.CHURCH+"/study/manual/for-the-strength-of-youth/06-love-god-love-your-neighbor?lang=kor&id=p_qUmpH#p_qUmpH"),openingOrigin(null))')
        check('Unregistered text shows internal missing state',page.locator('.reference-no-data').count()==1)
        page.click('.reference-no-data [data-v3="register-current"]')
        page.fill('#refTitle','검증용 교재')
        page.fill('#refBody','{#p_qUmpH}\n첫 번째 검증 문단.\n\n{#p_second}\n두 번째 검증 문단.')
        page.click('[data-v3="reference-preview"]');page.check('#refRights');page.click('[data-v3="reference-save"]')
        page.evaluate('(()=>{const u=new URL(reference.sourceURL);u.searchParams.set("id","p_qUmpH");u.hash="p_qUmpH";openReference(RE.parse(u.href),reference.origin)})()')
        check('Opaque original ID resolves exactly',page.evaluate('reference.resolved.ids.includes("p_qUmpH")'))
        page.click('[data-v3="reference-language"][data-language="en"]')
        check('Missing English is not silently Korean text',page.locator('.reference-no-data').count()==1 and page.locator('[data-verse-text]').count()==0)
        page.click('#referenceDrawer [data-enhance="ref-close"]')
        page.evaluate('navigate("library")');page.wait_for_timeout(100)
        check('Lesson reference audit includes conference and manual kinds',page.evaluate('currentAudit().some(r=>r.kind==="conference") && currentAudit().some(r=>r.kind==="manual")'))
        page.click('[data-v3="library-filter"][data-filter="conference"]')
        check('Conference audit shows 4 canonical documents',page.locator('.audit-row').count()==4)
        # Content export intentionally excludes journals and private data.
        pack=page.evaluate('contentPack()')
        check('Content export excludes notes, images, comments and marks',all(k not in pack for k in ['notes','highlights','comments','queue','draft']) and note['snapshot']['data'] not in json.dumps(pack))
        check('Content pack includes registered original paragraphs',len(pack['documents'])==2)
        check('Content pack remains importable',page.evaluate('(p)=>{importPack(p,{persist:false});return true}',pack))
        # HTML import removes active elements, retains safe text IDs, rejects schemes.
        blocks=page.evaluate('parseReferenceText(`<p id="p_test">검증 <a href="javascript:alert(1)">링크</a></p><script>window.BAD=true</script><iframe src="https://example.org"></iframe>`,"html")')
        check('HTML import strips active markup and unsafe links',blocks[0]['id']=='p_test' and 'javascript:' not in json.dumps(blocks) and not page.evaluate('!!window.BAD'))
        check('Plain pasted paragraphs have explicit local IDs',page.evaluate('parseReferenceText("원문 ID 없는 문장")[0].id.startsWith("local-")'))
        # Classroom must exclude private notes and nonconsenting samples.
        page.evaluate('state.role="teacher";navigate("classroom")')
        page.locator(f'#app [data-note="{nid}"] [data-action="queue-toggle"]').click()
        check('Only consented class reflections enter presentation',page.evaluate('queueNotes().every(n=>n.scope==="class"&&n.consent)'))
        page.click('[data-action="present"]');check('Presentation starts',page.locator('#presentation').is_visible());page.keyboard.press('Escape')
        # Preserve local storage data across a new document (or real same-origin reload).
        saved=page.evaluate('Object.fromEntries(Object.entries(window.__testStorage||{}))') if args.isolated else None
        refreshed=newpage(saved);check('Storage round trip restores reflection and highlights',refreshed.evaluate('state.notes.some(n=>n.owner==="me") && state.highlights.length===1'))
        refreshed.close()
        # Independent clean screenshot library, avoids test-only registered content in evidence.
        clean=newpage();clean.evaluate('navigate("library")');clean.click('[data-v3="library-filter"][data-filter="conference"]');clean.screenshot(path=str(ROOT/'evidence/04-reference-library.png'));clean.close()
        mobile=newpage(mobile=True);mobile.click('[data-v3="demo-talk"]');mobile.wait_for_timeout(300)
        check('Mobile reference fits 390px viewport',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        check('Mobile pane marks background inert',mobile.evaluate('document.querySelector("#app").inert'))
        mobile.screenshot(path=str(ROOT/'evidence/05-mobile-reference.png'))
        mobile.locator('[data-enhance="ref-select-verse"]').first.click();mobile.click('[data-enhance="ref-insight"]');mobile.wait_for_function('composer && !composer.capturePending')
        check('Mobile insight composer is usable',mobile.locator('#insightText').count()==1 and mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        mobile.screenshot(path=str(ROOT/'evidence/06-mobile-composer.png'))
        mobile.keyboard.press('Escape');mobile.keyboard.press('Escape');check('Mobile Escape closes both modal and pane',mobile.evaluate('!document.querySelector("#modal").open && !reference.open'))
        mobile.close()
        check('No runtime page errors',not errors)
        check('No external popups',not popups)
        external=[u for u in requests if u.startswith('http') and not u.startswith(args.url)]
        check('No external content network fetches',not external)
        report={'mode':'isolated DOM + localStorage double' if args.isolated else 'HTTP origin','browser':browser.version,'checks':results,'pageErrors':errors,'popups':len(popups),'externalRequests':external,'captureKind':kind,'notTested':['live Vercel deployment','real mobile hardware','Safari and Firefox']+(['native localStorage persistence and quota','HTTP browser navigation blocked by container policy'] if args.isolated else [])}
        (ROOT/'evidence/browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print('RESULT',len(results),'passed',flush=True)
    except Exception:
        page.screenshot(path=str(ROOT/'evidence/FAILURE.png'))
        print('PAGE ERRORS',errors,flush=True)
        raise
    finally:browser.close()
