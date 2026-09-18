export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type BusinessSettingsRow = {
  user_id: string
  business_name: string
  currency_code: string
  onboarding_completed: boolean
  expiry_alert_days: number[]
  profit_target_percent: number | null
  demo_data_loaded_at: string | null
  demo_data_version: string | null
  created_at: string
  updated_at: string
}

type FinancialAccountRow = {
  id: string
  user_id: string
  name: string
  account_type: 'cash' | 'upi' | 'bank'
  opening_balance: number
  active: boolean
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      business_settings: {
        Row: BusinessSettingsRow
        Insert: {
          user_id: string
          business_name?: string
          currency_code?: string
          onboarding_completed?: boolean
          expiry_alert_days?: number[]
          profit_target_percent?: number | null
        }
        Update: Partial<Omit<BusinessSettingsRow, 'user_id' | 'created_at'>>
        Relationships: []
      }
      financial_accounts: {
        Row: FinancialAccountRow
        Insert: Partial<FinancialAccountRow> & { user_id: string; name: string; account_type: 'cash' | 'upi' | 'bank' }
        Update: Partial<FinancialAccountRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      seed_default_business_data: {
        Args: Record<string, never>
        Returns: undefined
      }
      record_purchase: {
        Args: { p_payload: Json }
        Returns: string
      }
      record_production: {
        Args: { p_payload: Json }
        Returns: string
      }
      record_bottling: {
        Args: { p_payload: Json }
        Returns: string
      }
      record_sale: {
        Args: { p_payload: Json }
        Returns: string
      }
      record_expense: {
        Args: { p_payload: Json }
        Returns: string
      }
      get_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      load_seven_day_demo_data: {
        Args: Record<string, never>
        Returns: Json
      }
      clear_user_business_data: {
        Args: { p_confirmation: string }
        Returns: undefined
      }
      validate_business_data: {
        Args: Record<string, never>
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
