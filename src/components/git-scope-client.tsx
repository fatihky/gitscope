"use client";

import dynamic from "next/dynamic";
import type { GitScopeProps } from "./git-scope";

const GitScope = dynamic(() => import("./git-scope"), { ssr: false });

export function GitScopeClient(props: GitScopeProps) {
  return <GitScope {...props} />;
}
