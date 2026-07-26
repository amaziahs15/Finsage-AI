export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          monthly_limit: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          monthly_limit: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          monthly_limit?: number
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          honesty_breakdown: Json | null
          honesty_score: number | null
          id: string
          language: string | null
          role: string
          sources: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          honesty_breakdown?: Json | null
          honesty_score?: number | null
          id?: string
          language?: string | null
          role: string
          sources?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          honesty_breakdown?: Json | null
          honesty_score?: number | null
          id?: string
          language?: string | null
          role?: string
          sources?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_deadlines: {
        Row: {
          created_at: string
          description: string | null
          due_date: string
          id: string
          is_demo: boolean
          kind: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date: string
          id?: string
          is_demo?: boolean
          kind: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string
          id?: string
          is_demo?: boolean
          kind?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      government_schemes: {
        Row: {
          benefits_en: string[]
          benefits_hi: string[]
          benefits_ta: string[]
          category: string
          created_at: string
          deadline: string | null
          description_en: string
          description_hi: string
          description_ta: string
          eligibility_en: string[]
          eligibility_hi: string[]
          eligibility_ta: string[]
          id: string
          name_en: string
          name_hi: string
          name_ta: string
          official_url: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          benefits_en?: string[]
          benefits_hi?: string[]
          benefits_ta?: string[]
          category: string
          created_at?: string
          deadline?: string | null
          description_en: string
          description_hi?: string
          description_ta?: string
          eligibility_en?: string[]
          eligibility_hi?: string[]
          eligibility_ta?: string[]
          id?: string
          name_en: string
          name_hi?: string
          name_ta?: string
          official_url?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          benefits_en?: string[]
          benefits_hi?: string[]
          benefits_ta?: string[]
          category?: string
          created_at?: string
          deadline?: string | null
          description_en?: string
          description_hi?: string
          description_ta?: string
          eligibility_en?: string[]
          eligibility_hi?: string[]
          eligibility_ta?: string[]
          id?: string
          name_en?: string
          name_hi?: string
          name_ta?: string
          official_url?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_paid: number
          business_gstin: string | null
          business_name: string | null
          cgst_amount: number
          created_at: string
          customer_gstin: string | null
          customer_name: string
          description: string | null
          due_date: string | null
          hsn_sac_code: string | null
          id: string
          igst_amount: number
          invoice_number: string
          payment_terms: string | null
          sgst_amount: number
          status: string
          taxable_amount: number
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          business_gstin?: string | null
          business_name?: string | null
          cgst_amount?: number
          created_at?: string
          customer_gstin?: string | null
          customer_name: string
          description?: string | null
          due_date?: string | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number
          invoice_number: string
          payment_terms?: string | null
          sgst_amount?: number
          status?: string
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          business_gstin?: string | null
          business_name?: string | null
          cgst_amount?: number
          created_at?: string
          customer_gstin?: string | null
          customer_name?: string
          description?: string | null
          due_date?: string | null
          hsn_sac_code?: string | null
          id?: string
          igst_amount?: number
          invoice_number?: string
          payment_terms?: string | null
          sgst_amount?: number
          status?: string
          taxable_amount?: number
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          business_type: string | null
          created_at: string
          demo_mode: boolean
          employee_count: string | null
          financial_health_score: number | null
          full_name: string | null
          gstin: string | null
          notify_deadlines: boolean
          notify_weekly_summary: boolean
          preferred_language: string
          state: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          demo_mode?: boolean
          employee_count?: string | null
          financial_health_score?: number | null
          full_name?: string | null
          gstin?: string | null
          notify_deadlines?: boolean
          notify_weekly_summary?: boolean
          preferred_language?: string
          state?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string | null
          business_type?: string | null
          created_at?: string
          demo_mode?: boolean
          employee_count?: string | null
          financial_health_score?: number | null
          full_name?: string | null
          gstin?: string | null
          notify_deadlines?: boolean
          notify_weekly_summary?: boolean
          preferred_language?: string
          state?: string | null
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      regulatory_updates: {
        Row: {
          action_required: boolean
          action_steps: Json
          affected_business_types: Json
          affected_clauses: Json
          affected_industries: Json
          affected_laws: Json
          affected_rules: Json
          analysis_en: Json | null
          analysis_hi: Json | null
          analysis_ta: Json | null
          category: string | null
          compliance_deadline: string | null
          compliance_impact_score: number
          created_at: string
          deadline_urgency_score: number
          document_title: string | null
          effective_date: string | null
          financial_impact_score: number
          honesty_breakdown: Json | null
          honesty_score: number | null
          id: string
          impact_level: string | null
          last_verified_at: string | null
          msme_impact_score: number
          msme_reach_score: number
          new_requirement: string | null
          operational_impact_score: number
          original_content: string
          penalty_risk_score: number
          previous_requirement: string | null
          publication_date: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
          title: string
          updated_at: string
          verified: boolean
          what_changed: string | null
        }
        Insert: {
          action_required?: boolean
          action_steps?: Json
          affected_business_types?: Json
          affected_clauses?: Json
          affected_industries?: Json
          affected_laws?: Json
          affected_rules?: Json
          analysis_en?: Json | null
          analysis_hi?: Json | null
          analysis_ta?: Json | null
          category?: string | null
          compliance_deadline?: string | null
          compliance_impact_score?: number
          created_at?: string
          deadline_urgency_score?: number
          document_title?: string | null
          effective_date?: string | null
          financial_impact_score?: number
          honesty_breakdown?: Json | null
          honesty_score?: number | null
          id?: string
          impact_level?: string | null
          last_verified_at?: string | null
          msme_impact_score?: number
          msme_reach_score?: number
          new_requirement?: string | null
          operational_impact_score?: number
          original_content: string
          penalty_risk_score?: number
          previous_requirement?: string | null
          publication_date?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          verified?: boolean
          what_changed?: string | null
        }
        Update: {
          action_required?: boolean
          action_steps?: Json
          affected_business_types?: Json
          affected_clauses?: Json
          affected_industries?: Json
          affected_laws?: Json
          affected_rules?: Json
          analysis_en?: Json | null
          analysis_hi?: Json | null
          analysis_ta?: Json | null
          category?: string | null
          compliance_deadline?: string | null
          compliance_impact_score?: number
          created_at?: string
          deadline_urgency_score?: number
          document_title?: string | null
          effective_date?: string | null
          financial_impact_score?: number
          honesty_breakdown?: Json | null
          honesty_score?: number | null
          id?: string
          impact_level?: string | null
          last_verified_at?: string | null
          msme_impact_score?: number
          msme_reach_score?: number
          new_requirement?: string | null
          operational_impact_score?: number
          original_content?: string
          penalty_risk_score?: number
          previous_requirement?: string | null
          publication_date?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          verified?: boolean
          what_changed?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          gst_amount: number | null
          id: string
          invoice_id: string | null
          is_demo: boolean
          itc_eligible: boolean
          kind: string
          payment_status: string | null
          receipt_url: string | null
          txn_date: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          gst_amount?: number | null
          id?: string
          invoice_id?: string | null
          is_demo?: boolean
          itc_eligible?: boolean
          kind: string
          payment_status?: string | null
          receipt_url?: string | null
          txn_date?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          gst_amount?: number | null
          id?: string
          invoice_id?: string | null
          is_demo?: boolean
          itc_eligible?: boolean
          kind?: string
          payment_status?: string | null
          receipt_url?: string | null
          txn_date?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
