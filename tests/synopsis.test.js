import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/synopsis.js';

function response() {
  return {
    headers: {},
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

test('returns decoded description and attribution for a matching episode', async () => {
  const originalFetch = globalThis.fetch;
  let options;
  globalThis.fetch = async (url, opts) => {
    assert.equal(url, 'https://pkproject.net/episodios/serie-ash/temporada-1/episodio-1');
    options = opts;
    return new Response('<head><meta content="¡Pokémon, te elijo a ti! - Temporada" property="og:title"><meta content="Ash &amp; Pikachu" name="description"></head>', { headers: { 'content-type': 'text/html' } });
  };
  try {
    const res = response();
    await handler({ method: 'GET', query: { season: '1', episode: '1' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.description, 'Ash & Pikachu');
    assert.equal(res.body.source.name, 'Pokémon Project');
    assert.equal(res.body.source.url, 'https://pkproject.net/episodios/serie-ash/temporada-1/episodio-1');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Referer, 'https://pkproject.net/');
    assert.equal(options.headers.Origin, 'https://pkproject.net');
    assert.match(options.headers['User-Agent'], /Mozilla/);
    assert.match(res.headers['cache-control'], /s-maxage/);
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects unknown episodes before making a request', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('must not fetch'); };
  try {
    for (const query of [{ season: '1', episode: '999' }, { season: '../1', episode: '1' }, { season: '1', episode: ['1', '2'] }]) {
      const res = response();
      await handler({ method: 'GET', query }, res);
      assert.equal(res.statusCode, 400);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('does not attribute a description to an episode with a different title', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<head><meta property="og:title" content="Another episode - Season"><meta name="description" content="Wrong episode"></head>', { headers: { 'content-type': 'text/html' } });
  try {
    const res = response();
    await handler({ method: 'GET', query: { season: '1', episode: '1' } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.description, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test('does not expose upstream errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('sensitive upstream detail'); };
  try {
    const res = response();
    await handler({ method: 'GET', query: { season: '1', episode: '1' } }, res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(JSON.stringify(res.body), /sensitive upstream detail/);
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects an oversized upstream response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('large', { headers: { 'content-type': 'text/html', 'content-length': '1048577' } });
  try {
    const res = response();
    await handler({ method: 'GET', query: { season: '1', episode: '1' } }, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.description, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
