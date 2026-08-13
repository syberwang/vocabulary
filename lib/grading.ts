import type { RatingValue } from "@/lib/types";

export function normalizeFrench(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ");
}

function looseFrench(value: string) {
  return normalizeFrench(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-'\s]/g, "");
}

function levenshtein(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const upper = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = upper;
    }
  }
  return previous[b.length];
}

export interface GradeResult {
  rating: Extract<RatingValue, "again" | "hard" | "good">;
  matchedAnswer?: string;
  reason: "exact" | "near" | "wrong" | "empty";
}

export function gradeFrenchAnswer(answer: string, acceptedAnswers: string[]): GradeResult {
  const normalized = normalizeFrench(answer);
  if (!normalized) return { rating: "again", reason: "empty" };
  const accepted = acceptedAnswers.map(normalizeFrench);
  const exactIndex = accepted.indexOf(normalized);
  if (exactIndex >= 0) {
    return { rating: "good", matchedAnswer: acceptedAnswers[exactIndex], reason: "exact" };
  }

  const loose = looseFrench(normalized);
  const nearIndex = accepted.findIndex((candidate) => {
    const normalizedCandidate = looseFrench(candidate);
    return normalizedCandidate === loose || levenshtein(normalized, candidate) <= 1;
  });
  if (nearIndex >= 0) {
    return { rating: "hard", matchedAnswer: acceptedAnswers[nearIndex], reason: "near" };
  }
  return { rating: "again", reason: "wrong" };
}
