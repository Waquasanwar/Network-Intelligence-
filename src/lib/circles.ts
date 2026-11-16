/** The three circles of trust, closest first. A person sits in exactly one. Shared by the map and the home charts. */
export const CIRCLES = [
  { label: "Worked together", hint: "You have delivered with them" },
  { label: "Known to us", hint: "Screened, vouched for or in conversation" },
  { label: "New to the network", hint: "Introduced, not yet known" },
] as const;

export function circleOf(p: { worked: boolean; screened?: boolean; trust: number }): 0 | 1 | 2 {
  return p.worked ? 0 : p.screened || p.trust >= 10 ? 1 : 2;
}
