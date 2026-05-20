// If the user pastes a URL, grab the page and reduce it to readable text
// so the Trial Engine reasons about the article, not the raw HTML.
const URL_RE = /^https?:\/\/\S+$/i;

export function looksLikeUrl(input) {
  return URL_RE.test(input.trim());
}

export async function extractFromUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ARGEYE-bot/0.1 (+https://argeye.xyz)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, text: '', title: '' };
    const html = await res.text();

    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

    // crude but dependency-free readable-text extraction
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 6000); // cap tokens

    return { ok: true, text, title };
  } catch {
    return { ok: false, text: '', title: '' };
  }
}
