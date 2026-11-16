/** Re-mounts on every navigation, so each page glides in. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-in">{children}</div>;
}
