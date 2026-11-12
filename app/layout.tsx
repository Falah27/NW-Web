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
        <div className="site-shell">
          <Navbar />
          <main className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1600px] px-4 pb-8 pt-3 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
