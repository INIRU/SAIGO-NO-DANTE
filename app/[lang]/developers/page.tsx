import { Suspense } from "react";
import type { Metadata } from "next";
import { localeAlternates } from "@/lib/seo/metadata";
import DeveloperConsole from "./DeveloperConsole";
const TITLE = { ko: "개발자 도구", en: "Developer tools", ja: "開発者ツール" };
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: TITLE[lang as keyof typeof TITLE] ?? TITLE.ko, alternates: localeAlternates(lang, "/developers") };
}
export default function DevelopersPage() {
  return (
    <Suspense fallback={null}>
      <DeveloperConsole />
    </Suspense>
  );
}
