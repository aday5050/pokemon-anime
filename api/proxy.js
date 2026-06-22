export default async function handler(req, res) {
  // Manejar OPTIONS de CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    return res.status(200).end();
  }

  // Extraemos la ruta desde el parámetro ?path= que nos envía vercel.json
  const path = req.query.path;
  
  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  const targetUrl = `https://pkproject.net/${path}`;

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
