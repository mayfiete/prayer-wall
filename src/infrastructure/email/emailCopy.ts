// The admin UI and the edge functions must agree on email copy keys and
// defaults, so both import the same registry. The canonical module lives with
// the edge functions (they cannot import from src/) and is dependency-free.
export {
  EMAIL_COPY_DEFAULTS,
  EMAIL_COPY_FIELDS,
  EMAIL_COPY_GROUP_LABELS,
  copyLines,
  emailCopyFieldsForScope,
  mergeEmailCopy,
} from '../../../supabase/functions/_shared/email-copy'

export type {
  EmailCopy,
  EmailCopyField,
  EmailCopyGroup,
  EmailCopyKey,
  EmailCopyRow,
  EmailCopyScope,
} from '../../../supabase/functions/_shared/email-copy'
