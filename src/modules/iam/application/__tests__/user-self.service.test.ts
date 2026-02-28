import { describe, expect, it } from "vitest";
import { maskSessionId } from "@/modules/iam/application/user-self.service";

describe("user self service helpers", () => {
  it("masks session identifiers", () => {
    expect(maskSessionId("abcdef123456")).toBe("abcd••••3456");
    expect(maskSessionId("short")).toBe("sh••••");
    expect(maskSessionId("")).toBe("hidden");
  });
});
