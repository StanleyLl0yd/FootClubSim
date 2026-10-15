const MAX_RESPONSE_BYTES = 4_000_000;

/** Bound decoded response bytes while reading, including chunked/compressed bodies. */
export async function readWikidataJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing Wikidata response body');
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
      throw new Error('Wikidata response exceeds 4MB');
    }
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new Error('Wikidata response exceeds 4MB');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
