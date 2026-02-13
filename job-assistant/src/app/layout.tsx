import type { Metadata } from "next";
import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Job Assistant",
  description: "Onboarding, resume parsing, and billing workflow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
