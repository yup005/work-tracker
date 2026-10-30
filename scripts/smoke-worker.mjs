/**
 * Exercise the generated Worker entrypoint without a real D1 database.
 * Run after `node scripts/build.mjs`.
 */
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';

const base = 'https://work-tracker.example';

async function checkStaticAsset(path, contentType) {
  const response = await worker.fetch(new Request(base + path), {});
  assert.equal(response.status, 200, path + ' should load');
  assert.match(response.headers.get('content-type') || '', contentType);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok((await response.text()).length > 0, path + ' should have content');
}

await checkStaticAsset('/', /text\/html/);
await checkStaticAsset('/app.js', /application\/javascript/);
await checkStaticAsset('/language.js', /application\/javascript/);
await checkStaticAsset('/styles.css', /text\/css/);
await checkStaticAsset('/favicon.svg', /image\/svg\+xml/);

const missing = await worker.fetch(new Request(base + '/nonexistent.txt'), {});
assert.equal(missing.status, 404);
assert.equal(await missing.text(), 'Not found');

console.log('Generated Worker smoke test passed: assets and 404 response');
