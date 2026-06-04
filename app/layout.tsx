import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Healthy Body Manager",
  description: "Personal training, recovery, and nutrition planning"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
