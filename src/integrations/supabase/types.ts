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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          city: string | null
          created_at: string
          full_name: string | null
          house_flat: string | null
          id: string
          is_default: boolean
          label: string
          landmark: string | null
          mobile: string | null
          pincode: string | null
          state: string | null
          street_area: string | null
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string | null
          created_at?: string
          full_name?: string | null
          house_flat?: string | null
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          mobile?: string | null
          pincode?: string | null
          state?: string | null
          street_area?: string | null
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string | null
          created_at?: string
          full_name?: string | null
          house_flat?: string | null
          id?: string
          is_default?: boolean
          label?: string
          landmark?: string | null
          mobile?: string | null
          pincode?: string | null
          state?: string | null
          street_area?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "crop_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_listings: {
        Row: {
          available_quantity: number
          created_at: string
          crop_id: string
          description: string | null
          farmer_id: string
          harvest_date: string | null
          id: string
          is_active: boolean
          is_organic: boolean
          price_per_kg: number
          unit: string
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          created_at?: string
          crop_id: string
          description?: string | null
          farmer_id: string
          harvest_date?: string | null
          id?: string
          is_active?: boolean
          is_organic?: boolean
          price_per_kg: number
          unit?: string
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          created_at?: string
          crop_id?: string
          description?: string | null
          farmer_id?: string
          harvest_date?: string | null
          id?: string
          is_active?: boolean
          is_organic?: boolean
          price_per_kg?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crop_listings_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crop_listings_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          category: string
          created_at: string
          emoji: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      farmers: {
        Row: {
          bio: string | null
          created_at: string
          farm_name: string
          farm_size: number | null
          id: string
          location: string
          rating: number | null
          total_orders: number | null
          updated_at: string
          user_id: string
          verified_status: boolean
        }
        Insert: {
          bio?: string | null
          created_at?: string
          farm_name: string
          farm_size?: number | null
          id?: string
          location: string
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
          user_id: string
          verified_status?: boolean
        }
        Update: {
          bio?: string | null
          created_at?: string
          farm_name?: string
          farm_size?: number | null
          id?: string
          location?: string
          rating?: number | null
          total_orders?: number | null
          updated_at?: string
          user_id?: string
          verified_status?: boolean
        }
        Relationships: []
      }
      order_items: {
        Row: {
          bulk_price_per_kg: number
          created_at: string
          crop_name: string
          farmer_name: string
          id: string
          listing_id: string | null
          order_id: string
          price_per_kg: number
          quantity: number
          total: number
        }
        Insert: {
          bulk_price_per_kg: number
          created_at?: string
          crop_name: string
          farmer_name: string
          id?: string
          listing_id?: string | null
          order_id: string
          price_per_kg: number
          quantity: number
          total: number
        }
        Update: {
          bulk_price_per_kg?: number
          created_at?: string
          crop_name?: string
          farmer_name?: string
          id?: string
          listing_id?: string | null
          order_id?: string
          price_per_kg?: number
          quantity?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "crop_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bulk_discount: number
          buyer_id: string | null
          created_at: string
          delivery_address_id: string | null
          delivery_address_text: string | null
          delivery_fee: number
          delivery_slot: string | null
          estimated_delivery: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_status: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          bulk_discount?: number
          buyer_id?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_address_text?: string | null
          delivery_fee?: number
          delivery_slot?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string
          payment_status?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          bulk_discount?: number
          buyer_id?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_address_text?: string | null
          delivery_fee?: number
          delivery_slot?: string | null
          estimated_delivery?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_status?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          order_id: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          order_id: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      get_farmer_order_ids: { Args: { _user_id: string }; Returns: string[] }
      get_order_buyer_id: { Args: { _order_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "farmer" | "admin"
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
      app_role: ["buyer", "farmer", "admin"],
    },
  },
} as const
