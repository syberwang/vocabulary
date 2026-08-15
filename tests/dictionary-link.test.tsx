// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DictionaryLink } from "@/components/dictionary-link";

afterEach(cleanup);

describe("DictionaryLink", () => {
  it("renders a secure external link with the normalized lookup term", () => {
    render(<DictionaryLink word="cultiver(se)" />);

    const link = screen.getByRole("link", { name: "在法语助手查询 cultiver" });
    expect(link).toHaveAttribute("href", "https://www.frdic.com/dicts/fr/cultiver");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render when the lookup term is empty", () => {
    const { container } = render(<DictionaryLink word="(se)" />);
    expect(container).toBeEmptyDOMElement();
  });
});
