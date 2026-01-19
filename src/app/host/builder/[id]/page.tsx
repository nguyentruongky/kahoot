import { BuilderClient } from "@/app/host/builder/BuilderClient";

export default async function BuilderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BuilderClient quizId={id} />;
}
