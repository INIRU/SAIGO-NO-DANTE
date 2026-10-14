import { Suspense } from "react";
import type { Metadata } from "next";
import { metaText, pageMetadata, seoLang } from "@/lib/seo/metadata";
import DeveloperConsole from "./DeveloperConsole";
const TITLE = { ko: "개발자 도구", en: "Developer tools", ja: "開発者ツール" };
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata({ lang, path: "/developers", title: TITLE[seoLang(lang)], description: metaText("developers.meta.description", lang) });
}
export default function DevelopersPage() {
  return (
    <Suspense fallback={null}>
      <DeveloperConsole />
    </Suspense>
  );
}
