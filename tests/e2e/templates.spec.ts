import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the gallery filters by family and use", async ({ page }) => {
  await signIn(page, "ben");
  await page.goto("/templates");
  await page.getByRole("link", { name: "Field", exact: true }).click();
  await expect(page).toHaveURL(/family=field/);
  await page.getByRole("link", { name: "Photos" }).click();
  await expect(page).toHaveURL(/family=field&type=photos/);
  await expect(page.getByRole("link", { name: /Photo grid/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Date poster/ })).toHaveCount(0);
});

test("New post opens the gallery", async ({ page }) => {
  await signIn(page, "ben");
  await page.goto("/posts/new");
  await expect(page).toHaveURL(/\/templates$/);
});

test("a standalone post starts from a template with its words, date and channels", async ({ page }) => {
  await signIn(page, "ben");
  await page.goto("/templates/field-news");
  await page.getByLabel("Headline").fill("Officer applications are open");
  await page.getByLabel("When it goes out").fill("2026-11-02T09:30");
  await page.getByLabel("LinkedIn").check();
  await page.getByRole("button", { name: "Start this post" }).click();
  await expect(page).toHaveURL(/\/posts\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Officer applications are open");
  await expect(page.getByText(/Mon, Nov 2 · 9:30 AM/)).toBeVisible();
});

test("starting with no channel explains what to fix and keeps the words", async ({ page }) => {
  await signIn(page, "ben");
  await page.goto("/templates/shock-speaker");
  await page.getByLabel("Headline").fill("How a flight-test team reads data");
  await page.getByLabel("Instagram feed").uncheck();
  await page.getByRole("button", { name: "Start this post" }).click();
  await expect(page.getByText("Pick at least one place it will go.")).toBeVisible();
  await expect(page.getByLabel("Headline")).toHaveValue("How a flight-test team reads data");
});
