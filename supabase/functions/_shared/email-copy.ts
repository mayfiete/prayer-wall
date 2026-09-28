// ─── Admin-editable email copy ────────────────────────────────────────────────
// Every word that goes out in an email is defined here as a key with a default.
// Admins override any key per wall in prayer_wall.email_copy; edge functions
// merge the stored rows over these defaults before rendering.
//
// Values are ALWAYS treated as plain text and HTML-escaped at render time
// (see renderText / renderParagraphs in email-layout.ts), so an admin account
// can never inject markup or scripts into an outgoing email.
//
// This module is imported by Deno edge functions AND by the browser admin UI
// (via src/infrastructure/email/emailCopy.ts), so it must stay dependency-free.

export type EmailCopyGroup =
  | "brand"
  | "shared"
  | "confirmation"
  | "guide"
  | "reminder"
  | "donation";

/** Which admin screen a field belongs on. */
export type EmailCopyScope = "prayer" | "giving" | "both";

interface EmailCopyFieldShape {
  readonly key: string;
  readonly label: string;
  readonly group: EmailCopyGroup;
  readonly scope: EmailCopyScope;
  readonly defaultValue: string;
  readonly multiline?: boolean;
  readonly help?: string;
  /** Blank is a meaningful value (hides the section) rather than "use the default". */
  readonly allowBlank?: boolean;
}

const FIELDS = [
  // ── Brand ──────────────────────────────────────────────────────────────────
  {
    key: "from_name",
    label: "Sender name",
    group: "brand",
    scope: "both",
    defaultValue: "HCA Prayer Foundation",
    help: "Shown as the From name. The address itself is the FROM_EMAIL secret.",
  },
  {
    key: "logo_alt",
    label: "Logo alt text",
    group: "brand",
    scope: "both",
    defaultValue: "Heritage Christian Academy",
    help: "Read aloud by screen readers and shown when images are blocked.",
  },

  // ── Shared body copy ───────────────────────────────────────────────────────
  {
    key: "greeting",
    label: "Greeting",
    group: "shared",
    scope: "both",
    defaultValue: "Dear {{name}},",
    help: "{{name}} is replaced with the recipient's name.",
  },
  {
    key: "greeting_fallback_name",
    label: "Greeting fallback name",
    group: "shared",
    scope: "both",
    defaultValue: "Prayer Foundation Supporter",
    help: "Used for {{name}} when we don't have a name on file.",
  },
  {
    key: "closing",
    label: "Closing line",
    group: "shared",
    scope: "both",
    defaultValue: "Thank you, again, for your continued support!",
  },
  {
    key: "unsubscribe_label",
    label: "Unsubscribe link text",
    group: "shared",
    scope: "both",
    defaultValue: "Unsubscribe",
  },

  {
    key: "eyebrow",
    label: "Header eyebrow",
    group: "shared",
    scope: "prayer",
    defaultValue: "HCA Fredericksburg · Prayer Foundation",
    help: "Small line under the title in the coloured header bar.",
  },
  {
    key: "footer_text",
    label: "Footer explanation",
    group: "shared",
    scope: "prayer",
    defaultValue:
      "You're receiving this because you committed to pray with the HCA Prayer Foundation.",
    help: "The unsubscribe link is appended after this sentence.",
  },
  {
    key: "lead_line",
    label: "Opening thank-you line",
    group: "shared",
    scope: "prayer",
    defaultValue: "Thank you for supporting HCA through your commitment to pray!",
    help: "Large centred line above the greeting.",
  },
  {
    key: "intro_paragraph",
    label: "Introduction",
    group: "shared",
    scope: "prayer",
    multiline: true,
    defaultValue:
      "At HCA, we know that nothing we do is possible apart from the work of God. " +
      "We are completely dependent upon Him. As Psalm 127:1 states, \u201cUnless the Lord " +
      "builds the house, those who build it labor in vain.\u201d Prayer teaches us to depend " +
      "upon Him\u2014and He uses it powerfully. So, thank you for praying for this ministry!",
    help: "Leave a blank line between paragraphs.",
  },
  {
    key: "commitment_list_intro",
    label: "Commitment list intro",
    group: "shared",
    scope: "prayer",
    defaultValue:
      "This is a friendly reminder of your commitment to pray for the following:",
  },
  {
    key: "heading_prayer_requests",
    label: "Heading — prayer requests",
    group: "shared",
    scope: "prayer",
    defaultValue: "Prayer Requests:",
  },
  {
    key: "heading_personal_request",
    label: "Heading — personal request",
    group: "shared",
    scope: "prayer",
    defaultValue: "Your Personal Request",
  },
  {
    key: "personal_requests_label",
    label: "Heading — personal request list",
    group: "shared",
    scope: "prayer",
    defaultValue: "Your Personal Requests",
    help: "Groups the supporter's own open prayer points in reminder emails.",
  },
  {
    key: "heading_praises",
    label: "Heading — praises",
    group: "shared",
    scope: "prayer",
    defaultValue: "Praises",
  },
  {
    key: "praises_items",
    label: "Praises",
    group: "shared",
    scope: "prayer",
    multiline: true,
    allowBlank: true,
    defaultValue: [
      "Our first school year was extremely successful and FULL of grace!",
      "All of our first-year students (except for one graduating senior) will be returning next year!",
      "We have had many family tours and already have a few new prospective students for next year!",
      "Due to Mercy Hill Community Church\u2019s construction projects, we have two new classrooms!",
      "An anonymous donor volunteered to paint and seal our parking lot for free!",
    ].join("\n"),
    help: "One praise per line. Leave empty to hide the section.",
  },
  {
    key: "heading_passage",
    label: "Heading — scripture passage",
    group: "shared",
    scope: "prayer",
    defaultValue: "A Word for Your Prayers",
  },

  // ── Confirmation email ─────────────────────────────────────────────────────
  {
    key: "confirmation_subject",
    label: "Subject",
    group: "confirmation",
    scope: "prayer",
    defaultValue: "Welcome to the Prayer Foundation",
  },
  {
    key: "confirmation_title",
    label: "Header title",
    group: "confirmation",
    scope: "prayer",
    defaultValue: "Welcome to the Prayer Foundation",
  },
  {
    key: "confirmation_body",
    label: "Body",
    group: "confirmation",
    scope: "prayer",
    multiline: true,
    defaultValue:
      "Your commitment to pray with the HCA Prayer Foundation has been received. " +
      "You'll begin receiving prayer reminders on the schedule set by our team, and a " +
      "separate email with your full prayer guide is on its way to you now.",
  },

  // ── Prayer guide (summary) email ───────────────────────────────────────────
  {
    key: "guide_subject",
    label: "Subject",
    group: "guide",
    scope: "prayer",
    defaultValue: "Your Prayer Guide",
  },
  {
    key: "guide_title",
    label: "Header title",
    group: "guide",
    scope: "prayer",
    defaultValue: "Your Prayer Guide",
  },
  {
    key: "guide_empty_body",
    label: "Body when no requests exist",
    group: "guide",
    scope: "prayer",
    multiline: true,
    defaultValue:
      "No prayer requests are available for your selected categories yet. " +
      "Our team will add content soon.",
  },

  // ── Reminder email ─────────────────────────────────────────────────────────
  {
    key: "reminder_subject",
    label: "Subject",
    group: "reminder",
    scope: "prayer",
    defaultValue: "A friendly reminder to pray",
  },
  {
    key: "reminder_title",
    label: "Header title",
    group: "reminder",
    scope: "prayer",
    defaultValue: "A Prayer Reminder",
  },

  // ── Donation thank-you email (giving wall) ─────────────────────────────────
  {
    key: "donation_subject",
    label: "Subject",
    group: "donation",
    scope: "giving",
    defaultValue: "Thank you for your gift to HCA Fredericksburg",
  },
  {
    key: "donation_title",
    label: "Header title",
    group: "donation",
    scope: "giving",
    defaultValue: "Thank you for your gift to HCA Fredericksburg",
  },
  {
    key: "donation_eyebrow",
    label: "Header eyebrow",
    group: "donation",
    scope: "giving",
    defaultValue: "HCA Fredericksburg · Giving Wall",
  },
  {
    key: "donation_body",
    label: "Body",
    group: "donation",
    scope: "giving",
    multiline: true,
    defaultValue:
      "Thank you for your generous gift of {{amount}} to HCA Fredericksburg. " +
      "Your support makes a lasting difference.\n\n" +
      "Your name has been added to the HCA Giving Wall as a permanent part of our " +
      "foundation. We are grateful for your partnership with our school.",
    help: "{{amount}} is replaced with the formatted gift amount. Blank line = new paragraph.",
  },
  {
    key: "donation_footer_text",
    label: "Footer explanation",
    group: "donation",
    scope: "giving",
    defaultValue:
      "You're receiving this because you made a gift to the HCA Giving Wall.",
  },
] as const satisfies readonly EmailCopyFieldShape[];

export const EMAIL_COPY_FIELDS: readonly EmailCopyField[] = FIELDS;

export type EmailCopyKey = (typeof FIELDS)[number]["key"];

export type EmailCopyField = EmailCopyFieldShape & { readonly key: EmailCopyKey };

export type EmailCopy = Record<EmailCopyKey, string>;

export const EMAIL_COPY_DEFAULTS: EmailCopy = Object.freeze(
  Object.fromEntries(FIELDS.map((f) => [f.key, f.defaultValue])),
) as EmailCopy;

export const EMAIL_COPY_GROUP_LABELS: Record<EmailCopyGroup, string> = {
  brand: "Sender & branding",
  shared: "Shared across emails",
  confirmation: "Confirmation email",
  guide: "Prayer guide email",
  reminder: "Prayer reminder email",
  donation: "Donation thank-you email",
};

export function emailCopyFieldsForScope(
  scope: Exclude<EmailCopyScope, "both">,
): readonly EmailCopyField[] {
  return EMAIL_COPY_FIELDS.filter((f) => f.scope === scope || f.scope === "both");
}

export interface EmailCopyRow {
  copy_key: string;
  value: string | null;
}

/**
 * Merge stored overrides over the defaults. Unknown keys (left behind by a
 * removed field) and blank values fall back to the default so an email can
 * never go out with a missing sentence.
 */
export function mergeEmailCopy(rows: readonly EmailCopyRow[] | null | undefined): EmailCopy {
  const copy: EmailCopy = { ...EMAIL_COPY_DEFAULTS };
  const blankAllowed = new Set(
    EMAIL_COPY_FIELDS.filter((f) => f.allowBlank).map((f) => f.key as string),
  );
  for (const row of rows ?? []) {
    if (!(row.copy_key in copy) || typeof row.value !== "string") continue;
    if (row.value.trim() === "" && !blankAllowed.has(row.copy_key)) continue;
    copy[row.copy_key as EmailCopyKey] = row.value;
  }
  return copy;
}

/** Splits a multiline list field ("praises_items") into trimmed entries. */
export function copyLines(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}
