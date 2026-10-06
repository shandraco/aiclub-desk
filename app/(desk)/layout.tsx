import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SkipLink } from "@/components/SkipLink";
import { Rail } from "@/components/shell/Rail";
import { getUser } from "@/lib/auth/session";

/**
 * Every signed-in page: the rail on the left, the workspace beside it. The redirect is for
 * convenience; each page, action and route handler still checks the session itself.
 */
export default async function DeskLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="studio">
      <SkipLink />
      <Rail user={user} />
      <main id="main" className="desk-main">
        {children}
      </main>
    </div>
  );
}
