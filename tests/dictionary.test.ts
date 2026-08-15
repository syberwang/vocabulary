import { describe, expect, it } from "vitest";
import { dictionaryLookupTerm, frdicUrl } from "@/lib/dictionary";

describe("French dictionary links", () => {
  it("builds an encoded Frdic URL for accented words", () => {
    expect(frdicUrl("entraîneuse")).toBe("https://www.frdic.com/dicts/fr/entra%C3%AEneuse");
  });

  it("removes parenthetical annotations and normalizes whitespace", () => {
    expect(dictionaryLookupTerm("cultiver(se)")).toBe("cultiver");
    expect(dictionaryLookupTerm("professionnel(le)")).toBe("professionnel");
    expect(dictionaryLookupTerm("  CV   (curriculum vitæ) ")).toBe("CV");
    expect(dictionaryLookupTerm("tomber amoureux(se)  (de)")).toBe("tomber amoureux");
    expect(frdicUrl("tomber amoureux(se)  (de)")).toBe("https://www.frdic.com/dicts/fr/tomber%20amoureux");
  });

  it("preserves non-parenthetical grammar and returns null for an empty result", () => {
    expect(dictionaryLookupTerm("manteau / manteaux")).toBe("manteau / manteaux");
    expect(frdicUrl("manteau / manteaux")).toBe("https://www.frdic.com/dicts/fr/manteau%20%2F%20manteaux");
    expect(dictionaryLookupTerm(" (se) ")).toBeNull();
    expect(frdicUrl(" (se) ")).toBeNull();
  });
});
