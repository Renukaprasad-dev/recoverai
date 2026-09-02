import type { Metadata } from "next";

import "./globals.css";

import AppShell from "../components/AppShell";

export const metadata: Metadata = {
  title: "RecoverAI",
  description:
    "Autonomous AI-powered revenue recovery platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}