import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <>
      <h1>Sign in</h1>
      <LoginForm next={next ?? "/"} />
      <p className="muted" style={{ fontSize: "var(--text-s)" }}>
        New to the desk? An admin sends you an invite link. Forgot your password? Ask an admin to reset it.
      </p>
    </>
  );
}
