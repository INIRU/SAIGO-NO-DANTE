import { Suspense } from "react";
import LunacyCalendar from "@/components/tools/LunacyCalendar";
import { copy } from "@/lib/tools/lunacy/copy";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const t = copy[lang as keyof typeof copy] || copy.ko;
  return { title: t.title, description: t.intro };
}
export default function Page() {
  return (
    <Suspense>
      <LunacyCalendar />
    </Suspense>
  );
}
