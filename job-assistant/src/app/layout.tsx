import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Assistant MVP",
  description: "Resume parsing and subscription dashboard MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="app-shell">
        {children}
      </body>
    </html>
  );
}
