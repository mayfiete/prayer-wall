export type EmailStatus = 'sent' | 'failed' | 'bounced'

export interface EmailLog {
  id: string
  churchId: string
  commitmentId: string | null
  email: string
  status: EmailStatus
  sentAt: Date
  resendMessageId: string | null
}
