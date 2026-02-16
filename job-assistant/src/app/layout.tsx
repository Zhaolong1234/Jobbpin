import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Providers } from "@/components/providers";
import { Component as GradientBackground } from "@/components/ui/gradient-backgrounds";

import "./globals.css";

export const metadata: Metadata = {
  title: "Job Assistant",
  description: "Onboarding, resume parsing, and billing workflow",
};

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} app-shell`}>
        <GradientBackground className="pointer-events-none fixed inset-0 z-0 h-full !min-h-0" />
        <Providers>
          <div className="relative z-10">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
