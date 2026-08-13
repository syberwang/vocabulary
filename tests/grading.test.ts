import { describe, expect, it } from "vitest";
import { gradeFrenchAnswer, normalizeFrench } from "@/lib/grading";

describe("French spelling grading", () => {
  it("normalizes case, whitespace and apostrophe variants", () => {
    expect(normalizeFrench("  S’APPELER  ")).toBe("s'appeler");
    expect(gradeFrenchAnswer("S’APPELER", ["s'appeler"]).rating).toBe("good");
  });

  it("marks accent and hyphen omissions as hard", () => {
    expect(gradeFrenchAnswer("ecole", ["école"]).rating).toBe("hard");
    expect(gradeFrenchAnswer("grand mere", ["grand-mère"]).rating).toBe("hard");
  });

  it("accepts explicit variants and rejects unrelated answers", () => {
    expect(gradeFrenchAnswer("appeler", ["appeler", "s'appeler"]).rating).toBe("good");
    expect(gradeFrenchAnswer("bonjour", ["bienvenue"]).rating).toBe("again");
  });
});
