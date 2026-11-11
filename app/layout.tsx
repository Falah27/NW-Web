import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Team Hub",
  description: "Manajemen team: member, job, dokumen, kalender",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased">
        <Navbar />
        <main className="mx-auto max-w-[1200px] px-4 pb-12 pt-4 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}