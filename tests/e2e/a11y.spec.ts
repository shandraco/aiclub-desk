import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

/** Automated checks catch perhaps a third of real issues; keyboard and screen reader still apply. */
const pages = ["/", "/calendar", "/calendar?view=week", "/events", "/events/new", "/posts", "/posts/new", "/library/speakers", "/library/partners", "/library/rooms", "/results", "/team", "/account", "/templates", "/templates/shock-speaker", "/templates?family=field&type=photos", "/no-such-page"];

for (const theme of ["night", "day"] as const) {
  test.describe(`axe, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "ada");
      if (theme === "day") await page.evaluate(() => localStorage.setItem("theme", "light"));
    });
    for (const path of pages) {
      test(`${path} has no WCAG A/AA violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude(".fm, .aic-post").analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      });
    }
  });
}

test("sign-in page has no violations", async ({ page }) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});
