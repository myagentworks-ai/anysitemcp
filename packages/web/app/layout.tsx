import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnySiteMCP",
  description: "Turn any website into an MCP server for AI agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="border-b px-4 py-3 flex gap-4 text-sm">
          <Link href="/" className="font-semibold">AnySiteMCP</Link>
          <Link href="/servers" className="text-gray-500 hover:text-gray-900">Servers</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
