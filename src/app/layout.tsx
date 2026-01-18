import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Do Kinh Thanh",
  description: "Ban Thanh trang Sai Gon",
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
