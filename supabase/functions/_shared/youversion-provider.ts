import type { BibleProvider, BiblePassageText } from "./bible-provider.ts";
import type { BibleSearchResult, PassageReference } from "./bible-types.ts";

const BASE_URL = "https://api.youversion.com/v1";

export class YouVersionProvider implements BibleProvider {
  private readonly appKey: string;

  constructor() {
    this.appKey = Deno.env.get("YOUVERSION_APP_KEY") ?? "";
  }

  private headers(): Record<string, string> {
    return { "X-YVP-App-Key": this.appKey, "Accept": "application/json" };
  }

  async getPassage(bibleId: string, ref: PassageReference): Promise<BiblePassageText> {
    const url =
      `${BASE_URL}/bibles/${encodeURIComponent(bibleId)}/books/` +
      `${encodeURIComponent(ref.bookUsfm)}/chapters/${ref.chapterStart}/verses`;

    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`YouVersion ${res.status}: ${await res.text()}`);

    const payload = await res.json() as {
      data?: Array<{ verse?: number; content?: string }>;
      meta?: { copyright?: string };
    };

    const verses = (payload.data ?? [])
      .filter((v) => {
        const n = Number(v.verse);
        return n >= ref.verseStart && n <= ref.verseEnd;
      })
      .map((v) => (v.content ?? "").trim())
      .filter(Boolean);

    return {
      reference: ref.reference,
      translation: bibleId === "111" ? "NIV" : bibleId,
      provider: "youversion",
      text: verses.join(" "),
      copyright: payload.meta?.copyright ?? null,
    };
  }

  async searchPassages(bibleId: string, query: string, limit = 5): Promise<BibleSearchResult[]> {
    const url = `${BASE_URL}/bibles/${encodeURIComponent(bibleId)}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`YouVersion search ${res.status}: ${await res.text()}`);

    const payload = await res.json() as {
      data?: Array<{ reference?: string; content?: string; verse_text?: string }>;
      meta?: { copyright?: string };
    };

    const copyright = payload.meta?.copyright ?? null;
    const translation = bibleId === "111" ? "NIV" : bibleId;

    return (payload.data ?? [])
      .slice(0, limit)
      .map((h) => ({
        reference:   h.reference ?? "",
        text:        ((h.verse_text ?? h.content) ?? "").trim(),
        copyright,
        translation,
        provider: "youversion",
      }))
      .filter((h) => h.reference && h.text);
  }
}
