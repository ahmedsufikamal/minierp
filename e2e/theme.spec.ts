import { expect, test, type Page } from "@playwright/test";

const THEME_STORAGE_KEY = "minierp-ui-theme";

async function seedThemeStorage(page: Page, mode: "light" | "dark" | "system") {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [THEME_STORAGE_KEY, mode],
  );
}

async function expectHtmlThemeClass(page: Page, expectedClass: "light" | "dark") {
  await expect
    .poll(async () => {
      return page.evaluate((themeClass) => document.documentElement.classList.contains(themeClass), expectedClass);
    })
    .toBe(true);
}

test.describe("theme persistence and system behavior", () => {
  test("persists light mode across refresh", async ({ page }) => {
    await seedThemeStorage(page, "light");
    await page.goto("/auth/sign-in");
    await expectHtmlThemeClass(page, "light");

    await page.reload();
    await expectHtmlThemeClass(page, "light");
  });

  test("persists dark mode across refresh and route navigation", async ({ page }) => {
    await seedThemeStorage(page, "dark");
    await page.goto("/auth/sign-in");
    await expectHtmlThemeClass(page, "dark");

    await page.goto("/auth/sign-up");
    await expectHtmlThemeClass(page, "dark");

    await page.reload();
    await expectHtmlThemeClass(page, "dark");
  });

  test.describe("system mode", () => {
    test.use({ colorScheme: "dark" });

    test("applies dark theme when OS preference is dark", async ({ page }) => {
      await seedThemeStorage(page, "system");
      await page.goto("/auth/sign-in");
      await expectHtmlThemeClass(page, "dark");
    });
  });

  test.describe("system mode light", () => {
    test.use({ colorScheme: "light" });

    test("applies light theme when OS preference is light", async ({ page }) => {
      await seedThemeStorage(page, "system");
      await page.goto("/auth/sign-in");
      await expectHtmlThemeClass(page, "light");
    });
  });
});
