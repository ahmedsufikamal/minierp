import { describe, expect, it } from "vitest";
import {
  USER_TYPE_LEVEL,
  assertCanManageTargetLevel,
  assertPermissionAllowedByLevel,
  resolveEffectiveUserTypeLevel,
} from "@/modules/iam/application/level-policy";

describe("level-policy", () => {
  it("maps super admin platform role to level 9", () => {
    const level = resolveEffectiveUserTypeLevel({
      platformRole: "SUPER_ADMIN",
      membershipRole: "MEMBER",
      membershipLevel: 3,
    });
    expect(level).toBe(USER_TYPE_LEVEL.SUPER_USER);
  });

  it("blocks level 3 from management permission even if permission is granted", () => {
    expect(() => assertPermissionAllowedByLevel(USER_TYPE_LEVEL.GENERAL_USER, "admin.members")).toThrow(
      /cannot perform manage/i,
    );
  });

  it("allows level 3 read permissions", () => {
    expect(() => assertPermissionAllowedByLevel(USER_TYPE_LEVEL.GENERAL_USER, "inventory.item.read")).not.toThrow();
  });

  it("allows level 4 to manage level 3 but not level 5", () => {
    expect(() => assertCanManageTargetLevel(USER_TYPE_LEVEL.ADMINISTRATOR_USER, USER_TYPE_LEVEL.GENERAL_USER)).not.toThrow();
    expect(() => assertCanManageTargetLevel(USER_TYPE_LEVEL.ADMINISTRATOR_USER, USER_TYPE_LEVEL.MASTER_USER)).toThrow(
      /cannot manage/i,
    );
  });
});
