import { expect, test } from "@playwright/test";

test.describe("smoke: auth sign-in ui", () => {
  test("hides OAuth buttons and renders structured auth error text", async ({ page }) => {
    await page.goto("/auth/sign-in", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Continue with Microsoft" })).toHaveCount(0);

    await page.getByPlaceholder("you@company.com").fill("owner@demo.local");
    await page.getByPlaceholder("Password").fill("ChangeMe!123");
    await page.getByRole("button", { name: "Sign in with password" }).click();

    await expect(page.getByText(/^(UNAUTHORIZED|SETUP_REQUIRED|INTERNAL_ERROR):/)).toBeVisible();
  });
});
