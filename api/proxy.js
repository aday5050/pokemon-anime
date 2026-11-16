import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const mediaRoot = /^descargas\/stream\/serie-ash\/t\d+\/e\d+\//;
const mediaExtension = /\.(?:m3u8|ts|m4s|mp4|key)$/i;

function validMediaPath(path) {
  return typeof path === 'string' && path.length <= 1024 &&
    mediaRoot.test(path) && mediaExtension.test(path) &&
    path.split('/').every((part) => part !== '.' && part !== '..' && /^[a-zA-Z0-9_.-]+$/.test(part));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const path = req.query.path;
  if (!validMediaPath(path)) return res.status(400).json({ error: 'Invalid media path' });

  const range = req.headers?.range;
  if (range !== undefined && (typeof range !== 'string' || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) {
    return res.status(400).json({ error: 'Invalid range' });
  }

  try {
    const headers = {
      Referer: 'https://pkproject.net/',
      Origin: 'https://pkproject.net',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept-Encoding': 'identity',
    };
    if (range) headers.Range = range;

    const response = await fetch(`https://pkproject.net/${path}`, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const contentRange = response.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      return res.status(response.status).json({ error: 'Media unavailable' });
    }

    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified']) {
      const value = response.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.status(response.status);
    if (!response.body) return res.end();
    await pipeline(Readable.fromWeb(response.body), res);
  } catch {
    if (!res.headersSent && !res.destroyed) {
      return res.status(502).json({ error: 'Media proxy unavailable' });
    }
    if (!res.destroyed) res.destroy();
  }
}
