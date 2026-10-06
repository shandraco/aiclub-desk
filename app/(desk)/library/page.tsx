import { redirect } from "next/navigation";

/** The library opens on speakers, the section officers use most. */
export default function LibraryPage() {
  redirect("/library/speakers");
}
