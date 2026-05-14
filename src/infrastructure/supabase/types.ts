export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  prayer_wall: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; created_at: string }
        Insert: { id?: string; name: string; slug: string; created_at?: string }
        Update: { id?: string; name?: string; slug?: string; created_at?: string }
        Relationships: []
      }
      walls: {
        Row: { id: string; org_id: string; name: string; slug: string; is_active: boolean; created_at: string }
        Insert: { id?: string; org_id: string; name: string; slug: string; is_active?: boolean; created_at?: string }
        Update: { id?: string; org_id?: string; name?: string; slug?: string; is_active?: boolean; created_at?: string }
        Relationships: []
      }
      message_categories: {
        Row: { id: string; org_id: string; name: string; display_order: number; is_active: boolean }
        Insert: { id?: string; org_id: string; name: string; display_order?: number; is_active?: boolean }
        Update: { id?: string; org_id?: string; name?: string; display_order?: number; is_active?: boolean }
        Relationships: []
      }
      commitments: {
        Row: {
          id: string
          wall_id: string
          name: string
          email: string
          committed_at: string
          reminder_active: boolean
          last_reminded_at: string | null
        }
        Insert: {
          id?: string
          wall_id: string
          name: string
          email: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
        }
        Update: {
          id?: string
          wall_id?: string
          name?: string
          email?: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
        }
        Relationships: []
      }
      commitment_categories: {
        Row: { commitment_id: string; category_id: string }
        Insert: { commitment_id: string; category_id: string }
        Update: { commitment_id?: string; category_id?: string }
        Relationships: []
      }
      email_logs: {
        Row: {
          id: string
          wall_id: string
          commitment_id: string | null
          email: string
          status: 'sent' | 'failed' | 'bounced'
          sent_at: string
          resend_message_id: string | null
        }
        Insert: {
          id?: string
          wall_id: string
          commitment_id?: string | null
          email: string
          status: 'sent' | 'failed' | 'bounced'
          sent_at?: string
          resend_message_id?: string | null
        }
        Update: {
          id?: string
          wall_id?: string
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
