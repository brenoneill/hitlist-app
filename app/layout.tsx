import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { InstallPrompt } from "./components/InstallPrompt";
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
  title: "HitList",
  description:
    "Make dev work from your phone scale. Gather phone-sized tasks, dispatch Cursor cloud agents, and review PRs with visual proof. Free and open source — bring your own key.",
  appleWebApp: { capable: true, title: "HitList", statusBarStyle: "black-translucent" },
  // iOS data detectors wrap phone-like text in <a href="tel:…"> before
  // hydration, which shows up as an attribute/tree mismatch on phones.
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  viewportFit: "cover",
  // iOS Safari zooms focused inputs under 16px and leaves the sheet
  // skewed; lock scale so the phone PWA stays in proportion.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <InstallPrompt />
        <Analytics />
      </body>
    </html>
  );
}
