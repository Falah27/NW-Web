import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Team Hub",
  description: "Manajemen team: member, job, dokumen, kalender",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body className="font-sans antialiased">
        <Navbar />
        <main className="mx-auto max-w-[1200px] px-4 pb-12 pt-4 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}