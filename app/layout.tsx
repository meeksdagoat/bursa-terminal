import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KeyboardLayer } from "@/components/keyboard-layer";
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
  title: "Bursa Terminal",
  description:
    "The financial workspace built for the Malaysian market. Live Bursa quotes, BNM rates, and Shariah screening.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      {/* Pages use normal document flow; compact shells lock themselves below lg. */}
      <body className="min-h-full overflow-x-hidden overflow-y-auto touch-pan-y bg-terminal font-sans text-neutral-200">
        <KeyboardLayer />
        {children}
      </body>
    </html>
  );
}
