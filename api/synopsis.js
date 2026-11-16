import { parse } from 'parse5';
import pokemonData from '../src/data/pokemon_episodes.json' with { type: 'json' };

const maxBytes = 1024 * 1024;

function normalizeTitle(title) {
  return title
    .replace(/\s*\([^)]*censurad[^)]*\)/gi, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function metadata(html) {
  const document = parse(html);
  const head = document.childNodes?.find(node => node.tagName === 'html')?.childNodes?.find(node => node.tagName === 'head');
  const values = {};
  for (const node of head?.childNodes ?? []) {
    if (node.tagName !== 'meta') continue;
    const attrs = Object.fromEntries(node.attrs.map(({ name, value }) => [name.toLowerCase(), value]));
    const name = (attrs.name || attrs.property || '').toLowerCase();
    if ((name === 'description' || name === 'og:title') && attrs.content) values[name] = attrs.content;
  }
  return values;
}

async function readBounded(response) {
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw new Error('Response too large');
  if (!response.body) throw new Error('Missing response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Response too large');
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { season, episode } = req.query || {};
  if (typeof season !== 'string' || typeof episode !== 'string' || !/^[1-9]\d{0,2}$/.test(season) || !/^[1-9]\d{0,2}$/.test(episode)) {
    return res.status(400).json({ error: 'Episodio no válido' });
  }
  const match = pokemonData.find(item => item.id === Number(season))?.episodes.find(item => item.number === Number(episode));
  if (!match) return res.status(400).json({ error: 'Episodio no válido' });

  const url = `https://pkproject.net/episodios/serie-ash/temporada-${season}/episodio-${episode}`;
  try {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/html')) throw new Error('Upstream unavailable');
    const values = metadata(await readBounded(response));
    const title = values['og:title']?.split(' - ')[0] || '';
    const description = values.description?.trim();
    if (!description || description.length > 2000 || normalizeTitle(title) !== normalizeTitle(match.title)) {
      return res.status(404).json({ error: 'Sinopsis no disponible' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ description, source: { name: 'Pokémon Project', url } });
  } catch {
    return res.status(502).json({ error: 'Sinopsis no disponible' });
  }
}
