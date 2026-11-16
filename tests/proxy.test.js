import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { Buffer } from 'node:buffer';
import handler from '../api/proxy.js';

class MockResponse extends Writable {
  constructor() {
    super();
    this.headers = {};
    this.statusCode = 200;
    this.chunks = [];
  }
  _write(chunk, encoding, callback) { this.chunks.push(Buffer.from(chunk)); callback(); }
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; }
  status(code) { this.statusCode = code; return this; }
  send(body) { this.end(body); return this; }
  json(body) { this.end(JSON.stringify(body)); return this; }
}

const validPath = 'descargas/stream/serie-ash/t01/e01/video/t01_e010.ts';

test('relays a byte-range request and preserves the upstream partial response', async () => {
  const originalFetch = globalThis.fetch;
  let requestOptions;
  globalThis.fetch = async (_url, options) => {
    requestOptions = options;
    return new Response('hello', { status: 206, headers: {
      'content-type': 'video/mp2t', 'content-length': '5',
      'content-range': 'bytes 0-4/20', 'accept-ranges': 'bytes'
    } });
  };
  try {
    const res = new MockResponse();
    await handler({ method: 'GET', query: { path: validPath }, headers: { range: 'bytes=0-4' } }, res);
    assert.equal(requestOptions.headers.Range, 'bytes=0-4');
    assert.equal(res.statusCode, 206);
    assert.equal(res.headers['content-range'], 'bytes 0-4/20');
    assert.equal(res.headers['accept-ranges'], 'bytes');
    assert.equal(Buffer.concat(res.chunks).toString(), 'hello');
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects paths outside the episode media directory without fetching', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error('unexpected fetch'); };
  try {
    const res = new MockResponse();
    await handler({ method: 'GET', query: { path: '../private' }, headers: {} }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('returns the upstream unsatisfied-range status and range metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 416, headers: { 'content-range': 'bytes */20' } });
  try {
    const res = new MockResponse();
    await handler({ method: 'GET', query: { path: validPath }, headers: { range: 'bytes=20-' } }, res);
    assert.equal(res.statusCode, 416);
    assert.equal(res.headers['content-range'], 'bytes */20');
  } finally { globalThis.fetch = originalFetch; }
});

test('does not disclose upstream connection errors', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('sensitive upstream detail'); };
  try {
    const res = new MockResponse();
    await handler({ method: 'GET', query: { path: validPath }, headers: {} }, res);
    assert.equal(res.statusCode, 502);
    assert.doesNotMatch(Buffer.concat(res.chunks).toString(), /sensitive upstream detail/);
  } finally { globalThis.fetch = originalFetch; }
});



