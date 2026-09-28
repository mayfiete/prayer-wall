// ─── HCA Prayer Foundation — shared email branding & layout ──────────────────
// Central source of truth for the LOOK of every email the Prayer Foundation
// sends (reminders, confirmations, prayer guides, donation thank-yous).
// Mirrors the HCA Fredericksburg "Prayer Supporters" mailer.
//
// The WORDS live in ./email-copy.ts and are overridable per wall from the
// admin "Emails" tab. Every copy value is plain text and is HTML-escaped here,
// so stored copy can never inject markup into an email.

import { copyLines, EMAIL_COPY_DEFAULTS } from "./email-copy.ts";
import type { EmailCopy } from "./email-copy.ts";

export { EMAIL_COPY_DEFAULTS, mergeEmailCopy } from "./email-copy.ts";
export type { EmailCopy } from "./email-copy.ts";

export const BRAND = {
  logoUrl:
    "https://swrcawckpsotialqnisq.supabase.co/storage/v1/object/public/email-assets/hca-logo.png",
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

// ─── Plain-text rendering ────────────────────────────────────────────────────

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Escapes admin copy and substitutes {{token}} placeholders. Tokens are
 * replaced AFTER escaping and their values are escaped too, so neither the
 * template nor the substituted value can carry markup.
 */
export function renderText(template: string, vars: Record<string, string> = {}): string {
  return escapeHtml(template).replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? escapeHtml(vars[key]) : match
  );
}

/** Same as renderText but turns blank lines into paragraphs and newlines into breaks. */
export function renderParagraphs(
  template: string,
  vars: Record<string, string> = {},
  style = `margin: 0 0 16px; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;`,
): string {
  return template
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="${style}">${renderText(block, vars).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Wraps already-rendered, trusted template HTML in the standard body paragraph. */
export function paragraph(html: string): string {
  return `<p style="margin: 0 0 16px; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">${html}</p>`;
}

// ─── Reusable HTML fragments ─────────────────────────────────────────────────

export function greeting(copy: EmailCopy, name: string): string {
  const who = name?.trim() ? name.trim() : copy.greeting_fallback_name;
  return `<p style="margin: 0 0 16px; font-size: 16px; color: ${COLORS.ink}; line-height: 1.5;">${
    renderText(copy.greeting, { name: who })
  }</p>`;
}

export function leadLine(copy: EmailCopy): string {
  if (!copy.lead_line.trim()) return "";
  return `<p style="margin: 0 0 24px; font-size: 20px; text-align: center; color: ${COLORS.headerBg}; line-height: 1.5;">${
    renderText(copy.lead_line)
  }</p>`;
}

export function introParagraphs(copy: EmailCopy): string {
  return renderParagraphs(copy.intro_paragraph);
}

export function closing(copy: EmailCopy): string {
  if (!copy.closing.trim()) return "";
  return `<p style="margin: 24px 0 0; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">${
    renderText(copy.closing)
  }</p>`;
}

// A simple bullet list of the category names the supporter committed to pray for.
export function commitmentList(copy: EmailCopy, categoryNames: string[]): string {
  if (categoryNames.length === 0) return "";
  const items = categoryNames
    .map((n) => `<li style="margin: 0 0 4px;">${escapeHtml(n)}</li>`)
    .join("");
  return `
    <p style="margin: 0 0 8px; font-size: 16px; color: ${COLORS.body}; line-height: 1.5;">
      ${renderText(copy.commitment_list_intro)}
    </p>
    <ul style="margin: 0 0 24px; padding-left: 24px; color: ${COLORS.ink}; font-size: 16px; line-height: 1.5; font-weight: bold;">
      ${items}
    </ul>`;
}

// "Prayer Requests" — grouped by category, each request as a bullet.
export function prayerRequestsBlock(
  copy: EmailCopy,
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
      <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: bold; color: ${COLORS.ink}; line-height: 1.5;">${
    renderText(copy.heading_prayer_requests)
  }</h2>
      ${sections}
    </div>`;
}

// Optional free-text personal request block (a supporter's own prayer_request).
export function personalRequestBlock(copy: EmailCopy, request: string): string {
  if (!request?.trim()) return "";
  return `
    <div style="margin: 24px 0; padding: 24px 0 0; background: ${COLORS.requestBg}; border-top: 2px solid ${COLORS.requestBorder};">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: bold; color: ${COLORS.requestLabel}; line-height: 1.5;">${
    renderText(copy.heading_personal_request)
  }</h2>
      <p style="margin: 0; color: ${COLORS.body}; font-size: 16px; line-height: 1.5;">${escapeHtml(request)}</p>
    </div>`;
}

// "Praises" — gratitude section, one praise per line of admin copy.
export function praisesBlock(copy: EmailCopy): string {
  const praises = copyLines(copy.praises_items);
  if (praises.length === 0) return "";
  const items = praises
    .map((p) => `<li style="margin: 0 0 8px;">${escapeHtml(p)}</li>`)
    .join("");
  return `
    <div style="margin: 24px 0; padding: 24px 0 0; background: ${COLORS.praiseBg}; border-top: 2px solid ${COLORS.praiseBorder};">
      <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: bold; color: ${COLORS.praiseLabel}; line-height: 1.5;">${
    renderText(copy.heading_praises)
  }</h2>
      <ul style="margin: 0; padding-left: 24px; color: ${COLORS.body}; font-size: 16px; line-height: 1.5;">
        ${items}
      </ul>
    </div>`;
}

// Scripture passage block.
export function passageBlock(
  copy: EmailCopy,
  passage: { reference: string; translation: string; text: string; copyright: string | null } | null,
): string {
  if (!passage || !passage.text) return "";
  const meta = passage.copyright
    ? `${escapeHtml(passage.reference)} &middot; ${escapeHtml(passage.copyright)}`
    : `${escapeHtml(passage.reference)} &middot; ${escapeHtml(passage.translation)}`;
  return `
    <div style="margin: 24px 0 0; padding: 16px 20px; background: ${COLORS.passageBg}; border-left: 3px solid ${COLORS.passageBorder};">
      <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: bold; color: ${COLORS.headerBg}; line-height: 1.5;">${
    renderText(copy.heading_passage)
  }</h2>
      <p style="margin: 0 0 8px; font-size: 16px; color: ${COLORS.passageInk}; line-height: 1.5; font-style: italic;">${escapeHtml(passage.text)}</p>
      <p style="margin: 0; font-size: 12px; color: ${COLORS.passageMeta}; line-height: 1.5;">&mdash; ${meta}</p>
    </div>`;
}

/** "Prayer Foundation <noreply@…>" — the Resend `from` header. */
export function fromHeader(copy: EmailCopy, fromEmail: string): string {
  return `${copy.from_name.replace(/[<>\r\n]/g, "").trim()} <${fromEmail}>`;
}

// ─── Outer shell (header + body + footer) ────────────────────────────────────

export function emailShell(opts: {
  copy?: EmailCopy;
  title: string;
  bodyHtml: string;
  unsubscribeUrl: string;
  eyebrow?: string;
  footerText?: string;
}): string {
  const copy = opts.copy ?? EMAIL_COPY_DEFAULTS;
  const eyebrow = opts.eyebrow ?? copy.eyebrow;
  const footerText = opts.footerText ?? copy.footer_text;
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
                  <img src="${BRAND.logoUrl}" alt="${escapeHtml(copy.logo_alt)}" width="660" style="display: block; width: 100%; max-width: 660px; height: auto; border: 0; color: #ffffff; font-size: 24px;">
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
                  <p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.footer}; line-height: 1.5;">${escapeHtml(copy.logo_alt)}</p>
                  <p style="margin: 0; font-size: 12px; color: ${COLORS.footer}; line-height: 1.5;">
                    ${escapeHtml(footerText)}
                    <a href="${escapeHtml(opts.unsubscribeUrl)}" style="color: ${COLORS.headerBg}; text-decoration: underline;">${escapeHtml(copy.unsubscribe_label)}</a>
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
