// Vercel hands a Node request and response; handleTransit speaks the Web pair. Passing one straight
// through crashed every call in production and nowhere else, because nothing local exercises the
// Vercel entry point. This runs it through a real http server, which is the shape it actually gets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import handler from '../api/transit/[...path].mjs';

const withServer = async (run) => {
  const server = createServer((req, res) => handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    return await run(base);
  } finally {
    server.close();
  }
};

test('a GET is answered rather than crashing the function', async () => {
  process.env.ODSAY_API_KEY = 'test-key';
  const result = await withServer(async (base) => {
    const response = await fetch(base + '/api/transit/status');
    return {status: response.status, body: await response.json()};
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.configured, true);
});

test('a POST body reaches the handler', async () => {
  process.env.ODSAY_API_KEY = 'test-key';
  const result = await withServer(async (base) => {
    const response = await fetch(base + '/api/transit/routes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({from: [126.9, 37.5], to: [127.38, 36.35], mode: 'all'}),
    });
    return {status: response.status, body: await response.json()};
  });
  // Seoul is outside Daejeon, so the validator rejects it — which proves the body was parsed.
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'INVALID_REQUEST');
});

test('an oversized body is refused before it is parsed', async () => {
  const result = await withServer(async (base) => {
    const response = await fetch(base + '/api/transit/routes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({padding: 'x'.repeat(8000)}),
    });
    return response.status;
  });
  assert.equal(result, 413);
});

test('the entry point converts rather than forwarding the Node object', () => {
  // The crash was one line: handleTransit(request) with Vercel's req, whose url is a path.
  const source = readFileSync(new URL('../api/transit/[...path].mjs', import.meta.url), 'utf8');
  assert.match(source, /new Request\(/, 'a Web Request has to be built');
  assert.match(source, /req\.headers\.host/, 'and it needs an absolute origin');
  assert.match(source, /res\.statusCode\s*=/, 'the Response has to be written back');
});
