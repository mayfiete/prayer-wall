// Supported translation identifiers
export type BibleTranslation = "ESV" | "NIV";

// Resolves a human-readable translation to the provider-specific Bible ID.
// API.Bible IDs: ESV = de4e12af7f28f599-02, NIV = 06125adad2d5898a-01
// YouVersion IDs: NIV = 111 (ESV not available on YouVersion public API)
export function resolveBibleId(translation: BibleTranslation, provider: "api.bible" | "youversion"): string {
  if (provider === "youversion") {
    return "111"; // YouVersion only supports NIV in public tier
  }
  // API.Bible
  if (translation === "ESV") return "de4e12af7f28f599-02";
  if (translation === "NIV") return "06125adad2d5898a-01";
  return "de4e12af7f28f599-02"; // fallback to ESV
}

export interface PassageReference {
  reference: string;
  bookUsfm: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
}

export interface RankedPassage {
  passage: PassageReference;
  score: number;
  matchedThemes: string[];
}

export interface BiblePassageText {
  reference: string;
  translation: string;
  provider: string;
  text: string;
  copyright: string | null;
}

export interface BibleSearchResult {
  reference: string;
  text: string;   // snippet / verse text from the search hit
  copyright: string | null;
  translation: string;
  provider: string;
}
