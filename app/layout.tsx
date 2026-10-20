import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hisaab Saaf — Clear Records, Fair Accounts",
  description:
    "A simple, transparent way for domestic workers to track leave, salary advances, and payment records.",
  applicationName: "Hisaab Saaf",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hisaab Saaf",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-180.png",
  }
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN">
      <body>
        <SplashScreen>{children}</SplashScreen>
      </body>
    </html>
  );
}

