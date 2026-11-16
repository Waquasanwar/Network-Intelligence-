"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

const LINKS = [
  ["/", "Dashboard", Icon.grid],
  ["/posts", "Posts", Icon.list],
  ["/swipe", "Ideas & swipe file", Icon.bulb],
  ["/metrics", "Metrics", Icon.chart],
] as const;

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="nav" aria-label="Main">
      <Link href="/" className="brand" style={{ padding: "4px 8px 18px", background: "none" }}>
        <span className="brand-mark">in</span>
        <span className="brand-text">
          <strong>LinkedIn Studio</strong>
          <small>Network Intelligence</small>
        </span>
      </Link>
      <Link href="/write" className={`nav-cta ${active("/write") ? "active" : ""}`}>
        <Icon.pen /> Write a post
      </Link>
      <div className="nav-section">Workspace</div>
      {LINKS.map(([href, label, I]) => (
        <Link key={href} href={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}>
          <I /> {label}
        </Link>
      ))}
      <div className="spacer" />
      <div className="nav-section">Setup</div>
      <Link href="/connect" className={active("/connect") ? "active" : ""}>
        <Icon.plug /> Connect &amp; setup
      </Link>
    </nav>
  );
}
