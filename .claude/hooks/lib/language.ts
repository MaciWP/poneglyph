// Stopword counts that separate es-ES prose from English prose. Shared by the eval grader
// (`esEsDetect`) and the mid-turn reminder (`turn-nudges.ts`), so both judge the same way.
const ES_STOPWORDS = new Set(["el", "la", "los", "las", "de", "del", "que", "porque", "una", "con", "para", "está", "es", "en", "no", "se", "por", "como", "más", "pero", "desde", "así", "queda", "falta", "añadir"]);
const EN_STOPWORDS = new Set(["the", "of", "and", "to", "is", "that", "it", "for", "with", "from", "does", "not", "because", "this", "are", "was", "be", "have"]);

/** Code is stripped by the caller; returns the stopword hits of each language. */
export function stopwordCounts(prose: string): { es: number; en: number; words: number } {
  const words = prose.toLowerCase().split(/[^\p{L}áéíóúüñ]+/u).filter(Boolean);
  return {
    es: words.filter((w) => ES_STOPWORDS.has(w)).length,
    en: words.filter((w) => EN_STOPWORDS.has(w)).length,
    words: words.length,
  };
}

// Case- and accent-insensitive form of a prompt or pattern: the user often types
// without accents ("estas seguro"), and patterns are written with them.
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
