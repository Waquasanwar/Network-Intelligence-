"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Dashboard"],
  ["/write", "Write"],
  ["/posts", "Posts"],
  ["/swipe", "Ideas & swipe file"],
  ["/metrics", "Metrics"],
] as const;

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="nav">
      <div className="brand">
        <span className="brand-mark">in</span> Studio
      </div>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={active(href) ? "active" : ""}>
          {label}
        </Link>
      ))}
      <div className="spacer" />
      <Link href="/connect" className={active("/connect") ? "active" : ""}>
        Connect &amp; setup
      </Link>
    </nav>
  );
}
