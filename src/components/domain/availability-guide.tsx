import { Guide } from "@/components/ui/guide";
import { setMyAvailability } from "@/server/actions/members";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const label = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** When they are free and how they want to work, one tap at a time. */
export function AvailabilityGuide({ personId, className }: { personId: string; className?: string }) {
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 86_400_000);
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const inThree = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 1));
  const working = { name: "when", in: ["now", "from", "open"] };
  return (
    <Guide
      className={className}
      intro="Tell the network when you are free. It decides what I bring to you."
      action={setMyAvailability}
      hidden={{ personId }}
      submit="Save"
      pending="Saving…"
      review="Here is how you will show"
      steps={[
        { name: "when", kind: "choice", ask: "Are you free to take on work?", short: "Free", options: [
          { value: "now", label: "Yes, now" }, { value: "from", label: "From a date", hint: "Finishing something first" },
          { value: "open", label: "Open to the right thing" }, { value: "no", label: "Not right now", hint: "Keep me in the network" },
        ] },
        { name: "from", kind: "choice", ask: "From when?", short: "From", when: { name: "when", in: ["from"] }, options: [
          { value: iso(inTwoWeeks), label: `In two weeks`, hint: label(inTwoWeeks) }, { value: iso(nextMonth), label: "Next month", hint: label(nextMonth) }, { value: iso(inThree), label: "In about three months", hint: label(inThree) },
        ] },
        { name: "pattern", kind: "choice", ask: "How do you want to work?", short: "How", when: working, options: [
          { value: "full_time", label: "Full time" }, { value: "part_time", label: "Part time" }, { value: "per_project", label: "Per project" }, { value: "any", label: "Any of these" },
        ] },
        { name: "days", kind: "choice", ask: "How many days a week?", short: "Days", when: { name: "pattern", in: ["part_time"] }, options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? "day" : "days"}` })) },
        { name: "setting", kind: "choice", ask: "Where can you work?", short: "Where", when: working, options: [
          { value: "remote", label: "Remote" }, { value: "hybrid", label: "Hybrid" }, { value: "onsite", label: "On site" }, { value: "any", label: "Anywhere" },
        ] },
      ]}
    />
  );
}
