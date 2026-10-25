import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo/metadata'
import { cacheLife, cacheTag } from 'next/cache'
import { getLatestEGOs, getLatestIdentities } from '@/lib/db/queries'
import { getPinnedAnnouncementForLang } from '@/lib/db/announcements'
import { announcementPreview, type AnnouncementPreview } from '@/lib/announcements'
import HomeClient from './HomeClient'
import HomeStaticSections from '@/components/home/HomeStaticSections'
import JsonLd, { faqJsonLd } from '@/components/seo/JsonLd'
import { setRequestLocale } from 'next-intl/server'
import type { SupportedLang } from '@/lib/i18n/types'
import { translations } from '@/lib/i18n/translations'
import { latestYoutubePreview, youtubeVideosFeedUrl, type YoutubeVideo } from '@/lib/utils/youtube'
export type { YoutubeVideo } from '@/lib/utils/youtube'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = (key: string) => {
    const entry = translations[key as keyof typeof translations]
    if (!entry) return key
    return entry[lang as SupportedLang] ?? entry['ko'] ?? key
  }
  return {
    title: { absolute: t('home.meta.title') },
    description: t('home.meta.description'),
    alternates: localeAlternates(lang, '/'),
  }
}

const HOME_FAQ: Record<SupportedLang, { question: string; answer: string }[]> = { ko: [
  {
    question: '림버스 컴퍼니 거울 던전 기프트 조합식은 어디서 볼 수 있나요?',
    answer: '거울 던전 페이지에서 E.G.O 기프트 408종의 키워드별 필터, 등급별 검색, 조합 레시피를 확인할 수 있습니다. 테마팩별 전용 기프트도 확인 가능합니다.',
  },
  {
    question: '림버스 컴퍼니 수감자는 몇 명인가요?',
    answer: '림버스 컴퍼니에는 이상, 파우스트, 돈키호테, 료슈, 뫼르소, 홍루, 히스클리프, 이스마엘, 로쟈, 싱클레어, 오티스, 그레고르 총 12명의 수감자가 있습니다.',
  },
  {
    question: '림버스 컴퍼니 인격 스킬 정보는 어디서 확인하나요?',
    answer: '수감자 페이지에서 각 인격의 스킬 위력, 코인 수, 코인 위력, 공격 타입, 죄악 속성, 패시브 등 상세 정보를 확인할 수 있습니다. 동기화 3/4 단계별 데이터도 제공합니다.',
  },
  {
    question: '림버스 컴퍼니 덱 빌더란?',
    answer: '덱 빌더는 12명의 수감자 인격을 편성하고 활성화되는 E.G.O 기프트를 확인할 수 있는 도구입니다. 만든 덱을 커뮤니티에 공유하고 다른 유저의 덱을 참고할 수도 있습니다.',
  },
], en: [
  {
    question: 'Where can I find Limbus Company Mirror Dungeon E.G.O Gift fusion recipes?',
    answer: 'The Mirror Dungeon page lists all 408 E.G.O Gifts with keyword filters, tier search and fusion recipes, plus the gifts exclusive to each Theme Pack.',
  },
  {
    question: 'How many Sinners are in Limbus Company?',
    answer: 'Limbus Company has 12 Sinners: Yi Sang, Faust, Don Quixote, Ryōshū, Meursault, Hong Lu, Heathcliff, Ishmael, Rodion, Sinclair, Outis and Gregor.',
  },
  {
    question: 'Where can I check Limbus Company Identity skills?',
    answer: 'Each Sinner page shows every Identity with skill power, coin count, coin power, attack type, sin affinity and passives, including Uptie 3 and Uptie 4 data.',
  },
  {
    question: 'What is the Limbus Company deck builder?',
    answer: 'The deck builder lets you assemble Identities for all 12 Sinners and see which E.G.O Gifts they activate. You can share decks with the community and browse decks from other players.',
  },
], ja: [
  {
    question: 'リンバスカンパニーのミラーダンジョンのE.G.Oギフト合成レシピはどこで見られますか？',
    answer: 'ミラーダンジョンページで408種のE.G.Oギフトをキーワード・等級で絞り込み、合成レシピを確認できます。テーマパックごとの専用ギフトも確認できます。',
  },
  {
    question: 'リンバスカンパニーの囚人は何人ですか？',
    answer: 'イサン、ファウスト、ドンキホーテ、良秀、ムルソー、ホンル、ヒースクリフ、イシュメール、ロージャ、シンクレア、ウーティス、グレゴールの12人です。',
  },
  {
    question: 'リンバスカンパニーの人格スキルはどこで確認できますか？',
    answer: '囚人ページで各人格のスキル威力、コイン数、コイン威力、攻撃タイプ、罪悪属性、パッシブを確認できます。同期化3・4のデータもあります。',
  },
  {
    question: 'デッキビルダーとは何ですか？',
    answer: '12人の囚人の人格を編成し、発動するE.G.Oギフトを確認できるツールです。作ったデッキをコミュニティに共有し、他のプレイヤーのデッキも参考にできます。',
  },
] }

// The home banner gets only the teaser (cover and excerpt); the body stays on the announcement's page.
async function getPinnedAnnouncement(lang: SupportedLang): Promise<AnnouncementPreview | null> {
  const item = await getPinnedAnnouncementForLang(lang)
  return item ? announcementPreview(item, 200) : null
}

// ── Project Moon 공식 채널 ID ────────────────────────────────────────────────
// https://www.youtube.com/@ProjectMoonOfficial 채널 ID를 입력하세요
const PM_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? ''

async function getLatestYoutubeVideo(): Promise<YoutubeVideo | null> {
  if (!PM_CHANNEL_ID) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    try {
      const res = await fetch(
        youtubeVideosFeedUrl(PM_CHANNEL_ID),
        { next: { revalidate: 3600 }, signal: controller.signal }
      )
      clearTimeout(timeout)
      if (!res.ok) return null
      const xml = await res.text()

      return latestYoutubePreview(xml)
    } catch {
      clearTimeout(timeout)
      return null
    }
  } catch {
    return null
  }
}


async function getCachedHomeData(lang: SupportedLang) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities, CACHE_TAGS.sinners, CACHE_TAGS.announcements)
  const [latestIdentities, pinnedAnnouncement] = await Promise.all([
    getLatestIdentities(6),
    getPinnedAnnouncement(lang),
  ])
  return { latestIdentities, pinnedAnnouncement }
}

async function getCachedLatestEgos() {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.ego, CACHE_TAGS.sinners)
  return getLatestEGOs(2)
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: routeLang } = await params
  const lang: SupportedLang = routeLang === 'en' || routeLang === 'ja' ? routeLang : 'ko'
  setRequestLocale(lang)
  const [{ latestIdentities, pinnedAnnouncement }, latestEgos] = await Promise.all([getCachedHomeData(lang), getCachedLatestEgos()])

  return (
    <>
      <JsonLd data={faqJsonLd(HOME_FAQ[lang])} />
      <HomeClient latestIdentities={latestIdentities} pinnedAnnouncement={pinnedAnnouncement} />
      <HomeStaticSections
        lang={lang}
        latestIdentities={latestIdentities}
        latestEgos={latestEgos}
        latestVideo={getLatestYoutubeVideo()}
      />
    </>
  )
}
