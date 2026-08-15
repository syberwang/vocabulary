import { ExternalLink } from "lucide-react";
import { dictionaryLookupTerm, frdicUrl } from "@/lib/dictionary";

export function DictionaryLink({ word }: { word: string }) {
  const term = dictionaryLookupTerm(word);
  const href = frdicUrl(word);

  if (!term || !href) return null;

  return (
    <a
      className="audio-button dictionary-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`在法语助手查询 ${term}`}
    >
      <ExternalLink size={16} /> 法语助手
    </a>
  );
}
