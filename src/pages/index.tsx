import { GitScopeClient } from "@/components/git-scope-client";
import { getConfiguredRangePresets, loadRepoConfigs } from "@/lib/gitscope/git-source";

export default async function Home() {
  const { repoConfigs, errors } = await loadRepoConfigs();
  return <GitScopeClient repoConfigs={repoConfigs} errors={errors} rangePresets={getConfiguredRangePresets()} />;
}

// Repository data reflects live local filesystem state, not static content — read it per request.
export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};
