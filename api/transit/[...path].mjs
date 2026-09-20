// Vercel routes /api/transit/* here, and hands a Node request and response, not the Web pair.
// handleTransit — the same function the Cloudflare worker and the local dev server call — speaks
// Request and Response, so this converts between them the way server/dev-api.mjs already does.
//
// Passing the Node object straight through crashed the function on every call: req.url is a path,
// and the URL constructor needs an absolute one.
import {handleTransit} from '../../server/transit.mjs';

export const config = {runtime: 'nodejs'};

const BODY_LIMIT = 4096;

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString();
}

export default async function handler(req, res) {
  try {
    const origin = `https://${req.headers.host ?? 'localhost'}`;
    let body;
    if (req.method === 'POST') {
      body = await readBody(req);
      if (body === null) {
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({code: 'INVALID_REQUEST', error: '요청이 너무 커요.'}));
        return;
      }
    }
    const response = await handleTransit(
      new Request(origin + req.url, {method: req.method, headers: req.headers, ...(body === undefined ? {} : {body})}),
      process.env,
    );
    res.statusCode = response.status;
    for (const [name, value] of response.headers) res.setHeader(name, value);
    res.end(await response.text());
  } catch (error) {
    // A crash here would otherwise surface as Vercel's own 500 with nothing to read.
    console.error('[transit] handler failed', error);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({code: 'UNAVAILABLE', error: '교통 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'}));
  }
}
