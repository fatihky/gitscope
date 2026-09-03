import { GitScopeClient } from "@/components/git-scope-client";
import { loadGitScopeData } from "@/lib/gitscope/git-source";

// Repository data reflects live local filesystem state, not static content — read it per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await loadGitScopeData();
  return <GitScopeClient {...data} />;
}
