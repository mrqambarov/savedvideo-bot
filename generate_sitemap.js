const fs = require('fs');
const path = require('path');

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemapXml() {
  const moviesPath = path.join(__dirname, 'movie-server', 'data', 'movies.json');
  let movies = [];
  try {
    movies = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));
  } catch (e) {
    console.error('Error reading movies:', e.message);
  }

  const genres = ['Jangari', 'Komediya', 'Melodrama', 'Multfilm', 'Tarixiy', 'Tarjima kino', 'Sarguzasht', 'Fantastika', 'Drama', 'Qo\'rqinchli'];
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">

  <!-- Asosiy Sahifa -->
  <url>
    <loc>https://xitfilm.uz/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/shorts.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.95</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/creators.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>

  <!-- Axborot Sahifalari -->
  <url>
    <loc>https://xitfilm.uz/profile.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/about.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/help.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/terms.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://xitfilm.uz/privacy.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
`;

  // Janrlar
  genres.forEach(g => {
    xml += `
  <url>
    <loc>https://xitfilm.uz/?genre=${encodeURIComponent(g)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.85</priority>
  </url>`;
  });

  // Har bir film sahifasi
  movies.forEach(m => {
    const code = String(m.code || '').trim();
    const title = escapeXml(m.title || `Kino #${code}`);
    const desc = escapeXml((m.description || '').substring(0, 200));
    const poster = escapeXml(m.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800');
    const dateAdded = m.dateAdded ? m.dateAdded.split('T')[0] : today;

    xml += `
  <url>
    <loc>https://xitfilm.uz/?code=${code}</loc>
    <lastmod>${dateAdded}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <image:image>
      <image:loc>${poster}</image:loc>
      <image:title>${title}</image:title>
      <image:caption>${desc}</image:caption>
    </image:image>
  </url>`;
  });

  xml += `
</urlset>`;

  const outPath = path.join(__dirname, 'public-site', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`Generated sitemap.xml with ${movies.length} movies at ${outPath}`);
  return xml;
}

generateSitemapXml();
module.exports = { generateSitemapXml };
