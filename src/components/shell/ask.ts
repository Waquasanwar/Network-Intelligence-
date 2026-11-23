/** What is worth asking depends on where you are. */
const ASK: [RegExp, string[]][] = [
  [/^\/network/, ["Who is free now for an interim programme director?", "Who do I know in Dubai with banking experience?", "Who have I delivered with and not spoken to lately?"]],
  [/^\/(requirements|opportunities|referrals|relocation)/, ["Who fits a fractional CISO, two days a week in the UAE?", "Who could start a finance transformation next month?", "Who is open to a permanent role in London?"]],
  [/^\/conversations/, ["Who told me they are open to work?", "Who should I catch up with this week?"]],
  [/^\/(portal|partners|amana)/, ["Who can I put in front of a client this week?", "Who has delivered an SOW with us before?"]],
];
const ANY = ["Who do I trust for a turnaround?", "Who is free now and already in the Gulf?"];

/** A question worth asking where you are, for the "Ask Amana" box in the sidebar. */
export function askFor(pathname: string): string {
  return (ASK.find(([re]) => re.test(pathname))?.[1] ?? ANY)[0];
}
