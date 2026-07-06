import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentForge — AI-Powered Multi-Agent Collaborative Workspace",
  description:
    "Collaborate with a team of specialist AI agents (Supervisor, Researcher, Writer, Coder, Critic) in real-time. Run vector RAG searches, write code, and draft documents collaboratively.",
  keywords: ["Next.js 15", "LangGraph", "Gemini", "Multi-Agent System", "RAG", "MongoDB Vector Search", "Real-time AI"],
  authors: [{ name: "AgentForge Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <SessionProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
