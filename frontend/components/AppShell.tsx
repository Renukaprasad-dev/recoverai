"use client";

import { usePathname } from "next/navigation";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Login gets its own full-screen layout.
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />

      <div className="min-h-screen lg:pl-64">
        <Topbar />

        <main>{children}</main>
      </div>
    </>
  );
}