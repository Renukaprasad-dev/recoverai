"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { supabase } from "../lib/supabase";

type UserProfile = {
  email?: string;
  name?: string;
  avatar?: string;
};

export default function Topbar() {
  const [profile, setProfile] = useState<UserProfile>({});
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setProfile({
          email: user.email ?? "",
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email?.split("@")[0] ??
            "User",
          avatar: user.user_metadata?.avatar_url ?? "",
        });
      }
    };

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (user) {
        setProfile({
          email: user.email ?? "",
          name:
            user.user_metadata?.full_name ??
            user.user_metadata?.name ??
            user.email?.split("@")[0] ??
            "User",
          avatar: user.user_metadata?.avatar_url ?? "",
        });
      } else {
        setProfile({});
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const initials =
    profile.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "RA";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-5 sm:px-8">
        {/* MOBILE BRAND */}
        <Link
          href="/"
          className="flex items-center gap-2 lg:hidden"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 font-bold text-cyan-400">
            R
          </div>

          <span className="font-semibold text-white">
            RecoverAI
          </span>
        </Link>

        {/* DESKTOP CONTEXT */}
        <div className="hidden lg:block">
          <p className="text-xs text-slate-500">
            Autonomous Revenue Recovery
          </p>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            <span className="text-xs text-slate-400">
              API Connected
            </span>
          </div>

          {/* USER MENU */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((value) => !value)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-cyan-300 transition hover:border-cyan-500/40"
              aria-label="Account menu"
            >
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </button>

            {showMenu && (
              <div className="absolute right-0 top-12 w-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl shadow-black/40">
                <div className="border-b border-slate-800 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-cyan-500/10 text-xs font-semibold text-cyan-300">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {profile.name || "RecoverAI User"}
                      </p>

                      <p className="truncate text-xs text-slate-500">
                        {profile.email || "Authenticated user"}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-400 transition hover:bg-slate-900 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />

                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}