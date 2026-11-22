/** A number, shown as it is. (It used to count up; the interface is still by design.) */
export function Ticker({ value }: { value: number; duration?: number }) {
  return <>{value.toLocaleString("en-GB")}</>;
}
