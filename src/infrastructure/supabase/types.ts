export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      churches: {
        Row: { id: string; name: string; slug: string; created_at: string }
        Insert: { id?: string; name: string; slug: string; created_at?: string }
        Update: { id?: string; name?: string; slug?: string; created_at?: string }
        Relationships: []
      }
      prayer_categories: {
        Row: { id: string; church_id: string; name: string; display_order: number; is_active: boolean }
        Insert: { id?: string; church_id: string; name: string; display_order?: number; is_active?: boolean }
        Update: { id?: string; church_id?: string; name?: string; display_order?: number; is_active?: boolean }
        Relationships: []
      }
      prayer_commitments: {
        Row: {
          id: string
          church_id: string
          name: string
          email: string
          committed_at: string
          reminder_active: boolean
          last_reminded_at: string | null
        }
        Insert: {
          id?: string
          church_id: string
          name: string
          email: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
        }
        Update: {
          id?: string
          church_id?: string
          name?: string
          email?: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
        }
        Relationships: []
      }
      prayer_commitment_categories: {
        Row: { commitment_id: string; category_id: string }
        Insert: { commitment_id: string; category_id: string }
        Update: { commitment_id?: string; category_id?: string }
        Relationships: []
      }
      email_logs: {
        Row: {
          id: string
          church_id: string
          commitment_id: string | null
          email: string
          status: 'sent' | 'failed' | 'bounced'
          sent_at: string
          resend_message_id: string | null
        }
        Insert: {
          id?: string
          church_id: string
          commitment_id?: string | null
          email: string
          status: 'sent' | 'failed' | 'bounced'
          sent_at?: string
          resend_message_id?: string | null
        }
        Update: {
          id?: string
          church_id?: string
          commitment_id?: string | null
          email?: string
          status?: 'sent' | 'failed' | 'bounced'
          sent_at?: string
          resend_message_id?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
