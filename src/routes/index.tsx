import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/saved" });
  },
  head: () => ({
    meta: [
      { title: "LEPDO Listing Studio — Saved Descriptions" },
      {
        name: "description",
        content:
          "Create, style and track Etsy product descriptions: saved descriptions, listing accounts, prompts and the Unicode style formatter.",
      },
      { property: "og:title", content: "LEPDO Listing Studio" },
      {
        property: "og:description",
        content: "Saved descriptions, listings, prompts and the Etsy style formatter in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => null,
});
