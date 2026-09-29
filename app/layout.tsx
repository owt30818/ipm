import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { connection } from "next/server";
import { getPublicEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IPAM - IP Address Management",
  description: "Secure and scalable IP Address Management SaaS",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render per request so runtime env (not build-time env) is injected
  await connection();
  const envScript = `window.__ENV=${JSON.stringify(getPublicEnv()).replace(/</g, "\\u003c")}`;

  return (
    <html lang="ko">
      <head>
        <script dangerouslySetInnerHTML={{ __html: envScript }} />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
