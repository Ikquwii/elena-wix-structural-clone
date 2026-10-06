const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function setup() {
  const timers = new Map();
  let nextTimer = 0;
  const context = { module: { exports: {} }, URL, Date,
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../image-loader.js'), 'utf8'), context);
  const image = new EventTarget();
  image.ownerDocument = { baseURI: 'https://example.com/portfolio/' };
  image.hidden = false;
  let failure = 0;
  context.module.exports(image, 'assets/photo.webp', () => failure++);
  const tick = () => { assert.equal(timers.size, 1, 'one retry must be scheduled'); const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); };
  return { image, timers, tick, failures: () => failure };
}

test('a temporary failure retries the same photograph and can recover', () => {
  const state = setup();
  state.image.dispatchEvent(new Event('error'));
  assert.equal(state.failures(), 0);
  assert.equal(state.timers.size, 1);
  state.tick();
  assert.equal(new URL(state.image.src).pathname, '/portfolio/assets/photo.webp');
  assert.ok(new URL(state.image.src).searchParams.has('retry'));
  state.image.dispatchEvent(new Event('load'));
  assert.equal(state.timers.size, 0);
  assert.equal(state.failures(), 0);
  assert.equal(state.image.hidden, false);
});

test('permanent failure stops retrying and reports it once', () => {
  const state = setup();
  for (let i = 0; i < 2; i++) { state.image.dispatchEvent(new Event('error')); state.tick(); }
  state.image.dispatchEvent(new Event('error'));
  state.image.dispatchEvent(new Event('error'));
  assert.equal(state.timers.size, 0);
  assert.equal(state.failures(), 1);
});

test('a successful load cancels a pending retry', () => {
  const state = setup();
  state.image.dispatchEvent(new Event('error'));
  state.image.dispatchEvent(new Event('load'));
  assert.equal(state.timers.size, 0);
  assert.equal(state.failures(), 0);
});
