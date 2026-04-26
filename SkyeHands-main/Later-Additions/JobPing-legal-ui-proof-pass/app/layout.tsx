import "@/app/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JobPing",
  description: "Lead follow-up and review automation for home-service businesses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
