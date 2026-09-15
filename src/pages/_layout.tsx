import "../styles/globals.css";

import type { ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <title>gitscope — read-only history & contribution viewer</title>
      <meta name="description" content="gitscope — read-only history & contribution viewer" />
      <link rel="icon" href="/favicon.ico" />
      <NuqsAdapter>{children}</NuqsAdapter>
    </>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
