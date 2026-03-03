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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_otp: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          used: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          used?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          asking_price: number
          body_style: string | null
          city: string | null
          created_at: string
          description: string | null
          drivetrain: string | null
          exterior_color: string | null
          external_id: string | null
          fetched_at: string | null
          fuel_type: string | null
          id: string
          images: string[] | null
          listing_url: string | null
          make: string
          mileage: number | null
          model: string
          seller_name: string | null
          seller_type: string | null
          source: string
          state: string | null
          status: string
          transmission: string | null
          trim: string | null
          user_id: string | null
          vin: string | null
          year: number
          zip_code: string | null
        }
        Insert: {
          asking_price: number
          body_style?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          exterior_color?: string | null
          external_id?: string | null
          fetched_at?: string | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          listing_url?: string | null
          make: string
          mileage?: number | null
          model: string
          seller_name?: string | null
          seller_type?: string | null
          source?: string
          state?: string | null
          status?: string
          transmission?: string | null
          trim?: string | null
          user_id?: string | null
          vin?: string | null
          year: number
          zip_code?: string | null
        }
        Update: {
          asking_price?: number
          body_style?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          drivetrain?: string | null
          exterior_color?: string | null
          external_id?: string | null
          fetched_at?: string | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          listing_url?: string | null
          make?: string
          mileage?: number | null
          model?: string
          seller_name?: string | null
          seller_type?: string | null
          source?: string
          state?: string | null
          status?: string
          transmission?: string | null
          trim?: string | null
          user_id?: string | null
          vin?: string | null
          year?: number
          zip_code?: string | null
        }
        Relationships: []
      }
      marketplace_search_cache: {
        Row: {
          id: string
          last_fetched_at: string
          search_key: string
          total_results: number | null
        }
        Insert: {
          id?: string
          last_fetched_at?: string
          search_key: string
          total_results?: number | null
        }
        Update: {
          id?: string
          last_fetched_at?: string
          search_key?: string
          total_results?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          compare_passes_remaining: number | null
          created_at: string
          expires_at: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          type: Database["public"]["Enums"]["subscription_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          compare_passes_remaining?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          type?: Database["public"]["Enums"]["subscription_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          compare_passes_remaining?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          type?: Database["public"]["Enums"]["subscription_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          reason?: string | null
          user_id: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: []
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
      vehicle_reports: {
        Row: {
          accident_count: number | null
          apr: number | null
          asking_price: number
          body_style: string | null
          chronic_repair_systems: string[] | null
          condition: Database["public"]["Enums"]["vehicle_condition"]
          created_at: string
          deal_rating: Database["public"]["Enums"]["deal_rating"] | null
          depreciation_risk: string | null
          depreciation_table: Json | null
          drivetrain: string | null
          engine_size: string | null
          expert_opinion: string | null
          fair_market_dealer: number | null
          fair_market_private: number | null
          fair_market_trade_in: number | null
          fair_offer_price: number | null
          final_verdict: string | null
          final_verdict_justification: string | null
          financing_type: Database["public"]["Enums"]["financing_type"]
          fuel_type: string | null
          has_service_records: boolean | null
          health_score: number | null
          history_issues: string[] | null
          history_positives: string[] | null
          id: string
          is_cpo: boolean | null
          lease_term_months: number | null
          listing_images: string[] | null
          listing_url: string | null
          loan_amount: number | null
          loan_term: number | null
          major_services_done: string[] | null
          major_services_due: string[] | null
          make: string
          mileage: number
          mileage_allowance: number | null
          model: string
          monthly_payment: number | null
          mpg_city: number | null
          mpg_combined: number | null
          mpg_highway: number | null
          owner_count: number | null
          price_difference: number | null
          pricing_last_updated: string | null
          pricing_sources: string[] | null
          reliability_concerns: Json | null
          residual_value: number | null
          risk_level: Database["public"]["Enums"]["risk_level"] | null
          risk_score: number | null
          seller_type: string | null
          service_gap_miles: number | null
          status: Database["public"]["Enums"]["report_status"]
          title_status: Database["public"]["Enums"]["title_status"] | null
          transmission: string | null
          trim: string | null
          updated_at: string
          user_id: string
          value_proposition: string | null
          vin: string | null
          warranty_months_remaining: number | null
          warranty_notes: string | null
          warranty_risk_reduction: number | null
          warranty_status: string | null
          year: number
          zip_code: string | null
        }
        Insert: {
          accident_count?: number | null
          apr?: number | null
          asking_price: number
          body_style?: string | null
          chronic_repair_systems?: string[] | null
          condition?: Database["public"]["Enums"]["vehicle_condition"]
          created_at?: string
          deal_rating?: Database["public"]["Enums"]["deal_rating"] | null
          depreciation_risk?: string | null
          depreciation_table?: Json | null
          drivetrain?: string | null
          engine_size?: string | null
          expert_opinion?: string | null
          fair_market_dealer?: number | null
          fair_market_private?: number | null
          fair_market_trade_in?: number | null
          fair_offer_price?: number | null
          final_verdict?: string | null
          final_verdict_justification?: string | null
          financing_type?: Database["public"]["Enums"]["financing_type"]
          fuel_type?: string | null
          has_service_records?: boolean | null
          health_score?: number | null
          history_issues?: string[] | null
          history_positives?: string[] | null
          id?: string
          is_cpo?: boolean | null
          lease_term_months?: number | null
          listing_images?: string[] | null
          listing_url?: string | null
          loan_amount?: number | null
          loan_term?: number | null
          major_services_done?: string[] | null
          major_services_due?: string[] | null
          make: string
          mileage: number
          mileage_allowance?: number | null
          model: string
          monthly_payment?: number | null
          mpg_city?: number | null
          mpg_combined?: number | null
          mpg_highway?: number | null
          owner_count?: number | null
          price_difference?: number | null
          pricing_last_updated?: string | null
          pricing_sources?: string[] | null
          reliability_concerns?: Json | null
          residual_value?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number | null
          seller_type?: string | null
          service_gap_miles?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          title_status?: Database["public"]["Enums"]["title_status"] | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id: string
          value_proposition?: string | null
          vin?: string | null
          warranty_months_remaining?: number | null
          warranty_notes?: string | null
          warranty_risk_reduction?: number | null
          warranty_status?: string | null
          year: number
          zip_code?: string | null
        }
        Update: {
          accident_count?: number | null
          apr?: number | null
          asking_price?: number
          body_style?: string | null
          chronic_repair_systems?: string[] | null
          condition?: Database["public"]["Enums"]["vehicle_condition"]
          created_at?: string
          deal_rating?: Database["public"]["Enums"]["deal_rating"] | null
          depreciation_risk?: string | null
          depreciation_table?: Json | null
          drivetrain?: string | null
          engine_size?: string | null
          expert_opinion?: string | null
          fair_market_dealer?: number | null
          fair_market_private?: number | null
          fair_market_trade_in?: number | null
          fair_offer_price?: number | null
          final_verdict?: string | null
          final_verdict_justification?: string | null
          financing_type?: Database["public"]["Enums"]["financing_type"]
          fuel_type?: string | null
          has_service_records?: boolean | null
          health_score?: number | null
          history_issues?: string[] | null
          history_positives?: string[] | null
          id?: string
          is_cpo?: boolean | null
          lease_term_months?: number | null
          listing_images?: string[] | null
          listing_url?: string | null
          loan_amount?: number | null
          loan_term?: number | null
          major_services_done?: string[] | null
          major_services_due?: string[] | null
          make?: string
          mileage?: number
          mileage_allowance?: number | null
          model?: string
          monthly_payment?: number | null
          mpg_city?: number | null
          mpg_combined?: number | null
          mpg_highway?: number | null
          owner_count?: number | null
          price_difference?: number | null
          pricing_last_updated?: string | null
          pricing_sources?: string[] | null
          reliability_concerns?: Json | null
          residual_value?: number | null
          risk_level?: Database["public"]["Enums"]["risk_level"] | null
          risk_score?: number | null
          seller_type?: string | null
          service_gap_miles?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          title_status?: Database["public"]["Enums"]["title_status"] | null
          transmission?: string | null
          trim?: string | null
          updated_at?: string
          user_id?: string
          value_proposition?: string | null
          vin?: string | null
          warranty_months_remaining?: number | null
          warranty_notes?: string | null
          warranty_risk_reduction?: number | null
          warranty_status?: string | null
          year?: number
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otps: { Args: never; Returns: undefined }
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
      deal_rating: "excellent" | "good" | "fair" | "poor" | "overpriced"
      financing_type: "loan" | "lease" | "cash"
      report_status: "draft" | "analyzing" | "complete" | "error"
      risk_level: "low" | "medium" | "high"
      subscription_status: "active" | "cancelled" | "expired"
      subscription_type: "free" | "compare_pass" | "pro"
      title_status: "clean" | "salvage" | "rebuilt" | "lemon"
      vehicle_condition: "excellent" | "good" | "fair" | "poor"
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
      deal_rating: ["excellent", "good", "fair", "poor", "overpriced"],
      financing_type: ["loan", "lease", "cash"],
      report_status: ["draft", "analyzing", "complete", "error"],
      risk_level: ["low", "medium", "high"],
      subscription_status: ["active", "cancelled", "expired"],
      subscription_type: ["free", "compare_pass", "pro"],
      title_status: ["clean", "salvage", "rebuilt", "lemon"],
      vehicle_condition: ["excellent", "good", "fair", "poor"],
    },
  },
} as const
