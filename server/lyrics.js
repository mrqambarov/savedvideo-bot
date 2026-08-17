const axios = require('axios');

/**
 * High-speed lyrics search engine using LRCLIB open database
 * Supports both international & regional tracks with fallback fuzzy search
 */
async function getLyrics(title, artist = '') {
  try {
    const cleanTitle = (title || '')
      .replace(/\(.*?\)|\/.*|\[.*?\]|ft\..*|feat\..*|official|video|audio|remix|hd|4k/gi, '')
      .trim();
    const cleanArtist = (artist || '').trim();

    // 1. Direct match
    if (cleanTitle && cleanArtist) {
      try {
        const res = await axios.get('https://lrclib.net/api/get', {
          params: {
            track_name: cleanTitle,
            artist_name: cleanArtist
          },
          timeout: 4000
        });
        if (res.data && (res.data.plainLyrics || res.data.syncedLyrics)) {
          return {
            title: res.data.trackName || title,
            artist: res.data.artistName || artist,
            lyrics: res.data.plainLyrics || res.data.syncedLyrics.replace(/\[\d+:\d+\.\d+\]\s*/g, '')
          };
        }
      } catch (_) {}
    }

    // 2. Fuzzy Search
    const query = `${cleanArtist} ${cleanTitle}`.trim() || title;
    try {
      const searchRes = await axios.get('https://lrclib.net/api/search', {
        params: { q: query },
        timeout: 4000
      });
      if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        const item = searchRes.data[0];
        if (item.plainLyrics || item.syncedLyrics) {
          return {
            title: item.trackName || title,
            artist: item.artistName || artist,
            lyrics: item.plainLyrics || item.syncedLyrics.replace(/\[\d+:\d+\.\d+\]\s*/g, '')
          };
        }
      }
    } catch (_) {}

    return null;
  } catch (err) {
    console.error('[Lyrics Engine] Error:', err.message);
    return null;
  }
}

module.exports = { getLyrics };
