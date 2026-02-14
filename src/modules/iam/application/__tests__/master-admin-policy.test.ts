import { afterEach, describe, expect, it } from "vitest";
import {
  assertDirectMembershipRemovalAllowed,
  assertDirectRoleChangeAllowed,
  assertDirectStatusChangeAllowed,
} from "@/modules/iam/application/master-admin";

const previousFlag = process.env.IAM_MASTER_ADMIN_ENFORCEMENT;

describe("master admin policy guards", () => {
  afterEach(() => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = previousFlag;
  });

  it("blocks direct demotion of active owner", () => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "1";
    expect(() =>
      assertDirectRoleChangeAllowed({
        currentRole: "OWNER",
        currentStatus: "ACTIVE",
        nextRole: "ADMIN",
      }),
    ).toThrow(/Master Admin cannot be demoted directly/i);
  });

  it("blocks direct owner promotion from standard role", () => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "1";
    expect(() =>
      assertDirectRoleChangeAllowed({
        currentRole: "MEMBER",
        currentStatus: "ACTIVE",
        nextRole: "OWNER",
      }),
    ).toThrow(/Use master-admin transfer/i);
  });

  it("blocks direct suspension of active owner", () => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "1";
    expect(() =>
      assertDirectStatusChangeAllowed({
        currentRole: "OWNER",
        currentStatus: "ACTIVE",
        nextStatus: "SUSPENDED",
      }),
    ).toThrow(/cannot be suspended directly/i);
  });

  it("blocks direct removal of active owner", () => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "1";
    expect(() =>
      assertDirectMembershipRemovalAllowed({
        currentRole: "OWNER",
        currentStatus: "ACTIVE",
      }),
    ).toThrow(/cannot be removed directly/i);
  });

  it("allows role changes when enforcement is disabled", () => {
    process.env.IAM_MASTER_ADMIN_ENFORCEMENT = "0";
    expect(() =>
      assertDirectRoleChangeAllowed({
        currentRole: "OWNER",
        currentStatus: "ACTIVE",
        nextRole: "ADMIN",
      }),
    ).not.toThrow();
  });
});
