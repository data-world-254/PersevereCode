"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { completeDeviceLogin } from "@/lib/api";

export default function DevicePage() {
  const [userCode, setUserCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const queryCode = useMemo(() => {
    if (typeof window === "undefined") return null;
    const url = new URL(window.location.href);
    return url.searchParams.get("code");
  }, []);

  useEffect(() => {
    if (queryCode) setUserCode(queryCode);
  }, [queryCode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(Boolean(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(Boolean(session));
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async () => {
    setStatus(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setStatus("You must log in first.");
      return;
    }

    try {
      await completeDeviceLogin(userCode.trim(), token);
      setStatus("Approved. You can return to the extension.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed");
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Device login</h1>
      <p className="mt-3 text-sm text-neutral-600">Enter the code shown in the Persevere extension.</p>

      {!sessionReady ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-sm">You are not logged in.</p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/login"
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Log in
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
            >
              Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
          <label className="block text-sm font-medium">Code</label>
          <input
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            placeholder="ABCD-EFGH"
          />

          <button
            onClick={submit}
            disabled={!userCode.trim()}
            className="mt-3 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve extension
          </button>

          <button
            onClick={signOut}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            Sign out
          </button>

          {status ? <p className="mt-3 text-sm text-neutral-600">{status}</p> : null}
        </div>
      )}
    </main>
  );
}
