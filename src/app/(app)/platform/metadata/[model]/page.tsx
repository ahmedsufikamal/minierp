import { ModelStudioClient } from "@/app/(app)/platform/metadata/[model]/model-studio-client";

type ModelPageProps = {
  params: Promise<{ model: string }>;
};

export default async function PlatformMetadataModelPage({ params }: ModelPageProps) {
  const { model } = await params;
  return <ModelStudioClient model={decodeURIComponent(model)} />;
}
