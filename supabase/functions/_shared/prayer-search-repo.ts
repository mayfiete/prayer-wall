import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { db: { schema: "prayer_wall" } },
);

export async function findThemesByTerms(terms: string[]): Promise<string[]> {
  const normalized = terms.map((t) => t.toLowerCase().trim()).filter(Boolean);
  if (normalized.length === 0) return [];

  const { data } = await supabase
    .from("prayer_keywords")
    .select("theme_id")
    .in("normalized_keyword", normalized);

  return [...new Set((data ?? []).map((r: { theme_id: string }) => r.theme_id))];
}

interface PassageRow {
  id: string;
  reference: string;
  book_usfm: string;
  chapter_start: number;
  verse_start: number;
  chapter_end: number;
  verse_end: number;
  canonical_weight: number;
  is_active: boolean;
}

interface PassageThemeLink {
  passage_id: string;
  relevance_weight: number;
  prayer_passages: PassageRow | null;
}

export interface ScoredPassage {
  reference: string;
  bookUsfm: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
  score: number;
}

export async function findPassagesForThemes(
  themeIds: string[],
  limit = 5,
): Promise<ScoredPassage[]> {
  if (themeIds.length === 0) return [];

  const { data: links } = await supabase
    .from("prayer_passage_themes")
    .select(
      "passage_id, relevance_weight, prayer_passages(id, reference, book_usfm, chapter_start, verse_start, chapter_end, verse_end, canonical_weight, is_active)",
    )
    .in("theme_id", themeIds);

  const scoreMap = new Map<string, { passage: PassageRow; score: number }>();

  for (const link of (links ?? []) as PassageThemeLink[]) {
    const p = link.prayer_passages;
    if (!p || !p.is_active) continue;
    const prev = scoreMap.get(p.id);
    const score = link.relevance_weight * p.canonical_weight;
    scoreMap.set(p.id, { passage: p, score: (prev?.score ?? 0) + score });
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ passage: p, score }) => ({
      reference:    p.reference,
      bookUsfm:     p.book_usfm,
      chapterStart: p.chapter_start,
      verseStart:   p.verse_start,
      chapterEnd:   p.chapter_end,
      verseEnd:     p.verse_end,
      score,
    }));
}

// ── Cache helpers ─────────────────────────────────────────────

export async function getCachedPassage(
  provider: string,
  bibleId: string,
  reference: string,
): Promise<{ text: string; copyright: string | null } | null> {
  const { data } = await supabase
    .from("bible_api_cache")
    .select("response_json, expires_at")
    .eq("provider", provider)
    .eq("bible_id", bibleId)
    .eq("reference", reference)
    .single();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const json = data.response_json as { text?: string; copyright?: string | null };
  return { text: json.text ?? "", copyright: json.copyright ?? null };
}

export async function setCachedPassage(
  provider: string,
  bibleId: string,
  reference: string,
  text: string,
  copyright: string | null,
  ttlMinutes = 360,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  await supabase
    .from("bible_api_cache")
    .upsert(
      { provider, bible_id: bibleId, reference, response_json: { text, copyright }, expires_at: expiresAt },
      { onConflict: "provider,bible_id,reference" },
    );
}
