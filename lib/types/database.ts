export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          role: "admin" | "sub_admin" | "user";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: "admin" | "sub_admin" | "user";
        };
        Update: {
          email?: string;
          role?: "admin" | "sub_admin" | "user";
        };
        Relationships: [];
      };
      subnets: {
        Row: {
          id: string;
          cidr: string;
          name: string;
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          cidr: string;
          name: string;
          description?: string;
          created_by?: string;
        };
        Update: {
          cidr?: string;
          name?: string;
          description?: string;
        };
        Relationships: [];
      };
      ip_addresses: {
        Row: {
          id: string;
          subnet_id: string;
          ip_address: string;
          status: "available" | "allocated" | "reserved" | "deprecated";
          description: string | null;
          allocated_to: string | null;
          allocated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          subnet_id: string;
          ip_address: string;
          status?: "available" | "allocated" | "reserved" | "deprecated";
          description?: string;
          allocated_to?: string;
          allocated_at?: string;
        };
        Update: {
          status?: "available" | "allocated" | "reserved" | "deprecated";
          description?: string;
          allocated_to?: string;
          allocated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          ip_address_id: string | null;
          user_id: string | null;
          action_type: "create" | "update" | "delete" | "allocate" | "release";
          old_value: Record<string, unknown> | null;
          new_value: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          ip_address_id?: string;
          user_id?: string;
          action_type: "create" | "update" | "delete" | "allocate" | "release";
          old_value?: Record<string, unknown>;
          new_value?: Record<string, unknown>;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Subnet = Database["public"]["Tables"]["subnets"]["Row"];
export type IpAddress = Database["public"]["Tables"]["ip_addresses"]["Row"];
export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];

export type IpAddressInsert = Database["public"]["Tables"]["ip_addresses"]["Insert"];
export type SubnetInsert = Database["public"]["Tables"]["subnets"]["Insert"];

export type IpAddressWithSubnet = IpAddress & {
  subnet: Pick<Subnet, "id" | "cidr" | "name"> | null;
};
