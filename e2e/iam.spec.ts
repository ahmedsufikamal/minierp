import { test, expect } from "@playwright/test";

test.describe("IAM flows", () => {
  test("sign-up -> sign-in form availability", async ({ page }) => {
    await page.goto("/auth/sign-up");
    await expect(page.getByRole("heading", { name: /create your workspace/i })).toBeVisible();

    await page.goto("/auth/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with password/i })).toBeVisible();
  });

  test("org and role pages are protected", async ({ page }) => {
    await page.goto("/org/members");
    await expect(page).toHaveURL(/auth\/sign-in|sign-in/);

    await page.goto("/org/roles");
    await expect(page).toHaveURL(/auth\/sign-in|sign-in/);
  });

  test("mfa page renders", async ({ page }) => {
    await page.goto("/auth/mfa");
    await expect(page.getByRole("heading", { name: /multi-factor authentication/i })).toBeVisible();
  });
});
