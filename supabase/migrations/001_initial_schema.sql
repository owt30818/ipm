-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'sub_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subnets table
CREATE TABLE IF NOT EXISTS subnets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cidr CIDR NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP Addresses table
CREATE TABLE IF NOT EXISTS ip_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subnet_id UUID NOT NULL REFERENCES subnets(id) ON DELETE CASCADE,
  ip_address INET NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'allocated', 'reserved', 'deprecated')),
  description TEXT,
  allocated_to TEXT,
  allocated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address_id UUID REFERENCES ip_addresses(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('create', 'update', 'delete', 'allocate', 'release')),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_addresses_subnet ON ip_addresses(subnet_id);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_status ON ip_addresses(status);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_ip ON ip_addresses(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subnets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Function to get user role without recursive RLS checks
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profile policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (get_my_role() = 'admin');

-- Subnet policies
CREATE POLICY "Authenticated users can view subnets" ON subnets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert subnets" ON subnets
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'sub_admin'));

CREATE POLICY "Admins can update subnets" ON subnets
  FOR UPDATE USING (get_my_role() IN ('admin', 'sub_admin'));

CREATE POLICY "Admins can delete subnets" ON subnets
  FOR DELETE USING (get_my_role() = 'admin');

-- IP Address policies
CREATE POLICY "Authenticated users can view IPs" ON ip_addresses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert IPs" ON ip_addresses
  FOR INSERT WITH CHECK (get_my_role() IN ('admin', 'sub_admin'));

CREATE POLICY "Admins can update IPs" ON ip_addresses
  FOR UPDATE USING (get_my_role() IN ('admin', 'sub_admin'));

CREATE POLICY "Admins can delete IPs" ON ip_addresses
  FOR DELETE USING (get_my_role() = 'admin');

-- Audit log policies
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (get_my_role() IN ('admin', 'sub_admin'));

CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subnets_updated_at
  BEFORE UPDATE ON subnets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ip_addresses_updated_at
  BEFORE UPDATE ON ip_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
