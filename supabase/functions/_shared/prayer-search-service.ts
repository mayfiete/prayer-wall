import type { BibleProvider } from "./bible-provider.ts";
import {
  findThemesByTerms,
  findPassagesForThemes,
  getCachedPassage,
  setCachedPassage,
} from "./prayer-search-repo.ts";

export type PassageResult = {
  reference: string;
  translation: string;
  text: string;
  copyright: string | null;
};

function normalizeTerms(input: string): string[] {
  return [...new Set(
    input
      .toLowerCase()
      .split(/[\s,;:/|.!?]+/)
      .map((t) => t.replace(/[^a-z]/g, "").trim())
      .filter((t) => t.length > 2),
  )];
}

function providerName(provider: BibleProvider): string {
  return provider.constructor.name.toLowerCase().replace("provider", "");
}

// ── Tier 1: Curated keyword index → known good passage ───────────────────────

async function findViaIndex(
  terms: string[],
  provider: BibleProvider,
  bibleId: string,
): Promise<PassageResult | null> {
  const themeIds = await findThemesByTerms(terms);
  if (themeIds.length === 0) return null;

  const passages = await findPassagesForThemes(themeIds, 1);
  if (passages.length === 0) return null;

  const top = passages[0];
  const pname = providerName(provider);

  const cached = await getCachedPassage(pname, bibleId, top.reference);
  if (cached) {
    return {
      reference:   top.reference,
      translation: bibleId === "111" ? "NIV" : bibleId,
      text:        cached.text,
      copyright:   cached.copyright,
    };
  }

  const result = await provider.getPassage(bibleId, {
    reference:    top.reference,
    bookUsfm:     top.bookUsfm,
    chapterStart: top.chapterStart,
    verseStart:   top.verseStart,
    chapterEnd:   top.chapterEnd,
    verseEnd:     top.verseEnd,
  });

  await setCachedPassage(pname, bibleId, top.reference, result.text, result.copyright, 360);
  return result;
}

// ── Tier 2: Live API search — handles any free-form keyword ──────────────────

async function findViaSearch(
  terms: string[],
  provider: BibleProvider,
  bibleId: string,
): Promise<PassageResult | null> {
  if (!provider.searchPassages) return null;

  // Try each term individually, shortest first (more specific terms hit better)
  const sorted = [...terms].sort((a, b) => b.length - a.length);

  for (const term of sorted) {
    try {
      const results = await provider.searchPassages(bibleId, term, 3);
      if (results.length === 0) continue;

      // Pick the first result with actual text content
      const hit = results.find((r) => r.text.length > 10);
      if (!hit) continue;

      const pname = providerName(provider);
      await setCachedPassage(pname, bibleId, hit.reference, hit.text, hit.copyright, 360);

      return {
        reference:   hit.reference,
        translation: hit.translation,
        text:        hit.text,
        copyright:   hit.copyright,
      };
    } catch (err) {
      console.warn(`Live search failed for term "${term}":`, err);
    }
  }

  return null;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function findPassageForText(
  text: string,
  provider: BibleProvider,
  bibleId = "111",
): Promise<PassageResult | null> {
  const terms = normalizeTerms(text);
  if (terms.length === 0) return null;

  // Tier 1: keyword index (fast, curated, zero extra API calls)
  try {
    const indexed = await findViaIndex(terms, provider, bibleId);
    if (indexed) return indexed;
  } catch (err) {
    console.warn("Keyword index lookup failed:", err);
  }

  // Tier 2: live API search (handles any keyword — loneliness, addiction, etc.)
  try {
    const live = await findViaSearch(terms, provider, bibleId);
    if (live) return live;
  } catch (err) {
    console.warn("Live Bible search failed:", err);
  }

  // Tier 3: graceful degradation — email sends without a passage
  return null;
}
