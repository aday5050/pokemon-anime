export default async function handler(req, res) {
  // Manejar OPTIONS de CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    return res.status(200).end();
  }

  // Extraemos la ruta ignorando el prefijo /api/proxy
  // ej: req.url = "/api/proxy/descargas/stream/..."
  const path = req.url.replace(/^\/api\/proxy/, '');
  const targetUrl = `https://pkproject.net${path}`;
  
  if (!path || path === '/') {
    return res.status(400).json({ error: 'Missing path' });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Referer': 'https://pkproject.net/',
        'Origin': 'https://pkproject.net',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send(response.statusText);
    }

    // Reescribimos los headers CORS para que nuestra web pueda leer el video
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    // Copiamos los headers importantes de la respuesta original
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Devolvemos el buffer
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', details: error.message });
  }
}
