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
          prayer_request: string
        }
        Insert: {
          id?: string
          wall_id: string
          name: string
          email: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
          prayer_request?: string
        }
        Update: {
          id?: string
          wall_id?: string
          name?: string
          email?: string
          committed_at?: string
          reminder_active?: boolean
          last_reminded_at?: string | null
          prayer_request?: string
        }
        Relationships: []
      }
      commitment_categories: {
        Row: { commitment_id: string; category_id: string }
        Insert: { commitment_id: string; category_id: string }
        Update: { commitment_id?: string; category_id?: string }
        Relationships: []
      }
      prayer_points: {
        Row: {
          id: string
          commitment_id: string
          body: string
          is_answered: boolean
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          commitment_id: string
          body: string
          is_answered?: boolean
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          commitment_id?: string
          body?: string
          is_answered?: boolean
          display_order?: number
          created_at?: string
        }
        Relationships: []
      }
      wall_theme: {
        Row: {
          id: string
          wall_id: string
          wall_title: string
          color_primary: string
          color_heading: string
          color_muted: string
          color_background: string
          font_heading: string
          font_body: string
          color_header_bg: string
          color_header_text: string
          font_header: string
          color_banner_bg: string
          color_banner_text: string
          font_banner: string
          color_wall_bg: string
          color_wall_text: string
          font_wall: string
          color_modal_bg: string
          color_modal_text: string
          color_modal_accent: string
          font_modal: string
          stones_per_row: number
          brick_scale: number
          brick_aspect: number
          brick_overlap_x: number
          brick_overlap_y: number
          brick_name_y: number
          brick_name_font: string
          brick_name_size: number
          brick_name_color: string
          updated_at: string
        }
        Insert: {
          id?: string
          wall_id: string
          wall_title?: string
          color_primary?: string
          color_heading?: string
          color_muted?: string
          color_background?: string
          font_heading?: string
          font_body?: string
          color_header_bg?: string
          color_header_text?: string
          font_header?: string
          color_banner_bg?: string
          color_banner_text?: string
          font_banner?: string
          color_wall_bg?: string
          color_wall_text?: string
          font_wall?: string
          color_modal_bg?: string
          color_modal_text?: string
          color_modal_accent?: string
          font_modal?: string
          stones_per_row?: number
          brick_scale?: number
          brick_aspect?: number
          brick_overlap_x?: number
          brick_overlap_y?: number
          brick_name_y?: number
          brick_name_font?: string
          brick_name_size?: number
          brick_name_color?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wall_id?: string
          wall_title?: string
          color_primary?: string
          color_heading?: string
          color_muted?: string
          color_background?: string
          font_heading?: string
          font_body?: string
          color_header_bg?: string
          color_header_text?: string
          font_header?: string
          color_banner_bg?: string
          color_banner_text?: string
          font_banner?: string
          color_wall_bg?: string
          color_wall_text?: string
          font_wall?: string
          color_modal_bg?: string
          color_modal_text?: string
          color_modal_accent?: string
          font_modal?: string
          stones_per_row?: number
          brick_scale?: number
          brick_aspect?: number
          brick_overlap_x?: number
          brick_overlap_y?: number
          brick_name_y?: number
          brick_name_font?: string
          brick_name_size?: number
          brick_name_color?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_rhythms: {
        Row: {
          id: string
          org_id: string
          wall_id: string
          name: string
          cadence: 'daily' | 'weekly' | 'monthly'
          day_of_week: number | null
          day_of_month: number | null
          send_time: string
          timezone: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          wall_id: string
          name?: string
          cadence?: 'daily' | 'weekly' | 'monthly'
          day_of_week?: number | null
          day_of_month?: number | null
          send_time?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          wall_id?: string
          name?: string
          cadence?: 'daily' | 'weekly' | 'monthly'
          day_of_week?: number | null
          day_of_month?: number | null
          send_time?: string
          timezone?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      commitment_rhythms: {
        Row: { commitment_id: string; rhythm_id: string }
        Insert: { commitment_id: string; rhythm_id: string }
        Update: { commitment_id?: string; rhythm_id?: string }
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
