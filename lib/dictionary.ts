const FRDIC_BASE_URL = "https://www.frdic.com/dicts/fr/";

export function dictionaryLookupTerm(word: string): string | null {
  const term = word
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return term || null;
}

export function frdicUrl(word: string): string | null {
  const term = dictionaryLookupTerm(word);
  return term ? `${FRDIC_BASE_URL}${encodeURIComponent(term)}` : null;
}
