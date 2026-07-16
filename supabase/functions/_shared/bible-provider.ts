import type { BiblePassageText, BibleSearchResult, PassageReference } from "./bible-types.ts";

export interface BibleProvider {
  getPassage(bibleId: string, reference: PassageReference): Promise<BiblePassageText>;
  searchPassages?(bibleId: string, query: string, limit?: number): Promise<BibleSearchResult[]>;
}
