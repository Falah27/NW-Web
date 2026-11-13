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
        <div className="site-shell">
          <Navbar />
          <main className="mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1600px] px-4 pb-8 pt-5 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
