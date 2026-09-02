"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    name: "Overview",
    href: "/",
    icon: "⌂",
  },
  {
    name: "Recovery Queue",
    href: "/recovery",
    icon: "↻",
  },
  {
    name: "Transactions",
    href: "/transactions",
    icon: "▣",
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: "◒",
  },
  {
    name: "Audit Trail",
    href: "/audit",
    icon: "◈",
  },
  {
    name: "Demo Simulator",
    href: "/demo",
    icon: "▶",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-800 bg-slate-950 lg:block">
      <div className="flex h-full flex-col">

        {/* =====================================================
            LOGO
        ===================================================== */}

        <div className="border-b border-slate-800 px-6 py-6">
          <Link href="/" className="block">
            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-lg font-bold text-cyan-400">
                R
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  RecoverAI
                </h1>

                <p className="text-[11px] text-slate-500">
                  Revenue Intelligence
                </p>
              </div>

            </div>
          </Link>
        </div>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <div className="flex-1 px-4 py-6">

          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Workspace
          </p>

          <nav className="space-y-1">

            {navigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-500/10 text-cyan-300"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >

                  {/* ICON */}

                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ${
                      active
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "bg-slate-900 text-slate-500 group-hover:text-slate-300"
                    }`}
                  >
                    {item.icon}
                  </span>

                  {/* LABEL */}

                  <span>{item.name}</span>

                </Link>
              );
            })}

          </nav>

        </div>

        {/* =====================================================
            SYSTEM STATUS
        ===================================================== */}

        <div className="border-t border-slate-800 p-4">

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

            <div className="flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />

              <span className="text-xs font-medium text-emerald-300">
                System Operational
              </span>

            </div>

            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              AI recovery engine and policy
              guardrails are active.
            </p>

          </div>

        </div>

      </div>
    </aside>
  );
}