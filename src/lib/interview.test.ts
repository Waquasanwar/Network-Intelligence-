import { describe, it, expect } from "vitest";
import { answerQuality, probe, ack, askLine, inferAttributes, attributeNarrative, opening, closing, bridge } from "./interview";
import { SCREENING_SCRIPT } from "./screening";
import { redactForSpeech } from "./voice-config";

const q = (key: string) => {
  for (const s of SCREENING_SCRIPT) for (const x of s.questions) if (x.key === key) return x;
  throw new Error(`no question ${key}`);
};

describe("answer quality", () => {
  it("treats a one-word headline as thin and a phrase as fine", () => {
    expect(answerQuality(q("headline"), "BA")).toBe("thin");
    expect(answerQuality(q("headline"), "Business analyst clients trust with payments")).toBe("ok");
  });

  it("accepts a bare city for location", () => {
    expect(answerQuality(q("location"), "Dubai")).toBe("ok");
    expect(answerQuality(q("location"), "")).toBe("empty");
  });

  it("wants a result in a story, not just a setup", () => {
    expect(answerQuality(q("proudest"), "I led a big programme in Dubai for a bank")).toBe("thin");
    expect(answerQuality(q("proudest"), "The core banking migration was red when I arrived, so I rebuilt the plan with the business and we went live in March with no critical defects")).toBe("ok");
  });

  it("asks for more than one capability", () => {
    expect(answerQuality(q("capabilities"), ["Delivery"])).toBe("ok"); // already a list
    expect(answerQuality(q("capabilities"), "Delivery")).toBe("thin");
  });
});

describe("probing and acknowledging", () => {
  it("probes once, with something specific to the question", () => {
    expect(probe(q("proudest"), "I ran a programme")).toMatch(/what was actually going wrong/i);
    expect(probe(q("proudest"), "The programme was red when I arrived, so I rebuilt the plan with the business and we went live in March clean")).toBeNull();
  });

  it("reflects a Gulf location and a visa, because both change the commercials", () => {
    expect(ack(q("location"), "Dubai, UAE")).toMatch(/Dubai/);
    expect(ack(q("workRights"), ["UAE residence visa"])).toMatch(/sponsorship off the table/i);
    expect(ack(q("workRights"), ["Would need sponsorship"])).toMatch(/sponsorship would be needed/i);
  });

  it("never reads a rate back as a number", () => {
    expect(ack(q("rate"), "AED 2,500/day")).not.toMatch(/2,500/);
  });

  it("varies the wording but stays stable for the same question", () => {
    expect(askLine(q("headline"), "p-1")).toBe(askLine(q("headline"), "p-1"));
    expect(askLine(q("headline"), "p-1")).toMatch(/\?/);
  });
});

describe("reading working style out of what was said", () => {
  it("scores the attribute the story speaks to, not all of them", () => {
    const scores = inferAttributes({
      pushback: "The SI wanted to go live with 40 open defects. I told the steering committee I would not sign it off, and I held the line until we agreed a delay of three weeks.",
    });
    expect(scores.assertiveness).toBeGreaterThanOrEqual(4);
    expect(scores.commercial).toBeUndefined(); // nothing was said about money
  });

  it("reads commercial awareness from a trade-off story", () => {
    const scores = inferAttributes({
      commercialCall: "We were over budget, so I cut the scope of the reporting workstream rather than lose the margin, and I made the business case for the delay myself.",
    });
    expect(scores.commercial).toBeGreaterThanOrEqual(4);
  });

  it("does not turn 'steady and thorough' into a low score by accident, but keeps pace low", () => {
    const scores = inferAttributes({ ambiguity: "I am steady and thorough — I map the landscape carefully before I commit to a plan, even when there is no brief at all to work from." });
    expect(scores.pace).toBeLessThanOrEqual(2);
  });

  it("lets a self-rating win over the inference", () => {
    const scores = inferAttributes({ pushback: "I told them no and held the line", "attr:assertiveness": 2 });
    expect(scores.assertiveness).toBe(2);
  });

  it("says plainly when there is nothing to go on", () => {
    expect(attributeNarrative({})).toMatch(/not enough in the conversation/i);
  });
});

describe("the conversation's shape", () => {
  it("opens by saying it is not a form", () => {
    expect(opening("Sarah Okonkwo", 30, 7).join(" ")).toMatch(/not a form/i);
    expect(opening("Sarah Okonkwo", 30, 7)[0]).toMatch(/Sarah/);
  });

  it("closes by offering a person when a call was asked for", () => {
    expect(closing("Sarah", { missing: [], wantsCall: true }).join(" ")).toMatch(/call with Waqas/);
    expect(closing("Sarah", { missing: ["your rate"], wantsCall: false }).join(" ")).toMatch(/your rate/);
  });

  it("bridges between sections but not before the first one", () => {
    const [story, expertise] = SCREENING_SCRIPT;
    expect(bridge(story, undefined)).toBeNull();
    expect(bridge(expertise, story)).toBeTruthy();
  });
});

describe("what the speech vendor is allowed to hear", () => {
  it("drops the person's name and any exact money", () => {
    const out = redactForSpeech("Thank you Sarah Okonkwo, £1,350/day is noted", ["Sarah Okonkwo"]);
    expect(out).not.toMatch(/Sarah|Okonkwo/);
    expect(out).not.toMatch(/1,350/);
    expect(out).toMatch(/the figure you gave/);
  });

  it("leaves a question intact", () => {
    expect(redactForSpeech("Where are you based?", ["Sarah"])).toBe("Where are you based?");
  });
});
