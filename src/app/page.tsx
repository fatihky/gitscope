"use client";

import dynamic from "next/dynamic";

const GitScope = dynamic(() => import("@/components/git-scope"), { ssr: false });

export default function Home() {
  return <GitScope />;
}
