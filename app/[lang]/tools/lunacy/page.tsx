import { Suspense } from "react";
import LunacyCalendar from "@/components/tools/LunacyCalendar";
import { metaText, pageMetadata } from '@/lib/seo/metadata'
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return pageMetadata({ lang, path: "/tools/lunacy", title: metaText('lunacy.meta.title', lang), description: metaText('lunacy.meta.description', lang) });
}
export default function Page() {
  return (
    <Suspense>
      <LunacyCalendar />
    </Suspense>
  );
}
