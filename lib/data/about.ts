import type { LegalDoc } from '@/lib/data/legal'
import type { SupportedLang } from '@/lib/i18n/types'

/** The about page, drawn like the legal documents. Kept in code: it changes with the site, not with a policy version. */
export const ABOUT: Record<SupportedLang, Omit<LegalDoc, 'type'>> = {
  ko: {
    title: '사이트 소개',
    last_updated: '2026년 11월 5일',
    sections: [
      { heading: '최애의 관리자', body: '림버스 컴퍼니 플레이어가 만든 비공식 팬 사이트입니다. 게임 정보를 찾고, 편성을 짜고, 다른 관리자와 나누는 데 필요한 것을 한국어·영어·일본어로 제공합니다.', items: ['수감자·인격·E.G.O 도감과 키워드', '거울 던전 도감과 플래너', '덱과 플랜 게시판', '스킬 모션', '친구 코드 게시판', '경험치·광기·피해량 계산기'] },
      { heading: '데이터 출처', body: '게임 속 이름·수치·이미지는 게임 데이터를 바탕으로 하며, 게임이 업데이트되면 함께 갱신합니다. 덱·플랜·댓글은 이용자가 직접 쓴 글입니다.' },
      { heading: '저작권', body: 'Limbus Company와 게임 속 이름·이미지·영상의 권리는 Project Moon에 있습니다. 이 사이트는 Project Moon과 제휴하지 않았으며, 공식 정보가 아닙니다. 권리자의 요청이 있으면 해당 자료를 내립니다.' },
      { heading: '운영과 문의', body: '개인이 운영합니다. 잘못된 정보, 권리 관련 요청, 그 밖의 문의는 아래로 보내 주세요.', items: ['이메일: sellindev@icloud.com', '문의 페이지: 로그인 후 답변을 받을 수 있습니다'] },
    ],
  },
  en: {
    title: 'About',
    last_updated: 'November 5, 2026',
    sections: [
      { heading: 'SAIGO NO DANTE', body: 'An unofficial fan site made by a Limbus Company player. It gives Managers what they need to look up the game, build teams and share them, in Korean, English and Japanese.', items: ['Sinner, Identity and E.G.O database with keywords', 'Mirror Dungeon database and planner', 'Team and plan boards', 'Skill motions', 'Friend code board', 'Experience, Lunacy and damage calculators'] },
      { heading: 'Where the data comes from', body: 'Names, numbers and images from the game are based on the game data and are updated with the game. Teams, plans and comments are written by the users.' },
      { heading: 'Rights', body: 'Limbus Company and its names, images and videos belong to Project Moon. This site is not affiliated with Project Moon and is not an official source. Material is taken down at the request of the rights holder.' },
      { heading: 'Who runs it and how to reach us', body: 'The site is run by an individual. Send corrections, rights requests and any other questions here.', items: ['Email: sellindev@icloud.com', 'Contact page: sign in to receive a reply'] },
    ],
  },
  ja: {
    title: 'サイトについて',
    last_updated: '2026年11月5日',
    sections: [
      { heading: 'SAIGO NO DANTE', body: 'リンバスカンパニーのプレイヤーが作った非公式ファンサイトです。ゲーム情報の確認、編成づくり、他の管理人との共有に必要なものを、韓国語・英語・日本語で提供します。', items: ['囚人・人格・E.G.O図鑑とキーワード', '鏡のダンジョン図鑑とプランナー', 'デッキとプランの掲示板', 'スキルモーション', 'フレンドコード掲示板', '経験値・狂気・ダメージ計算機'] },
      { heading: 'データの出典', body: 'ゲーム内の名前・数値・画像はゲームデータに基づき、ゲームのアップデートに合わせて更新します。デッキ・プラン・コメントは利用者が書いたものです。' },
      { heading: '権利について', body: 'Limbus Companyおよびゲーム内の名前・画像・映像の権利はProject Moonに帰属します。本サイトはProject Moonと提携しておらず、公式情報ではありません。権利者からの依頼があれば該当する資料を取り下げます。' },
      { heading: '運営とお問い合わせ', body: '個人が運営しています。誤った情報、権利に関するご依頼、その他のお問い合わせは下記へお送りください。', items: ['メール: sellindev@icloud.com', 'お問い合わせページ: ログインすると返信を受け取れます'] },
    ],
  },
}
