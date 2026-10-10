/* Browser geometry is compared with a capture of Wix, not with the generated data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'reference/mobile-source.json')));
const output = process.env.QA_OUTPUT;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1.25, `${label}: ${actual}, expected ${expected}`);

(async () => {
  const server = http.createServer((request, response) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep) && file !== root) { response.writeHead(403).end(); return; }
    const target = file === root ? path.join(root, 'index.html') : file;
    fs.readFile(target, (error, data) => {
      if (error) { response.writeHead(404).end(); return; }
      const mime = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.webp': 'image/webp', '.woff2': 'font/woff2' };
      response.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
      response.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = process.env.QA_URL || `http://127.0.0.1:${server.address().port}/`;
  let browser;
  try {
    const engine = process.env.QA_ENGINE === 'webkit' ? webkit : chromium;
    browser = await engine.launch({ headless: true, ...(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {}) });
    const desktop = {};
    for (const width of [320, 390, 430, 700, 1280, 1710]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url, { waitUntil: 'networkidle' });
      // Load offscreen frames too, so screenshots and asset checks cover complete galleries.
      await page.locator('img[src]').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('img[src]')].every(image => image.complete && image.naturalWidth > 0));
      await page.locator('img[src]').evaluateAll(async images => {
        for (const image of images) await image.decode();
      });
      const scale = width / source.baseWidth;
      assert.equal(await page.locator('.publication-marquee').count(), 2);
      assert.equal(await page.locator('.about-portrait').count(), 1);
      assert.equal(await page.locator('#section-index a').count(), 4);
      assert.equal(await page.locator('.photo-frame').count(), 150);
      const geometry = await page.evaluate(() => [...document.querySelectorAll('[data-gallery]')].map(shell => {
        const viewport = shell.querySelector('.row-viewport,.layout-viewport'), v = viewport.getBoundingClientRect(), s = getComputedStyle(shell);
        return { id: shell.dataset.gallery, x: v.x, width: v.width, bg: s.backgroundColor, before: parseFloat(s.paddingTop), after: parseFloat(s.paddingBottom),
          frames: [...viewport.querySelectorAll('.photo-frame')].map(frame => { const r = frame.getBoundingClientRect(); return { id: frame.dataset.photoId, x: r.x - v.x, y: r.y - v.y, w: r.width, h: r.height }; }) };
      }));
      if (width <= 700) {
        for (const original of [...source.rows, ...source.layouts]) {
          const actual = geometry.find(row => row.id === original.id);
          near(actual.x / scale, original.x, `${original.id} left margin`);
          assert.equal(actual.bg, `rgb(${original.background.slice(1).match(/../g).map(v => parseInt(v, 16)).join(', ')})`);
          if (source.rows.includes(original)) {
            near(actual.before / scale, original.before, `${original.id} top padding`);
            near(actual.after / scale, original.after, `${original.id} bottom padding`);
          }
          for (const originalFrame of original.frames) {
            const frame = actual.frames.find(frame => frame.id === originalFrame.id);
            near(frame.w / scale, originalFrame.w, `${frame.id} width`);
            near(frame.h / scale, originalFrame.h, `${frame.id} height`);
            near(frame.y / scale, originalFrame.y, `${frame.id} vertical position`);
            // The native animated source can leave temporary gaps in offscreen slides.
            if (original.id !== 'comp-m0q9sda7' || original.frames.indexOf(originalFrame) < 2) {
              near(frame.x / scale, originalFrame.x, `${frame.id} horizontal position`);
            }
          }
        }
        const cards = await page.locator('.latest-board .photo-frame').evaluateAll(elements => elements.map(e => {
          const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height };
        }));
        for (let i = 0; i < cards.length; i++) {
          near(cards[i].x / scale, 20, `Latest ${i} left margin`);
          near(cards[i].w / scale, 280, `Latest ${i} width`);
          near(cards[i].h / scale, source.latest.heights[i], `Latest ${i} height`);
          if (i) near((cards[i].y - cards[i - 1].y - cards[i - 1].h) / scale, 20, `Latest ${i} gap`);
        }
        const hero = await page.locator('#hero-image').boundingBox();
        near(hero.height / scale, 152, 'Landscape hero height');
        assert.equal(await page.locator('.mobile-standalone:visible').count(), 2);
        const placement = await page.evaluate(() => {
          const box = selector => { const b = document.querySelector(selector).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height }; };
          return {
            mosaic: box('.mosaic .layout-board'), firstBanner: box('.spreads .mobile-standalone'),
            spreads: box('.spreads .layout-board'), secondBanner: box('.mixed .mobile-standalone'),
            mixed: box('.mixed .layout-board')
          };
        });
        near((placement.firstBanner.top - placement.mosaic.bottom) / scale, 7, 'Gap before Elvina cover');
        near((placement.spreads.top - placement.firstBanner.bottom) / scale, 5, 'Gap after Elvina cover');
        near((placement.secondBanner.top - placement.spreads.bottom) / scale, 29, 'Gap before final cover');
        near((placement.mixed.top - placement.secondBanner.bottom) / scale, 9, 'Gap before mixed gallery');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page must not scroll sideways');
        for (const id of ['fashion-weeks', 'commercial', 'editorials', 'latest-projects', 'about-contact']) {
          await page.locator('#' + id).scrollIntoViewIfNeeded();
        }
        const firstRow = page.locator('.photo-row').first(), viewport = firstRow.locator('.row-viewport');
        if (process.env.QA_ENGINE === 'webkit') {
          // Check keyboard activation in WebKit; pointer activation is covered in Chromium.
          await firstRow.locator('.row-next').focus();
          await page.keyboard.press('Enter');
        } else {
          await firstRow.locator('.row-next').click();
        }
        await page.waitForFunction(() => document.querySelector('.photo-row .row-viewport').scrollLeft > 0);
        assert.ok(await viewport.evaluate(e => e.scrollLeft > 0), 'Next must move the carousel');
        await viewport.focus(); await page.keyboard.press('End');
        await page.waitForFunction(() => document.querySelector('.photo-row .row-next').disabled);
        assert.ok(await firstRow.locator('.row-next').isDisabled(), 'End must reach the final slide');
        await page.keyboard.press('Home');
        await page.waitForFunction(() => document.querySelector('.photo-row .row-viewport').scrollLeft === 0);
        near(await viewport.evaluate(e => e.scrollLeft), 0, 'Home must reset carousel');
        if (process.env.QA_ENGINE === 'webkit') {
          await firstRow.locator('.photo-frame').first().focus();
          await page.keyboard.press('Enter');
        } else {
          await firstRow.locator('.photo-frame').first().click();
        }
        await page.locator('.photo-viewer').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.photo-viewer:visible').count(), 0);
        if (output && width === 390) {
          for (const id of ['fashion-weeks', 'commercial', 'editorials', 'latest-projects', 'about-contact']) {
            await page.locator('#' + id).screenshot({ path: path.join(output, `mobile-${id}.png`) });
          }
        }
      } else {
        assert.equal(await page.locator('.mobile-standalone:visible').count(), 0);
        desktop[width] = geometry;
        if (output) await page.locator('#fashion-weeks').screenshot({ path: path.join(output, `desktop-after-${width}.png`) });
      }
      assert.deepEqual(errors, [], 'No uncaught browser errors');
      console.log(`PASS ${process.env.QA_ENGINE || 'chromium'} ${width}px: source geometry, layout, additions and interactions`);
      await page.close();
    }
    if (output) fs.writeFileSync(path.join(output, 'desktop-after.json'), JSON.stringify(desktop, null, 2));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
