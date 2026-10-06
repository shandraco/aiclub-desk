import { expect, type Page } from "@playwright/test";
import { PASSWORD } from "./global-setup";

export async function signIn(page: Page, username = "ada", password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Username or email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
