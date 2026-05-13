"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/quiz", label: "Quiz" },
  { href: "/chat", label: "Chat" },
] as const;

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-5 w-6 text-[var(--ink)]" aria-hidden>
      <span
        className={`absolute left-0 top-0 block h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-200 ${
          open ? "translate-y-[9px] rotate-45" : ""
        }`}
      />
      <span
        className={`absolute left-0 top-[9px] block h-0.5 w-full rounded-full bg-current transition-opacity duration-200 ${
          open ? "opacity-0" : "opacity-100"
        }`}
      />
      <span
        className={`absolute left-0 top-[18px] block h-0.5 w-full origin-center rounded-full bg-current transition-transform duration-200 ${
          open ? "-translate-y-[9px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-[color-mix(in_oklab,var(--accent)_18%,transparent)] bg-[color-mix(in_oklab,var(--paper)_78%,transparent)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto w-full max-w-lg pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] min-w-0 flex-1 text-balance text-2xl font-semibold leading-[1.15] tracking-tight text-[var(--ink)] decoration-[var(--gold)] decoration-2 underline-offset-4 hover:underline sm:text-[1.65rem] md:max-w-[14rem] md:flex-none md:text-lg md:leading-snug lg:text-xl"
            onClick={() => setOpen(false)}
          >
            <span className="text-[var(--accent)]" aria-hidden>
              ✦
            </span>{" "}
            Sarah wants to learn french
          </Link>

          <button
            type="button"
            className="nav-pill text-[var(--ink)] shrink-0 rounded-2xl px-3 py-3 md:hidden"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <BurgerIcon open={open} />
          </button>

          <nav
            className="ml-auto hidden items-center gap-1.5 text-sm font-semibold md:flex"
            aria-label="Main"
          >
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="nav-pill rounded-full px-4 py-2.5 text-[var(--muted)] transition sm:min-h-[2.75rem] sm:px-4"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <nav
          id={menuId}
          className={`mt-3 flex flex-col gap-1 border-t border-[color-mix(in_oklab,var(--accent)_14%,transparent)] pt-3 md:hidden ${
            open ? "" : "hidden"
          }`}
          aria-hidden={!open}
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-pill rounded-2xl px-4 py-3.5 text-center text-base font-bold text-[var(--ink)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
