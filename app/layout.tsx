import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Nunito } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

const body = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sarah wants to learn french",
  description: "French practice: quizzes from Notion and chat with Claude.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff5f9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh font-[family-name:var(--font-body)] text-[15px] antialiased sm:text-base">
        <header className="sticky top-0 z-20 border-b border-[color-mix(in_oklab,var(--accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--paper)_78%,transparent)] backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex w-full max-w-lg flex-wrap items-center justify-between gap-x-3 gap-y-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] min-w-0 max-w-[min(100%,14rem)] text-balance text-base font-semibold leading-tight tracking-tight text-[var(--ink)] decoration-[var(--gold)] decoration-2 underline-offset-4 hover:underline sm:max-w-[18rem] sm:text-lg"
            >
              <span className="text-[var(--accent)]" aria-hidden>
                ✦
              </span>{" "}
              Sarah wants to learn french
            </Link>
            <nav className="flex shrink-0 flex-wrap justify-end gap-1.5 text-xs font-semibold sm:text-sm">
              <Link
                href="/"
                className="nav-pill rounded-full px-3 py-2.5 text-[var(--muted)] transition sm:min-h-[2.75rem] sm:px-4"
              >
                Home
              </Link>
              <Link
                href="/quiz"
                className="nav-pill rounded-full px-3 py-2.5 text-[var(--muted)] transition sm:min-h-[2.75rem] sm:px-4"
              >
                Quiz
              </Link>
              <Link
                href="/chat"
                className="nav-pill rounded-full px-3 py-2.5 text-[var(--muted)] transition sm:min-h-[2.75rem] sm:px-4"
              >
                Chat
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 sm:pt-8">
          {children}
        </main>
      </body>
    </html>
  );
}
