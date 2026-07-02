"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/jobs", label: "Jobs" },
  { href: "/profile", label: "Profile" },
] as const;

interface NavUser { id: number; name: string; email: string }

export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-5 py-3">
        <Link href="/jobs" className="text-sm font-bold tracking-tight text-slate-900">
          Job Search
        </Link>
        <div className="flex gap-1">
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto text-xs text-slate-400">
          {user ? (
            <span>{user.name || user.email}</span>
          ) : (
            <a href="/api/auth/login" className="text-brand hover:underline">
              Sign in with Google
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
