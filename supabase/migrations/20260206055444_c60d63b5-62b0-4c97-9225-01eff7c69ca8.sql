-- Create enum types
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired');
CREATE TYPE public.subscription_type AS ENUM ('free', 'compare_pass', 'pro');
CREATE TYPE public.report_status AS ENUM ('draft', 'analyzing', 'complete', 'error');
CREATE TYPE public.vehicle_condition AS ENUM ('excellent', 'good', 'fair', 'poor');
CREATE TYPE public.title_status AS ENUM ('clean', 'salvage', 'rebuilt', 'lemon');
CREATE TYPE public.financing_type AS ENUM ('loan', 'lease', 'cash');
CREATE TYPE public.risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.deal_rating AS ENUM ('excellent', 'good', 'fair', 'poor', 'overpriced');

-- Profiles table for user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subscriptions table for paid features (compare mode)
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.subscription_type NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  compare_passes_remaining INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vehicle reports table for saved analyses
CREATE TABLE public.vehicle_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.report_status NOT NULL DEFAULT 'draft',
  
  -- Vehicle info
  vin TEXT,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_style TEXT,
  engine_size TEXT,
  fuel_type TEXT,
  transmission TEXT,
  drivetrain TEXT,
  
  -- Condition
  mileage INTEGER NOT NULL,
  asking_price NUMERIC(10,2) NOT NULL,
  condition public.vehicle_condition NOT NULL DEFAULT 'good',
  seller_type TEXT DEFAULT 'dealer',
  listing_url TEXT,
  
  -- Vehicle history (from Carfax analysis)
  accident_count INTEGER DEFAULT 0,
  owner_count INTEGER DEFAULT 1,
  title_status public.title_status DEFAULT 'clean',
  has_service_records BOOLEAN DEFAULT false,
  history_issues TEXT[] DEFAULT '{}',
  history_positives TEXT[] DEFAULT '{}',
  health_score INTEGER,
  
  -- Financing
  financing_type public.financing_type NOT NULL DEFAULT 'cash',
  loan_amount NUMERIC(10,2),
  loan_term INTEGER,
  apr NUMERIC(5,2),
  monthly_payment NUMERIC(10,2),
  lease_term_months INTEGER,
  mileage_allowance INTEGER,
  residual_value NUMERIC(10,2),
  
  -- Price assessment (AI generated)
  fair_market_private NUMERIC(10,2),
  fair_market_trade_in NUMERIC(10,2),
  deal_rating public.deal_rating,
  price_difference NUMERIC(10,2),
  
  -- Risk assessment (AI generated)
  risk_level public.risk_level,
  depreciation_risk TEXT,
  reliability_concerns TEXT[] DEFAULT '{}',
  value_proposition TEXT,
  fair_offer_price NUMERIC(10,2),
  expert_opinion TEXT,
  
  -- Depreciation table (stored as JSON)
  depreciation_table JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_vehicle_reports_user_id ON public.vehicle_reports(user_id);
CREATE INDEX idx_vehicle_reports_created_at ON public.vehicle_reports(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view their own subscription" 
  ON public.subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" 
  ON public.subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Note: Updates to subscriptions should only happen via backend/webhooks

-- Vehicle reports policies
CREATE POLICY "Users can view their own reports" 
  ON public.vehicle_reports FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own reports" 
  ON public.vehicle_reports FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" 
  ON public.vehicle_reports FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" 
  ON public.vehicle_reports FOR DELETE 
  USING (auth.uid() = user_id);

-- Function to auto-create profile and subscription on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  
  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, type, status)
  VALUES (NEW.id, 'free', 'active');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to run function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vehicle_reports_updated_at
  BEFORE UPDATE ON public.vehicle_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();