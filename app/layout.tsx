import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const description =
  "Ask questions about disaster preparedness and FEMA disaster assistance. Answers come from six official FEMA publications, with page-level citations you can open and check.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ReadyRAG: Disaster Preparedness Q&A from FEMA Guides",
  description,
  openGraph: {
    title: "ReadyRAG: Disaster Preparedness Q&A from FEMA Guides",
    description,
    type: "website",
    siteName: "ReadyRAG",
  },
  twitter: {
    card: "summary",
    title: "ReadyRAG: Disaster Preparedness Q&A",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#16181d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
