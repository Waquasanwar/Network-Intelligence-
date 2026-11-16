import { describe, expect, it } from "vitest";
import { aboveTheFold, checks, stats, titleFrom } from "./text";

describe("text", () => {
  it("titles a draft from its first line", () => {
    expect(titleFrom("I got fired on a Tuesday.\n\nHere's what happened.")).toBe("I got fired on a Tuesday.");
    expect(titleFrom("   ")).toBe("Untitled draft");
  });
  it("cuts the fold at three lines", () => {
    expect(aboveTheFold("a\nb\nc\nd\ne")).toBe("a\nb\nc");
  });
  it("counts hashtags and links", () => {
    const s = stats("Hello #one #two\nsee https://x.com");
    expect(s.hashtags).toBe(2);
    expect(s.links).toBe(1);
  });
  it("flags too many hashtags and rewards a closing question", () => {
    const c = checks(`${"Line. ".repeat(60)}\n#a #b #c #d\nWhat do you think?`);
    expect(c.find((x) => x.id === "tags")?.level).toBe("warn");
    expect(c.find((x) => x.id === "cta")?.level).toBe("good");
  });
});
