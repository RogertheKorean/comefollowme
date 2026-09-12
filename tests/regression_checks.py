"""Additional isolated Chromium DOM regression checks; see TESTING.md."""
from pathlib import Path
import json, os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];checks=[]
def check(name, result):
    assert result, name
    checks.append({'name':name,'status':'passed'});print('PASS',name,flush=True)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});page.set_default_timeout(5000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.evaluate('''()=>{const s={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>s[k]??null,setItem:(k,v)=>s[k]=String(v),removeItem:k=>delete s[k]}})}''')
    page.set_content((ROOT/'public/index.html').read_text())
    try:
        outcome=page.evaluate('''()=>{const refs=RE.extractLinks(BASE.raw.ko);for(const r of refs){openReference(r,openingOrigin(null),{focus:false,pushHistory:false});if(document.querySelector('#referenceDrawer').hidden)throw Error('Pane hidden: '+r.key);}closeReference();return refs.length;}''')
        check('Every Korean source link opens a pane without exceptions',outcome>60)
        check('No errors while resolving all links',not errors)
        page.click('[data-action="demo-select"]');page.wait_for_timeout(70)
        check('Lesson range selection remains exact',page.evaluate('selectedAnchor && !isRefAnchor(selectedAnchor) && selectedAnchor.quote.length>0'))
        # Keep a private reflection and ensure it never enters the class feed / queue.
        page.click('#floatingInsight');page.wait_for_function('composer && !composer.capturePending');page.fill('#insightText','비공개 검증 기록');page.click('[data-enhance="keep-private"]')
        check('Private lesson insight saved',page.evaluate('state.notes.some(n=>n.owner==="me"&&n.scope==="private")'))
        check('Private insight not shared or queued',page.evaluate('!sharedNotes().some(n=>n.owner==="me") && !queueNotes().some(n=>n.owner==="me")'))
        # Whole chapter has 35 verses; a multi-chapter label exposes all chapters.
        page.evaluate('openReference(RE.parse(RE.CHURCH+"/study/scriptures/ot/prov/3?lang=kor","잠언 3~4장"),openingOrigin(null))')
        check('Chapter range represented with tabs',page.locator('.ref-chapters button').count()==2)
        check('Proverbs 3 fully available',page.locator('[data-verse-text]').count()==35)
        page.click('[data-v3="reference-chapter"][data-chapter="4"]');check('Chapter tab resolves registered excerpt',page.evaluate('reference.key==="ot/prov/4"') and '발췌' in page.locator('#referenceDrawer').inner_text())
        # Manual quoted by user is source p19, not fabricated from a row number.
        page.evaluate('openReference(RE.parse(RE.CHURCH+"/study/manual/teaching-in-the-saviors-way-2022/07-part-2/11-invite-diligent-learning?lang=kor&id=p19#p19"),openingOrigin(null))')
        check('User-supplied manual excerpt p19',page.evaluate('reference.resolved.ids.includes("p19")') and page.locator('[data-unit-id="p19"]').count()==1)
        page.evaluate('navigate("import")');page.fill('#importTitleKO','검증용 공과');page.fill('#importDate','시연');page.fill('#importURL','https://example.org/lesson');page.fill('#importKO','## 시작\n\n[읽을 말씀](https://www.churchofjesuschrist.org/study/general-conference/2015/04/therefore-they-hushed-their-fears?lang=kor)');page.fill('#importEN','')
        page.evaluate('previewImport()');check('Lesson import automatically audits reference URLs',page.locator('.import-audit .audit-row').count()==1)
        page.check('#importAlignment');page.check('#importRights');page.evaluate('applyImport()');check('New lesson reader appears',page.evaluate('currentLesson().title.ko==="검증용 공과"'))
        page.locator('.source-text a').click();check('Imported lesson links use same general resolver','그러므로' in page.locator('#referenceTitle').inner_text())
        check('Lesson content pack round trip',page.evaluate('(()=>{const p=contentPack();importPack(p,{persist:false});return p.lessons.length===1;})()'))
        # Malformed pack cannot overwrite existing registered contents.
        check('Import validation is atomic',page.evaluate('''()=>{const before=state.customLessons.length;try{importPack({schema:'together-content-pack-v3',documents:[{url:'javascript:evil'}],lessons:[]});}catch{}return state.customLessons.length===before;}'''))
        # Keep source and typed form after a storage write failure.
        page.evaluate('''()=>{showRegister('https://example.org/test','검증 본문','ko');document.querySelector('#refBody').value='검증용 단락';previewReferenceRegistration();document.querySelector('#refRights').checked=true;window.__set=localStorage.setItem;localStorage.setItem=()=>{throw Error('Quota test')};saveReferenceRegistration();}''')
        check('Reference registration storage failure remains visible',page.locator('#refImportError').is_visible() and page.locator('#modal').is_visible())
        check('Failed registration keeps prior library',page.evaluate('!state.referenceDocuments.some(d=>d.url==="https://example.org/test")'))
        page.evaluate('localStorage.setItem=window.__set;closeModal(false)')
        check('No runtime errors',not errors)
        (ROOT/'evidence/regression-report.json').write_text(json.dumps({'mode':'isolated DOM + storage double','sourceLinksChecked':outcome,'checks':checks,'errors':errors},ensure_ascii=False,indent=2))
        print('RESULT',len(checks),'passed')
    except:
        page.screenshot(path=str(ROOT/'evidence/REGRESSION_FAILURE.png'));print(errors);raise
    finally:b.close()
