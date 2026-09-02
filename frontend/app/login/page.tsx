"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="relative flex min-h-screen overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-[-280px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[140px]" />
          <div className="absolute bottom-[-250px] left-[-200px] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[130px]" />
        </div>

        {/* Left panel */}
        <section className="relative hidden flex-1 flex-col justify-between border-r border-white/10 px-12 py-10 lg:flex xl:px-20">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <Bot className="h-5 w-5 text-cyan-300" />
              </div>

              <div>
                <p className="text-lg font-semibold tracking-tight">
                  Recover<span className="text-cyan-300">AI</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                  Revenue Recovery
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1.5 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Autonomous recovery intelligence
            </div>

            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
              Recover revenue
              <br />
              <span className="text-cyan-300">before it is lost.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
              RecoverAI detects failed payments, diagnoses why they failed,
              chooses a policy-safe recovery strategy, and executes the next
              best action automatically.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <Feature
                icon={<Sparkles className="h-4 w-4" />}
                title="AI decisions"
                text="Context-aware recovery"
              />

              <Feature
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Policy safe"
                text="Guardrails before action"
              />

              <Feature
                icon={<CheckCircle2 className="h-4 w-4" />}
                title="Auditable"
                text="Every action recorded"
              />
            </div>
          </div>

          <p className="text-xs text-slate-600">
            RecoverAI • Autonomous Revenue Recovery System
          </p>
        </section>

        {/* Right panel */}
        <section className="relative flex w-full items-center justify-center px-6 py-12 lg:w-[520px] xl:w-[580px]">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="mb-10 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10">
                <Bot className="h-5 w-5 text-cyan-300" />
              </div>

              <div>
                <p className="text-lg font-semibold">
                  Recover<span className="text-cyan-300">AI</span>
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Revenue Recovery
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="mb-8">
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                  Control Center
                </p>

                <h2 className="text-2xl font-semibold tracking-tight">
                  Sign in to RecoverAI
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Access your recovery intelligence dashboard.
                </p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="group flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}

                <span>
                  {loading ? "Connecting..." : "Continue with Google"}
                </span>

                {!loading && (
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
                )}
              </button>

              {error && (
                <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm leading-5 text-red-300">
                  {error}
                </div>
              )}

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[11px] uppercase tracking-wider text-slate-600">
                  Secure access
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <span>Authentication powered by Supabase</span>
                </div>

                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                  <span>Your recovery data stays protected</span>
                </div>
              </div>

              <p className="mt-8 text-center text-[11px] leading-5 text-slate-600">
                By continuing, you agree to use RecoverAI responsibly and
                within your organization's payment and recovery policies.
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-slate-600">
              © 2026 RecoverAI
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
        {icon}
      </div>

      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.79-.07-1.55-.23-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z"
      />
      <path
        fill="#34A853"
        d="M12 21.5c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.74 9.74 0 0 0 12 21.5Z"
      />
      <path
        fill="#FBBC05"
        d="M6.54 13.59A5.85 5.85 0 0 1 6.23 12c0-.55.11-1.09.31-1.59V7.88H3.3A9.5 9.5 0 0 0 2.25 12c0 1.49.36 2.9 1.05 4.12l3.24-2.53Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.38c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.46 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.38l3.24 2.53C7.31 8.1 9.46 6.38 12 6.38Z"
      />
    </svg>
  );
}