import type { Metadata } from "next";

type OpenGraph = NonNullable<Metadata["openGraph"]>;

/** An internal tool: no share image, but keep the site name on any page that sets openGraph. */
export function openGraph(overrides: OpenGraph = {}): OpenGraph {
  return { siteName: "AI Club Content Desk", type: "website", locale: "en_US", ...overrides } as OpenGraph;
}
