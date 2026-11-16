/** A few line icons, 24px grid, 1.75 stroke. */
const base = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Icon = {
  grid: () => (<svg {...base} aria-hidden><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>),
  pen: () => (<svg {...base} aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>),
  list: () => (<svg {...base} aria-hidden><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>),
  bulb: () => (<svg {...base} aria-hidden><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" /></svg>),
  chart: () => (<svg {...base} aria-hidden><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /></svg>),
  plug: () => (<svg {...base} aria-hidden><path d="M9 2v6M15 2v6" /><path d="M6 8h12v4a6 6 0 0 1-12 0Z" /><path d="M12 18v4" /></svg>),
  plus: () => (<svg {...base} aria-hidden><path d="M12 5v14M5 12h14" /></svg>),
  upload: () => (<svg {...base} aria-hidden><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>),
  trend: () => (<svg {...base} aria-hidden><path d="m3 17 6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>),
  calendar: () => (<svg {...base} aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>),
  target: () => (<svg {...base} aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>),
  clock: () => (<svg {...base} aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>),
  ruler: () => (<svg {...base} aria-hidden><path d="M3 17 17 3l4 4L7 21Z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></svg>),
  spark: () => (<svg {...base} aria-hidden><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>),
  users: () => (<svg {...base} aria-hidden><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></svg>),
  arrow: () => (<svg {...base} aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
};
