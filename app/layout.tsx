import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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
  title: "HowConnected — Everything is connected.",
  description:
    "Pick any two people, companies, places, teams, works, or ideas and discover how they connect.",
  openGraph: {
    title: "HowConnected — Everything is connected.",
    description:
      "Pick any two people, companies, places, teams, works, or ideas and discover how they connect.",
    type: "website",
    siteName: "HowConnected",
  },
  twitter: {
    card: "summary",
    title: "HowConnected — Everything is connected.",
    description:
      "Pick any two people, companies, places, teams, works, or ideas and discover how they connect.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
