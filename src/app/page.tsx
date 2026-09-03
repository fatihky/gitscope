import { GitScopeClient } from "@/components/git-scope-client";
import { getConfiguredRangePresets, loadRepoConfigs } from "@/lib/gitscope/git-source";

// Repository data reflects live local filesystem state, not static content — read it per request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { repoConfigs, errors } = await loadRepoConfigs();
  return <GitScopeClient repoConfigs={repoConfigs} errors={errors} rangePresets={getConfiguredRangePresets()} />;
}
