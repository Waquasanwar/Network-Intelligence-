"use client";
import { useEffect, useRef } from "react";

/**
 * Progressive-enhancement sort for a server-rendered table.
 * Drop <TableSort /> inside a container that holds one <table>. Any
 * <th data-sort="key"> becomes clickable; rows are reordered by each
 * <tr data-sort-key="…">. Numeric when every value parses as a number.
 * With JS off, the table renders in its server order and nothing breaks.
 */
export function TableSort() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const table = anchor.current?.closest("[data-sortable]")?.querySelector("table");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("th[data-sort]"));
    let activeKey: string | null = null;
    let dir: 1 | -1 = 1;

    const cleanups: Array<() => void> = [];

    const apply = (key: string) => {
      if (activeKey === key) dir = dir === 1 ? -1 : 1;
      else {
        activeKey = key;
        dir = 1;
      }
      const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>("tr"));
      const val = (r: HTMLTableRowElement) => r.dataset[`sort${key[0].toUpperCase()}${key.slice(1)}`] ?? r.getAttribute(`data-sort-${key}`) ?? "";
      const numeric = rows.every((r) => val(r) !== "" && !Number.isNaN(Number(val(r))));
      rows.sort((a, b) => {
        const av = val(a);
        const bv = val(b);
        const cmp = numeric ? Number(av) - Number(bv) : av.localeCompare(bv, undefined, { sensitivity: "base" });
        return cmp * dir;
      });
      for (const r of rows) tbody.appendChild(r);
      for (const th of headers) {
        const isActive = th.getAttribute("data-sort") === key;
        th.setAttribute("aria-sort", isActive ? (dir === 1 ? "ascending" : "descending") : "none");
        th.dataset.sortActive = isActive ? (dir === 1 ? "asc" : "desc") : "";
      }
    };

    for (const th of headers) {
      const key = th.getAttribute("data-sort");
      if (!key) continue;
      th.style.cursor = "pointer";
      th.setAttribute("role", "button");
      th.setAttribute("tabindex", "0");
      th.setAttribute("aria-sort", "none");
      const onClick = () => apply(key);
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          apply(key);
        }
      };
      th.addEventListener("click", onClick);
      th.addEventListener("keydown", onKey);
      cleanups.push(() => {
        th.removeEventListener("click", onClick);
        th.removeEventListener("keydown", onKey);
      });
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return <span ref={anchor} className="hidden" aria-hidden="true" />;
}
