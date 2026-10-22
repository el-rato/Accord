import type { Metadata } from "next";
import "./accord.css";

export const metadata: Metadata = {
  title: "Accord | Brand review",
  description: "Review campaign content against approved brand references, make evidence-backed corrections and approve the exact version you release.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
