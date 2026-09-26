/**
 * What the login page and the legal update modal show above the consent boxes, in place of forcing the full text to be
 * scrolled: the points a user would want to know before agreeing (from the current terms and privacy policy), and what a
 * given version changed. Keep in step with the documents in limbus.legal_docs. **text** marks emphasis.
 */
export type LegalLang = 'ko' | 'en' | 'ja'

export const LEGAL_KEY_POINTS: Record<LegalLang, { title: string; items: string[] }> = {
  ko: {
    title: '동의하기 전에 알아 둘 내용',
    items: [
      'Google 로그인으로 **이메일 주소**를 받아 계정을 구분해요. 사이트에는 Google 이름 대신 **닉네임**이 보여요.',
      '로그인한 상태에서 본 **덱·플랜·인격 기록**을 비슷한 글 추천에 써요. 계정을 삭제하면 함께 지워져요.',
      '올린 덱·플랜·댓글의 권리는 작성자에게 있고, 다른 이용자가 **복사해 고쳐 쓸 수 있어요**.',
      '게임 데이터와 어시스트 모드 인식 결과는 **틀릴 수 있어요**. 이것만 믿고 한 선택의 게임 내 손해는 책임지지 않아요.',
    ],
  },
  en: {
    title: 'Worth knowing before you agree',
    items: [
      'Google sign-in gives us your **email address** to tell accounts apart. The site shows your **nickname**, not your Google name.',
      'While signed in, the **decks, plans and identities you view** are used to suggest similar posts. They are deleted with your account.',
      'You keep the rights to your decks, plans and comments, and other users **can copy and adapt them**.',
      'Game data and Assist mode readings **can be wrong**; we are not liable for in-game losses from choices based on them alone.',
    ],
  },
  ja: {
    title: '同意の前に知っておいてほしいこと',
    items: [
      'Googleログインで**メールアドレス**を受け取り、アカウントを区別します。サイトにはGoogleの名前ではなく**ニックネーム**が表示されます。',
      'ログイン中に見た**デッキ・プラン・人格の記録**を似た投稿のおすすめに使います。アカウントを削除すると一緒に消えます。',
      '投稿したデッキ・プラン・コメントの権利は作成者にあり、他の利用者が**コピーして手直しできます**。',
      'ゲームデータとアシストモードの認識結果は**誤ることがあります**。それだけを信じた選択によるゲーム内の損害には責任を負いません。',
    ],
  },
}

/** What each version changed, shown in the update modal. A version missing here shows the key points instead. */
export const LEGAL_CHANGES: Record<string, Record<LegalLang, string[]>> = {
  v5: {
    ko: [
      '어시스트 모드 **인식 개선 참여(선택)**를 켠 경우, 인식에 **실패한 동작**(합성 한 번, 기프트 획득 창, 판매)의 게임 화면을 **동작당 최대 48장** 보내요. 제대로 인식한 동작의 화면은 브라우저에서 바로 지우고 보내지 않아요.',
      '이 내용으로 참여 여부를 **다시 물어봐요**. 계정과 연결하지 않고 **180일 뒤 삭제**하는 것은 그대로예요.',
    ],
    en: [
      'If you turn on Assist mode\'s **recognition improvement (optional)**, game frames of **actions it failed to read** (one fusion, a gift popup, a sale) are sent, **up to 48 per action**. Frames of actions read correctly are deleted in your browser and never sent.',
      'You will be **asked again** whether to take part. Samples are still not linked to your account and are **deleted after 180 days**.',
    ],
    ja: [
      'アシストモードの**認識改善への参加（任意）**をオンにした場合、認識に**失敗した動作**（合成1回、ギフト獲得画面、売却）のゲーム画面を**動作ごとに最大48枚**送信します。正しく認識できた動作の画面はブラウザーですぐ削除し、送信しません。',
      'この内容で参加するかどうかを**もう一度確認**します。アカウントと結び付けず、**180日後に削除**する点は変わりません。',
    ],
  },
  v4: {
    ko: [
      '로그인한 상태에서 본 **덱·플랜·인격 기록**을 계정에 저장해 추천에 써요. 계정을 삭제하면 함께 지워져요.',
      '어시스트 모드 **인식 개선 참여(선택)**를 켠 경우에만 인식이 불확실했던 순간의 게임 화면을 보내요. 계정과 연결하지 않고 **180일 뒤 삭제**해요.',
    ],
    en: [
      'While signed in, the **decks, plans and identities you view** are saved to your account and used for suggestions. They are deleted with your account.',
      'Only if you turn on Assist mode\'s **recognition improvement (optional)**, game screens from uncertain moments are sent. They are not linked to your account and are **deleted after 180 days**.',
    ],
    ja: [
      'ログイン中に見た**デッキ・プラン・人格の記録**をアカウントに保存し、おすすめに使います。アカウントを削除すると一緒に消えます。',
      'アシストモードの**認識改善への参加（任意）**をオンにした場合のみ、認識が不確かだった場面のゲーム画面を送信します。アカウントとは結び付けず、**180日後に削除**します。',
    ],
  },
}

/** Splits "**bold**" markers into alternating plain and emphasized parts. */
export function emphasisParts(text: string): { text: string; strong: boolean }[] {
  return text.split('**').map((part, index) => ({ text: part, strong: index % 2 === 1 })).filter(part => part.text)
}

