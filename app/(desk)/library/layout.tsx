import type { ReactNode } from "react";
import { LibraryTabs } from "./LibraryTabs";

export default function LibraryLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Library</h1>
          <p>Enter a speaker’s photo, a partner’s logo or a room once. Every event and post picks them from here, so nobody re-uploads or retypes them.</p>
        </div>
      </header>
      <LibraryTabs />
      {children}
    </>
  );
}
