import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | BrightSmile Dental",
    default: "BrightSmile Dental — Professional Dental Care in Sydney",
  },
  description:
    "Book your dental appointment online at BrightSmile Dental, Sydney. General dentistry, cosmetic treatments, orthodontics, and emergency care.",
  keywords: ["dental clinic", "dentist", "Sydney", "dental appointment", "teeth whitening"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
