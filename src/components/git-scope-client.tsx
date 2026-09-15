"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import type { GitScopeProps } from "./git-scope";

// GitScope reads localStorage during its initial render (theme, panel open-state, export format),
// so it must never run server-side — mount it only after hydration via React.lazy + a mounted flag.
const GitScope = lazy(() => import("./git-scope"));

export function GitScopeClient(props: GitScopeProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <GitScope {...props} />
    </Suspense>
  );
}
