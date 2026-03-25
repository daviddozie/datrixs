import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://datrixs.vercel.app"

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Datrixs — AI Data Analyst",
    template: "%s | Datrixs",
  },
  description:
    "Upload CSV, Excel, PDF, or images and ask questions in plain English. Datrixs is an AI-powered data analyst that generates insights, charts, and statistics instantly — no code required.",
  keywords: [
    "AI data analyst",
    "data analysis",
    "CSV analysis",
    "Excel analysis",
    "PDF data extraction",
    "natural language data query",
    "AI analytics",
    "data visualization",
    "no-code analytics",
    "AI spreadsheet",
    "RAG data analysis",
  ],
  authors: [{ name: "Datrixs" }],
  creator: "Datrixs",
  publisher: "Datrixs",
  category: "Technology",
  applicationName: "Datrixs",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: APP_URL,
    siteName: "Datrixs",
    title: "Datrixs — AI Data Analyst",
    description:
      "Upload CSV, Excel, PDF, or images and ask questions in plain English. Instant AI-powered insights, charts, and statistics — no code required.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Datrixs — AI Data Analyst",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Datrixs — AI Data Analyst",
    description:
      "Upload your data and ask questions in plain English. AI-powered analytics, charts, and insights instantly.",
    images: ["/og-image.png"],
    creator: "@datrixs",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: APP_URL,
  },
  other: {
    "google-site-verification": "MAApe_BphylhwpodSTZWUbqER7CSD2HIA_k1NPKMIew",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${APP_URL}/#website`,
      url: APP_URL,
      name: "Datrixs",
      description: "AI-powered data analyst — upload your data and get instant insights.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${APP_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${APP_URL}/#app`,
      name: "Datrixs",
      url: APP_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Datrixs is an AI data analyst. Upload CSV, Excel, PDF, or image files and ask questions in plain English to get instant charts, statistics, and insights powered by RAG and LLMs.",
      featureList: [
        "CSV and Excel analysis",
        "PDF data extraction",
        "Image OCR and table parsing",
        "Natural language queries",
        "AI-generated charts and visualizations",
        "Multi-file session management",
        "Retrieval-augmented generation (RAG)",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Organization",
      "@id": `${APP_URL}/#organization`,
      name: "Datrixs",
      url: APP_URL,
      logo: {
        "@type": "ImageObject",
        url: `${APP_URL}/icon-512.png`,
      },
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
