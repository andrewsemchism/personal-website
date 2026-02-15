import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "Andrew Semchism",
  description: "Andrew Semchism - Software Engineer and Computer Science student at the University of Waterloo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
