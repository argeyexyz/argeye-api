// Claude sometimes wraps JSON in ```json fences or adds a stray sentence.
// This pulls out the first valid JSON object/array and parses it safely.
export function safeJSON(text, fallback = null) {
  if (!text || typeof text !== 'string') return fallback;
  let s = text.trim();

  // strip ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  // try direct parse first
  try { return JSON.parse(s); } catch { /* keep going */ }

  // otherwise grab the outermost {...} or [...]
  const first = s.search(/[{[]/);
  const lastObj = s.lastIndexOf('}');
  const lastArr = s.lastIndexOf(']');
  const last = Math.max(lastObj, lastArr);
  if (first !== -1 && last > first) {
    const slice = s.slice(first, last + 1);
    try { return JSON.parse(slice); } catch { /* fall through */ }
  }
  return fallback;
}

// Pull the concatenated text out of an Anthropic messages response.
export function textOf(msg) {
  if (!msg?.content) return '';
  return msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
