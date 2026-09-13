/* Mobile browser smoke checks. Run directly: node tests/mobile-ui.cjs */
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('C:/Users/roger/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'evidence');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.env.MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const engine = process.env.MOBILE_TEST_ENGINE || 'chromium';
const prefix = engine === 'webkit' ? 'mobile-webkit' : 'mobile';
const sizes = [320, 360, 390, 430].map(width => ({ width, height: 844 }));
const findings = [];

function check(condition, message) {
  if (!condition) findings.push(message);
}

async function metrics(page, label) {
  const result = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    scrollHeight: document.scrollingElement.scrollHeight,
    scrollTop: document.scrollingElement.scrollTop
  }));
  check(result.documentWidth <= result.viewport.width + 1 && result.bodyWidth <= result.viewport.width + 1,
    `${label}: horizontal overflow (${result.documentWidth}/${result.bodyWidth} over ${result.viewport.width}px)`);
  return result;
}

async function assertTouchTargets(page, selector, label) {
  const undersized = await page.locator(selector).evaluateAll(nodes => nodes
    .filter(node => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width && r.height; })
    .map(node => { const r = node.getBoundingClientRect(); return { text: (node.innerText || node.getAttribute('aria-label') || node.id).trim().slice(0, 36), width: Math.round(r.width), height: Math.round(r.height) }; })
    .filter(target => target.width < 44 || target.height < 44));
  check(!undersized.length, `${label}: undersized touch target(s): ${JSON.stringify(undersized)}`);
}

async function selectText(page, selector) {
  const locator = typeof selector === 'string' ? page.locator(selector) : selector;
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await locator.evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const box = await locator.boundingBox();
  if (!box) throw new Error('Selected paragraph has no visible bounding box');
  const y = box.y + Math.min(25, Math.max(8, box.height / 2));
  await page.mouse.move(box.x + 15, y);
  await page.mouse.down();
  await page.mouse.move(Math.min(box.x + 160, box.x + box.width - 8), y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

async function waitForCloud(page) {
  await page.waitForFunction(() => {
    const cloud = window.TogetherCloud;
    return cloud && (!cloud.enabled || (cloud.ready && cloud.status === 'connected'));
  }, { timeout: 15000 });
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = engine === 'webkit'
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ executablePath: chrome, headless: true });
  const context = await browser.newContext({ viewport: sizes[2], isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  const networkWarnings = [];
  let navigationInFlight = false;
  const progress = step => fs.writeFileSync(path.join(evidence, 'mobile-browser-progress.txt'), step);
  page.on('pageerror', error => {
    const message = error.message;
    if (engine === 'webkit' && navigationInFlight && message.includes('.supabase.co/rest/v1/') && message.includes('access control checks')) networkWarnings.push(message);
    else errors.push(message);
  });
  async function navigate(target) {
    navigationInFlight = true;
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
      await waitForCloud(page);
    } finally {
      navigationInFlight = false;
    }
  }

  for (const size of sizes) {
    progress(`dashboard ${size.width}`);
    await page.setViewportSize(size);
    await navigate(url);
    await page.waitForSelector('[data-week]');
    await metrics(page, `dashboard ${size.width}px`);
    await assertTouchTargets(page, '.mobile-bottom button, .mobile-menu, [data-week]', `dashboard ${size.width}px`);
  }

  await page.setViewportSize(sizes[2]);
  progress('lesson');
  await navigate(url);
  await page.locator('[data-week]').first().click();
  await page.waitForSelector('.reader-card');
  await metrics(page, 'lesson reader');
  await assertTouchTargets(page, '.mobile-bottom button, .mobile-menu, .anchor-tools button', 'lesson reader');
  await page.screenshot({ path: path.join(evidence, `${prefix}-390-lesson.png`), fullPage: false, animations: 'disabled' });

  await page.evaluate(() => demoTalk());
  progress('conference');
  await page.waitForSelector('#referenceDrawer:not([hidden])');
  await page.waitForFunction(() => {
    const rect = document.querySelector('#referenceDrawer')?.getBoundingClientRect();
    return rect && rect.left >= -1 && rect.right <= innerWidth + 1;
  });
  await metrics(page, 'conference reference');
  const reference = await page.evaluate(() => {
    const drawer = document.querySelector('#referenceDrawer');
    const body = document.querySelector('#referenceBody');
    const footer = drawer.querySelector('.reference-footer');
    const text = drawer.querySelector('.scripture-text');
    return {
      drawer: drawer.getBoundingClientRect().toJSON(), footer: footer.getBoundingClientRect().toJSON(),
      bodyScrollHeight: body.scrollHeight, bodyClientHeight: body.clientHeight,
      fontSize: text ? parseFloat(getComputedStyle(text).fontSize) : 0
    };
  });
  check(reference.footer.bottom <= 845, `conference reference: footer extends below viewport (${reference.footer.bottom}px)`);
  check(reference.bodyScrollHeight >= reference.bodyClientHeight, 'conference reference: body is not scrollable/reachable');
  check(reference.fontSize >= 16, `conference reference: body text too small (${reference.fontSize}px)`);
  await assertTouchTargets(page, '#referenceDrawer .close-btn, #referenceDrawer .reference-footer .btn, #referenceDrawer .ref-language button', 'conference reference');
  await page.locator('#referenceBody').evaluate(node => { node.scrollTop = node.scrollHeight; });
  const footerReachable = await page.locator('#referenceDrawer .reference-footer .btn.primary').isVisible();
  check(footerReachable, 'conference reference: insight footer action is not reachable');
  await page.screenshot({ path: path.join(evidence, `${prefix}-390-reference.png`), fullPage: false, animations: 'disabled' });
  await page.locator('#referenceDrawer [data-enhance="ref-close"]').click();
  progress('paragraph selection');

  await selectText(page, page.locator('.passage .source-text').nth(3));
  await page.waitForSelector('#selectionToolbar:not([hidden])');
  await assertTouchTargets(page, '#selectionToolbar button', 'selection toolbar');
  await page.locator('#selectionToolbar [data-enhance="selection-insight"]').click();
  progress('composer');
  await page.waitForSelector('#modal[open] #insightText');
  await metrics(page, 'composer');
  await page.locator('#insightText').fill('Mobile layout verification draft');
  await page.screenshot({ path: path.join(evidence, `${prefix}-390-composer.png`), fullPage: false, animations: 'disabled' });
  await assertTouchTargets(page, '#modal .modal-footer .btn, #modal .close-btn', 'composer');

  await page.evaluate(() => {
    const viewport = window.visualViewport;
    const height = Math.max(300, innerHeight - 360);
    Object.defineProperty(viewport, 'height', { configurable: true, value: height });
    viewport.dispatchEvent(new Event('resize'));
  });
  await page.waitForTimeout(100);
  const keyboard = await page.evaluate(() => ({
    keyboardOpen: document.body.classList.contains('keyboard-open'),
    modal: document.querySelector('#modal').getBoundingClientRect().toJSON(),
    footer: document.querySelector('#modal .modal-footer').getBoundingClientRect().toJSON()
  }));
  check(keyboard.keyboardOpen, 'composer keyboard simulation: keyboard-open state was not applied');
  check(keyboard.modal.bottom <= 845, `composer keyboard simulation: modal bottom is clipped (${keyboard.modal.bottom}px)`);
  await page.locator('#modal').evaluate(node => { node.scrollTop = node.scrollHeight; });
  check(await page.locator('#modal .modal-footer .btn.primary').isVisible(), 'composer keyboard simulation: primary footer action is unreachable');
  await page.screenshot({ path: path.join(evidence, `${prefix}-390-keyboard.png`), fullPage: false, animations: 'disabled' });
  await page.locator('#modal [data-action="modal-close"]').click();
  await page.waitForFunction(() => !document.querySelector('#modal').open);
  progress('auth');
  await page.locator('.topbar [data-cloud="account"]').click();
  await page.waitForSelector('#modal[open] #authForm[data-mode="signin"]');
  for (const mode of ['signin', 'signup', 'signin', 'reset', 'signin', 'guest']) {
    if (mode === 'signup') await page.locator('#authForm[data-mode="signin"] [data-cloud="signup"]').click();
    if (mode === 'reset') await page.locator('#authForm[data-mode="signin"] [data-cloud="reset"]').click();
    if (mode === 'guest') await page.locator('#authForm[data-mode="signin"] [data-cloud="guest"]').click();
    if (mode === 'signin' && !await page.locator('#authForm[data-mode="signin"]').count()) await page.locator('#authForm [data-cloud="signin"]').click();
    await page.waitForSelector(`#authForm[data-mode="${mode}"]`);
    await metrics(page, `auth ${mode}`);
    await assertTouchTargets(page, '#modal .btn, #modal .text-btn, #modal .close-btn', `auth ${mode}`);
    const badInput = await page.locator('#authForm input').evaluateAll(nodes => nodes.some(node => parseFloat(getComputedStyle(node).fontSize) < 16));
    check(!badInput, `auth ${mode}: input text is below 16px`);
  }
  await page.screenshot({ path: path.join(evidence, `${prefix}-390-auth-guest.png`), fullPage: false, animations: 'disabled' });

  await page.setViewportSize({ width: 844, height: 390 });
  progress('landscape');
  await navigate(url);
  await page.locator('[data-week]').first().click();
  await page.waitForSelector('.reader-card');
  await metrics(page, 'landscape lesson');
  await page.evaluate(() => demoTalk());
  await page.waitForSelector('#referenceDrawer:not([hidden])');
  await page.waitForFunction(() => {
    const rect = document.querySelector('#referenceDrawer')?.getBoundingClientRect();
    return rect && rect.left >= -1 && rect.right <= innerWidth + 1;
  });
  await metrics(page, 'landscape conference reference');
  await page.screenshot({ path: path.join(evidence, `${prefix}-landscape-reference.png`), fullPage: false, animations: 'disabled' });

  fs.writeFileSync(path.join(evidence, `${prefix}-browser-report.json`), JSON.stringify({
    browser: `${engine === 'webkit' ? 'WebKit' : 'Chromium'} mobile emulation (not a physical Android or iOS device)`,
    url, checked: ['320x844', '360x844', '390x844', '430x844', '844x390 landscape'],
    findings, pageErrors: errors, networkWarnings
  }, null, 2));
  await browser.close();
  if (errors.length || findings.length) {
    console.error(JSON.stringify({ findings, pageErrors: errors }, null, 2));
    process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
