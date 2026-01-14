-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GitHub installations (stores GitHub App installation data)
CREATE TABLE IF NOT EXISTS public.github_installations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL UNIQUE, -- GitHub App installation ID
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'User' or 'Organization'
  repositories JSONB NOT NULL DEFAULT '[]'::jsonb, -- Allowed repositories
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects (represent repositories to be worked on)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  github_installation_id UUID REFERENCES public.github_installations(id) ON DELETE SET NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  full_name TEXT NOT NULL, -- e.g., 'owner/repo'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, repo_owner, repo_name)
);

-- Jobs (autonomous development jobs)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, running, completed, failed, cancelled
  goal TEXT,
  acceptance_criteria JSONB,
  tech_stack JSONB, -- Recommended/chosen tech stack
  time_budget_hours NUMERIC(5, 2), -- e.g., 5.00 hours
  autopilot_policy TEXT NOT NULL DEFAULT 'standard', -- standard, restricted
  branch_name TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  error_message TEXT,
  execution_summary JSONB, -- Final summary with timeline, artifacts
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job steps (event stream for job execution)
CREATE TABLE IF NOT EXISTS public.job_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL, -- MEETING_STARTED, TRANSCRIPT_READY, SPEC_CREATED, PLAN_CREATED, FILE_PATCH_APPLIED, COMMAND_STARTED, COMMAND_FINISHED, TESTS_FAILED, TESTS_PASSED, PR_CREATED, PR_UPDATED, JOB_COMPLETED, JOB_FAILED
  step_order INTEGER NOT NULL, -- Order within the job
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Artifacts (logs, test reports, build outputs stored in object storage)
CREATE TABLE IF NOT EXISTS public.artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.job_steps(id) ON DELETE SET NULL,
  artifact_type TEXT NOT NULL, -- log, test_report, build_output, screenshot, summary
  storage_path TEXT NOT NULL, -- Path in S3/Spaces
  storage_url TEXT, -- Public or signed URL
  content_type TEXT,
  size_bytes BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tavus conversations (track Tavus meeting sessions)
CREATE TABLE IF NOT EXISTS public.tavus_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tavus_conversation_id TEXT NOT NULL UNIQUE, -- Tavus conversation ID
  conversation_url TEXT, -- Daily/WebRTC URL for embedding
  transcript JSONB, -- Full transcript from Tavus
  spec JSONB, -- Extracted spec from transcript
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, completed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (for subscription-based pricing)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL, -- active, cancelled, past_due, trialing
  plan TEXT NOT NULL, -- free, starter, pro, enterprise
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage tracking (for billing/limits)
CREATE TABLE IF NOT EXISTS public.usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  period_start TIMESTAMPTZ NOT NULL, -- Billing period start
  period_end TIMESTAMPTZ NOT NULL, -- Billing period end
  jobs_run INTEGER NOT NULL DEFAULT 0,
  hours_used NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_github_installations_user_id ON public.github_installations(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_steps_job_id ON public.job_steps(job_id);
CREATE INDEX IF NOT EXISTS idx_job_steps_created_at ON public.job_steps(created_at);
CREATE INDEX IF NOT EXISTS idx_artifacts_job_id ON public.artifacts(job_id);
CREATE INDEX IF NOT EXISTS idx_tavus_conversations_user_id ON public.tavus_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_tavus_conversations_job_id ON public.tavus_conversations(job_id);

-- RLS Policies (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tavus_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own GitHub installations" ON public.github_installations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own jobs" ON public.jobs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own job steps" ON public.job_steps FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = job_steps.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can view own artifacts" ON public.artifacts FOR SELECT USING (EXISTS (SELECT 1 FROM public.jobs WHERE jobs.id = artifacts.job_id AND jobs.user_id = auth.uid()));
CREATE POLICY "Users can manage own Tavus conversations" ON public.tavus_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own usage" ON public.usage FOR SELECT USING (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_github_installations_updated_at BEFORE UPDATE ON public.github_installations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tavus_conversations_updated_at BEFORE UPDATE ON public.tavus_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_usage_updated_at BEFORE UPDATE ON public.usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

