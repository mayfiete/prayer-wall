import type { BibleProvider, BiblePassageText } from "./bible-provider.ts";
import type { BibleSearchResult, PassageReference } from "./bible-types.ts";

// Map API.Bible IDs back to human-readable labels for email display
const BIBLE_ID_LABELS: Record<string, string> = {
  "de4e12af7f28f599-02": "ESV",
  "06125adad2d5898a-01": "NIV",
};

function translationLabel(bibleId: string): string {
  return BIBLE_ID_LABELS[bibleId] ?? bibleId;
}

const BASE_URL = "https://api.scripture.api.bible/v1";

export class ApiBibleProvider implements BibleProvider {
  private readonly apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get("API_BIBLE_KEY") ?? "";
  }

  async getPassage(bibleId: string, ref: PassageReference): Promise<BiblePassageText> {
    const passageId = `${ref.bookUsfm}.${ref.chapterStart}.${ref.verseStart}-${ref.bookUsfm}.${ref.chapterEnd}.${ref.verseEnd}`;
    const url = `${BASE_URL}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?content-type=text&include-verse-numbers=false`;

    const res = await fetch(url, {
      headers: { "api-key": this.apiKey, "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`API.Bible ${res.status}: ${await res.text()}`);

    const payload = await res.json() as {
      data?: { reference?: string; content?: string; copyright?: string };
    };
    const data = payload.data ?? {};

    return {
      reference: data.reference ?? ref.reference,
      translation: translationLabel(bibleId),
      provider: "api.bible",
      text: (data.content ?? "").replace(/\s+/g, " ").trim(),
      copyright: data.copyright ?? null,
    };
  }

  async searchPassages(bibleId: string, query: string, limit = 5): Promise<BibleSearchResult[]> {
    const url = `${BASE_URL}/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&limit=${limit}&sort=relevance`;
    const res = await fetch(url, {
      headers: { "api-key": this.apiKey, "Accept": "application/json" },
    });
    if (!res.ok) throw new Error(`API.Bible search ${res.status}: ${await res.text()}`);

    const payload = await res.json() as {
      data?: {
        verses?: Array<{ reference?: string; text?: string }>;
        passages?: Array<{ reference?: string; content?: string }>;
        copyright?: string;
      };
    };

    const hits = payload.data?.verses ?? payload.data?.passages ?? [];
    const copyright = payload.data?.copyright ?? null;

    return (hits as Array<{ reference?: string; text?: string; content?: string }>)
      .slice(0, limit)
      .map((h) => ({
        reference:   h.reference ?? "",
        text:        ((h.text ?? h.content) ?? "").replace(/\s+/g, " ").trim(),
        copyright,
        translation: translationLabel(bibleId),
        provider:    "api.bible",
      }))
      .filter((h) => h.reference && h.text);
  }
}
