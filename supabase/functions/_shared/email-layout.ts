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
  logoUrl: "https://swrcawckpsotialqnisq.supabase.co/storage/v1/object/public/email-assets/hca-logo.png",
  logoAlt: "Heritage Christian Academy",
};

// Palette — warm, editorial, church-appropriate.
export const COLORS = {
  headerBg: "#242149",
  headerEyebrow: "#ffffff",
  logoBg: "#60051d",
  background: "#f4f4f4",
  ink: "#000000",
  body: "#222222",
  requestBg: "#ffffff",
  requestBorder: "#242149",
  requestLabel: "#60051d",
  praiseBg: "#ffffff",
  praiseBorder: "#242149",
  praiseLabel: "#60051d",
  passageBg: "#f4f4f4",
  passageBorder: "#242149",
  passageInk: "#242149",
  passageMeta: "#595959",
  footer: "#595959",
  divider: "#242149",
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

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">${text}</p>`;
}

export function greeting(name: string): string {
  const who = name?.trim() ? name : "Prayer Foundation Supporter";
  return `<p style="margin: 0 0 16px; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">Dear ${escapeHtml(who)},</p>`;
}

export function leadLine(): string {
  return `<p style="margin: 0 0 24px; font-size: 20px; text-align: center; color: ${COLORS.headerBg}; line-height: 1.5;">${THANK_YOU_LEAD}</p>`;
}

// A simple bullet list of the category names the supporter committed to pray for.
export function commitmentList(categoryNames: string[]): string {
  if (categoryNames.length === 0) return "";
  const items = categoryNames
    .map((n) => `<li style="margin: 0 0 4px;">${escapeHtml(n)}</li>`)
    .join("");
  return `
    <p style="margin: 0 0 8px; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">
      This is a friendly reminder of your commitment to pray for the following:
    </p>
    <ul style="margin: 0 0 24px; padding-left: 24px; color: ${COLORS.ink}; font-size: 16px; line-height: 1.5; font-weight: bold;">
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
        .map((r) => `<li style="margin: 0 0 8px;">${escapeHtml(r)}</li>`)
        .join("");
      return `
        <div style="margin: 0 0 16px;">
          <p style="margin: 0 0 8px; font-size: 16px; font-weight: bold; color: ${COLORS.requestLabel}; line-height: 1.5;">${escapeHtml(g.categoryName)}</p>
          <ul style="margin: 0; padding-left: 24px; color: ${COLORS.body}; font-size: 16px; line-height: 1.5;">
            ${bullets}
          </ul>
        </div>`;
    })
    .join("");

  return `
    <div style="margin: 24px 0; padding: 24px 0 0; background: ${COLORS.requestBg}; border-top: 2px solid ${COLORS.requestBorder};">
      <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: bold; color: ${COLORS.ink}; line-height: 1.5;">Prayer Requests:</h2>
      ${sections}
    </div>`;
}

// Optional free-text personal request block (a supporter's own prayer_request).
export function personalRequestBlock(request: string): string {
  if (!request?.trim()) return "";
  return `
    <div style="margin: 24px 0; padding: 24px 0 0; background: ${COLORS.requestBg}; border-top: 2px solid ${COLORS.requestBorder};">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: bold; color: ${COLORS.requestLabel}; line-height: 1.5;">Your Personal Request</h2>
      <p style="margin: 0; color: ${COLORS.body}; font-size: 16px; line-height: 1.5;">${escapeHtml(request)}</p>
    </div>`;
}

// "Praises" — static gratitude section from the HCA mailer.
export function praisesBlock(praises: string[] = PRAISES): string {
  if (praises.length === 0) return "";
  const items = praises
    .map((p) => `<li style="margin: 0 0 8px;">${escapeHtml(p)}</li>`)
    .join("");
  return `
    <div style="margin: 24px 0; padding: 24px 0 0; background: ${COLORS.praiseBg}; border-top: 2px solid ${COLORS.praiseBorder};">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: bold; color: ${COLORS.praiseLabel}; line-height: 1.5;">Praises</h2>
      <ul style="margin: 0; padding-left: 24px; color: ${COLORS.body}; font-size: 16px; line-height: 1.5;">
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
    ? `${escapeHtml(passage.reference)} &middot; ${escapeHtml(passage.copyright)}`
    : `${escapeHtml(passage.reference)} &middot; ${escapeHtml(passage.translation)}`;
  return `
    <div style="margin: 24px 0 0; padding: 16px 20px; background: ${COLORS.passageBg}; border-left: 3px solid ${COLORS.passageBorder};">
      <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: bold; color: ${COLORS.headerBg}; line-height: 1.5;">A Word for Your Prayers</h2>
      <p style="margin: 0 0 8px; font-size: 16px; color: ${COLORS.passageInk}; line-height: 1.5; font-style: italic;">${escapeHtml(passage.text)}</p>
      <p style="margin: 0; font-size: 12px; color: ${COLORS.passageMeta}; line-height: 1.5;">&mdash; ${meta}</p>
    </div>`;
}

export function closing(): string {
  return `<p style="margin: 24px 0 0; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">${THANK_YOU_CLOSING}</p>`;
}

// ─── Outer shell (header + body + footer) ────────────────────────────────────

export function emailShell(opts: {
  title: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  eyebrow?: string;
  footerText?: string;
}): string {
  const eyebrow = opts.eyebrow ?? BRAND.eyebrow;
  const footerText = opts.footerText ??
    `You're receiving this because you committed to pray with the ${BRAND.org} ${BRAND.product}.`;
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(opts.title)}</title>
      <style>
        body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        @media only screen and (max-width: 480px) {
          .email-content { padding: 24px 16px !important; }
          .email-heading { padding: 16px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; width: 100%; background: ${COLORS.background};">
      <table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${COLORS.background}" style="border-collapse: collapse;">
        <tr>
          <td align="center" style="font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;">
            <table role="presentation" align="center" width="660" border="0" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width: 100%; max-width: 660px; border-collapse: collapse; color: ${COLORS.body};">
              <tr>
                <td align="center" bgcolor="${COLORS.logoBg}" style="padding: 0;">
                  <img src="${BRAND.logoUrl}" alt="${BRAND.logoAlt}" width="660" style="display: block; width: 100%; max-width: 660px; height: auto; border: 0; color: #ffffff; font-size: 24px;">
                </td>
              </tr>
              <tr>
                <td class="email-heading" align="center" bgcolor="${COLORS.headerBg}" style="padding: 20px 24px; font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;">
                  <h1 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: normal; line-height: 1.4;">${escapeHtml(opts.title)}</h1>
                  <p style="margin: 8px 0 0; font-size: 12px; color: ${COLORS.headerEyebrow}; line-height: 1.5;">${escapeHtml(eyebrow)}</p>
                </td>
              </tr>
              <tr>
                <td class="email-content" style="padding: 28px 24px; font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif; font-size: 16px; line-height: 1.5; word-break: break-word;">
                  ${opts.bodyHtml}
                </td>
              </tr>
              <tr>
                <td align="center" bgcolor="${COLORS.background}" style="padding: 20px 24px; border-top: 2px solid ${COLORS.divider}; font-family: 'Helvetica Neue', Helvetica, Arial, Verdana, sans-serif;">
                  <p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.footer}; line-height: 1.5;">${BRAND.logoAlt}</p>
                  <p style="margin: 0; font-size: 12px; color: ${COLORS.footer}; line-height: 1.5;">
                    ${escapeHtml(footerText)}
                    <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color: ${COLORS.headerBg}; text-decoration: underline;">Unsubscribe</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
