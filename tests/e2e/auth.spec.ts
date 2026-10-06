import { expect, test } from "@playwright/test";
import { PASSWORD } from "./global-setup";
import { signIn } from "./helpers";

test("a signed-out visitor is sent to sign in, and back where they were going after", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login\?next=%2Fcalendar/);
  await page.getByLabel("Username or email").fill("ben");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test("a wrong password says so and keeps the username", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill("ben");
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That username and password don’t match")).toBeVisible();
  await expect(page.getByLabel("Username or email")).toHaveValue("ben");
});

test("an open redirect in ?next is ignored", async ({ page }) => {
  await page.goto("/login?next=//evil.example/x");
  await page.getByLabel("Username or email").fill("ben");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
});

test("five wrong passwords lock the username, even against the right one", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.getByLabel("Username or email").fill("locky");
    await page.getByLabel("Password").fill(`wrong ${i}`);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("status")).toContainText(/don’t match|Too many/);
  }
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Too many attempts")).toBeVisible();
});

test("signing out ends the session", async ({ page, context }) => {
  await signIn(page, "ben");
  const before = (await context.cookies()).find((c) => c.name.endsWith("desk_session"));
  expect(before?.httpOnly).toBe(true);
  expect(before?.sameSite).toBe("Lax");
  await page.getByLabel("Your menu, Ben Officer").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  // The old cookie no longer works even if replayed.
  await context.addCookies([before!]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("an invalid invite link explains itself", async ({ page }) => {
  await page.goto("/join/not-a-real-token-but-long-enough-xx");
  await expect(page.getByRole("heading", { name: "This invite doesn’t work" })).toBeVisible();
});
