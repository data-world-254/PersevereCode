"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const redirectTo = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_APP_BASE_URL;
    return base ? `${base}/login` : undefined;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = "/device";
    });
  }, []);

  const signInWithEmail = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setStatus(error.message);
    else setStatus("Check your email for the magic link.");
  };

  const signInWithGitHub = async () => {
    setStatus(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (error) setStatus(error.message);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>

      <div className="mt-8 space-y-4">
        <button
          onClick={signInWithGitHub}
          className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Continue with GitHub
        </button>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <label className="block text-sm font-medium">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="you@example.com"
          />
          <button
            onClick={signInWithEmail}
            disabled={!email}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send magic link
          </button>
        </div>

        {status ? <p className="text-sm text-neutral-600">{status}</p> : null}
      </div>
    </main>
  );
}
