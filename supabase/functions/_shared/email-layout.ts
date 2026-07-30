// ─── HCA Prayer Foundation — shared email branding & layout ──────────────────
// Central source of truth for the look, tone, and reusable copy of every email
// the Prayer Foundation sends (reminders, confirmations, prayer guides).
// Mirrors the HCA Fredericksburg "Prayer Supporters" mailer.

export const BRAND = {
  org: "HCA",
  orgFull: "HCA Fredericksburg",
  product: "Prayer Foundation",
  eyebrow: "HCA Fredericksburg · Prayer Foundation",
  fromName: "HCA Prayer Foundation",
};

// Palette — warm, editorial, church-appropriate.
export const COLORS = {
  headerBg: "#9a3412",
  headerEyebrow: "#fca5a5",
  ink: "#1c1917",
  body: "#44403c",
  requestBg: "#fdf8f5",
  requestBorder: "#9a3412",
  requestLabel: "#9a3412",
  praiseBg: "#f0fdf4",
  praiseBorder: "#16a34a",
  praiseLabel: "#166534",
  passageBg: "#f0f9ff",
  passageBorder: "#0369a1",
  passageInk: "#1e3a5f",
  passageMeta: "#64748b",
  footer: "#a8a29e",
  divider: "#e7e5e4",
};

// The opening thank-you line that sits above the greeting.
export const THANK_YOU_LEAD =
  "Thank you for supporting HCA through your commitment to pray!";

// Psalm 127:1 dependence-on-God intro, verbatim from the HCA mailer.
export const PSALM_INTRO_HTML = `
  At HCA, we know that nothing we do is possible apart from the work of God.
  We are completely dependent upon Him. As <strong>Psalm 127:1</strong> states,
  &ldquo;Unless the Lord builds the house, those who build it labor in vain.&rdquo;
  Prayer teaches us to depend upon Him&mdash;and He uses it powerfully.
  So, thank <em>you</em> for praying for this ministry!`;

// Closing line used across emails.
export const THANK_YOU_CLOSING = "Thank you, again, for your continued support!";

// Static praises from the HCA "Prayer Supporters" mailer.
export const PRAISES: string[] = [
  "Our first school year was extremely successful and FULL of grace!",
  "All of our first-year students (except for one graduating senior) will be returning next year!",
  "We have had many family tours and already have a few new prospective students for next year!",
  "Due to Mercy Hill Community Church\u2019s construction projects, we have two new classrooms!",
  "An anonymous donor volunteered to paint and seal our parking lot for free!",
];

// ─── Reusable HTML fragments ─────────────────────────────────────────────────

export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; color: ${COLORS.body}; line-height: 1.7;">${text}</p>`;
}

export function greeting(name: string): string {
  const who = name?.trim() ? name : "Prayer Foundation Supporter";
  return `<p style="margin: 0 0 16px; font-size: 16px; color: ${COLORS.ink};">Dear ${who},</p>`;
}

export function leadLine(): string {
  return `<p style="margin: 0 0 20px; font-size: 15px; font-weight: bold; color: ${COLORS.requestLabel}; line-height: 1.7;">${THANK_YOU_LEAD}</p>`;
}

// A simple bullet list of the category names the supporter committed to pray for.
export function commitmentList(categoryNames: string[]): string {
  if (categoryNames.length === 0) return "";
  const items = categoryNames
    .map((n) => `<li style="margin: 0 0 4px;">${n}</li>`)
    .join("");
  return `
    <p style="margin: 0 0 8px; font-size: 15px; color: ${COLORS.body}; line-height: 1.7;">
      This is a friendly reminder of your commitment to pray for the following:
    </p>
    <ul style="margin: 0 0 24px; padding-left: 20px; color: ${COLORS.ink}; font-size: 15px; line-height: 1.8; font-weight: bold;">
      ${items}
    </ul>`;
}

// "Prayer Requests" — grouped by category, each request as a bullet.
export function prayerRequestsBlock(
  groups: Array<{ categoryName: string; requests: string[] }>,
): string {
  const filled = groups.filter((g) => g.requests.length > 0);
  if (filled.length === 0) return "";

  const sections = filled
    .map((g) => {
      const bullets = g.requests
        .map((r) => `<li style="margin: 0 0 6px;">${r}</li>`)
        .join("");
      return `
        <div style="margin: 0 0 16px;">
          <p style="margin: 0 0 6px; font-size: 13px; font-weight: bold; color: ${COLORS.requestLabel}; text-transform: uppercase; letter-spacing: 0.05em;">${g.categoryName}</p>
          <ul style="margin: 0; padding-left: 20px; color: ${COLORS.body}; font-size: 15px; line-height: 1.7;">
            ${bullets}
          </ul>
        </div>`;
    })
    .join("");

  return `
    <div style="margin: 24px 0; padding: 20px 24px; background: ${COLORS.requestBg}; border-left: 3px solid ${COLORS.requestBorder}; border-radius: 4px;">
      <p style="margin: 0 0 16px; font-size: 15px; font-weight: bold; color: ${COLORS.ink};">Prayer Requests:</p>
      ${sections}
    </div>`;
}

// Optional free-text personal request block (a supporter's own prayer_request).
export function personalRequestBlock(request: string): string {
  if (!request?.trim()) return "";
  return `
    <div style="margin: 24px 0; padding: 16px 20px; background: ${COLORS.requestBg}; border-left: 3px solid ${COLORS.requestBorder}; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: ${COLORS.requestLabel}; text-transform: uppercase; letter-spacing: 0.05em;">Your Personal Request</p>
      <p style="margin: 0; color: ${COLORS.body}; font-size: 15px; line-height: 1.7;">${request}</p>
    </div>`;
}

// "Praises" — static gratitude section from the HCA mailer.
export function praisesBlock(praises: string[] = PRAISES): string {
  if (praises.length === 0) return "";
  const items = praises
    .map((p) => `<li style="margin: 0 0 6px;">${p}</li>`)
    .join("");
  return `
    <div style="margin: 24px 0; padding: 20px 24px; background: ${COLORS.praiseBg}; border-left: 3px solid ${COLORS.praiseBorder}; border-radius: 4px;">
      <p style="margin: 0 0 12px; font-size: 13px; font-weight: bold; color: ${COLORS.praiseLabel}; text-transform: uppercase; letter-spacing: 0.05em;">Praises</p>
      <ul style="margin: 0; padding-left: 20px; color: ${COLORS.body}; font-size: 15px; line-height: 1.7;">
        ${items}
      </ul>
    </div>`;
}

// Scripture passage block ("A Word for Your Prayers").
export function passageBlock(
  passage: { reference: string; translation: string; text: string; copyright: string | null } | null,
): string {
  if (!passage || !passage.text) return "";
  const meta = passage.copyright
    ? `${passage.reference} &middot; ${passage.copyright}`
    : `${passage.reference} &middot; ${passage.translation}`;
  return `
    <div style="margin: 24px 0 0; padding: 16px 20px; background: ${COLORS.passageBg}; border-left: 3px solid ${COLORS.passageBorder}; border-radius: 4px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: bold; color: #0c4a6e; text-transform: uppercase; letter-spacing: 0.05em;">A Word for Your Prayers</p>
      <p style="margin: 0 0 8px; font-size: 15px; color: ${COLORS.passageInk}; line-height: 1.7; font-style: italic;">${passage.text}</p>
      <p style="margin: 0; font-size: 12px; color: ${COLORS.passageMeta};">&mdash; ${meta}</p>
    </div>`;
}

export function closing(): string {
  return `<p style="margin: 24px 0 0; font-size: 15px; color: ${COLORS.body}; line-height: 1.7;">${THANK_YOU_CLOSING}</p>`;
}

// ─── Outer shell (header + body + footer) ────────────────────────────────────

export function emailShell(opts: {
  title: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  eyebrow?: string;
}): string {
  const eyebrow = opts.eyebrow ?? BRAND.eyebrow;
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f5f5f4;">
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">

        <div style="background: ${COLORS.headerBg}; padding: 28px 32px;">
          <p style="margin:0; font-size: 12px; color: ${COLORS.headerEyebrow}; text-transform: uppercase; letter-spacing: 0.1em;">${eyebrow}</p>
          <h1 style="margin: 8px 0 0; font-size: 22px; color: #ffffff; font-weight: normal;">${opts.title}</h1>
        </div>

        <div style="padding: 32px;">
          ${opts.bodyHtml}
        </div>

        <div style="padding: 20px 32px; border-top: 1px solid ${COLORS.divider}; background: #fafaf9;">
          <p style="margin: 0; font-size: 12px; color: ${COLORS.footer}; line-height: 1.6;">
            You're receiving this because you committed to pray with the ${BRAND.org} ${BRAND.product}.
            <a href="${opts.unsubscribeUrl}" style="color: ${COLORS.footer};">Unsubscribe</a>
          </p>
        </div>

      </div>
    </body>
    </html>
  `;
}
