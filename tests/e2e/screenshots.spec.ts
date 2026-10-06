import { test } from "@playwright/test";
import { signIn } from "./helpers";

/** `pnpm screenshots`: every page at phone and desktop width, night and day, into ./screenshots. */
const dir = process.env.SCREENSHOT_DIR ?? "screenshots";
const shots = [["week", "/"], ["calendar", "/calendar"], ["events", "/events"], ["posts", "/posts"], ["new-post", "/posts/new"], ["library", "/library/speakers"], ["results", "/results"], ["team", "/team"], ["account", "/account"], ["templates", "/templates"]] as const;

test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to capture");

for (const width of [390, 1440]) {
  for (const theme of ["night", "day"] as const) {
    test(`screenshots ${width} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await signIn(page, "ada");
      if (theme === "day") await page.evaluate(() => localStorage.setItem("theme", "light"));
      for (const [name, path] of shots) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${dir}/${name}-${width}-${theme}.png`, fullPage: true });
      }
    });
  }
}
