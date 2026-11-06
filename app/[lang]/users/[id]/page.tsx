import { Suspense } from "react";
import type { Metadata } from "next";
import PublicProfile from "@/features/community/components/PublicProfile";
import { getCommunityCopy } from "@/features/community";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: getCommunityCopy(lang).publicProfile,
    robots: { index: false, follow: true },
  };
}
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicProfile id={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={null}>
      <Content params={params} />
    </Suspense>
  );
}
