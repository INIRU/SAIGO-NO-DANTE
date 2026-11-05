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
  v7: {
    ko: [
      '사이트에 **Google 애드센스 광고**가 붙어요. Google과 광고 파트너가 **광고 쿠키**로 이 사이트와 다른 사이트의 방문 기록을 바탕으로 광고를 보여 줄 수 있어요.',
      '맞춤 광고는 **Google 광고 설정**에서 끌 수 있어요. 유럽 경제 지역·영국·스위스에서는 처음 방문할 때 동의를 물어봐요.',
      '사이트 서버가 **AWS(Lightsail)와 Cloudflare**로 바뀐 것을 반영했어요. 개인정보를 **판매하지 않는 것**은 그대로예요. 이용약관 내용은 바뀌지 않았어요.',
    ],
    en: [
      'The site now shows **Google AdSense ads**. Google and its partners may use **advertising cookies** to show ads based on your visits to this site and other sites.',
      'You can turn off personalized ads in **Google Ads Settings**. Visitors in the European Economic Area, the UK and Switzerland are asked for consent on their first visit.',
      'The policy now names the site\'s new hosts, **AWS (Lightsail) and Cloudflare**. We still **do not sell** personal information. The Terms of Service are unchanged.',
    ],
    ja: [
      'サイトに**Google AdSenseの広告**が掲載されます。Googleとパートナーは**広告Cookie**を使い、このサイトや他のサイトへのアクセス情報に基づいて広告を表示することがあります。',
      'パーソナライズ広告は**Googleの広告設定**で無効にできます。欧州経済領域・英国・スイスからの訪問では、初回に同意を確認します。',
      'サイトのサーバーが**AWS（Lightsail）とCloudflare**に変わったことを反映しました。個人情報を**販売しない**点は変わりません。利用規約の内容は変わっていません。',
    ],
  },
  v6: {
    ko: [
      '어시스트 모드 **인식 개선 참여(선택)**로 보낸 게임 화면을 **인식 모델 학습에 사용**해요. 새로 보내는 화면에는 **삭제 기한을 두지 않아요**. 계정과 연결하지 않는 것은 그대로예요.',
      '이 내용으로 참여 여부를 **다시 물어봐요**. 2026년 10월 2일 이전에 보낸 화면은 약속대로 **180일 뒤 삭제**해요.',
      '**전체 화면**을 공유하면 화면에 보이는 다른 창이 함께 담길 수 있어요. 게임 창을 공유해 주세요.',
    ],
    en: [
      'Game frames sent through Assist mode\'s **recognition improvement (optional)** are **used to train the recognition models**. Frames sent from now on have **no deletion date**. They are still not linked to your account.',
      'You will be **asked again** whether to take part. Frames sent before October 2, 2026 are **deleted after 180 days**, as promised.',
      'If you share your **entire screen**, other windows shown on it may be included. Please share the game window.',
    ],
    ja: [
      'アシストモードの**認識改善への参加（任意）**で送信されたゲーム画面を**認識モデルの学習に使用**します。今後送信される画面には**削除期限を設けません**。アカウントと結び付けない点は変わりません。',
      'この内容で参加するかどうかを**もう一度確認**します。2026年10月2日より前に送信された画面は、約束どおり**180日後に削除**します。',
      '**画面全体**を共有すると、表示されている他のウィンドウが含まれることがあります。ゲームのウィンドウを共有してください。',
    ],
  },
  v5: {
    ko: [
      '어시스트 모드 **인식 개선 참여(선택)**를 켠 경우, 인식에 **실패한 동작**(합성 한 번, 기프트 획득 창, 판매)의 게임 화면을 **동작당 최대 48장** 보내요. 동작별로 읽었는지 여부의 횟수와 직접 추가하거나 지운 기프트 기록도 함께 보내요. 제대로 인식한 동작의 화면은 브라우저에서 바로 지우고 보내지 않아요.',
      '이 내용으로 참여 여부를 **다시 물어봐요**. 계정과 연결하지 않고 **180일 뒤 삭제**하는 것은 그대로예요.',
    ],
    en: [
      'If you turn on Assist mode\'s **recognition improvement (optional)**, game frames of **actions it failed to read** (one fusion, a gift popup, a sale) are sent, **up to 48 per action**, along with how many actions it read or missed and the gifts you added or removed by hand. Frames of actions read correctly are deleted in your browser and never sent.',
      'You will be **asked again** whether to take part. Samples are still not linked to your account and are **deleted after 180 days**.',
    ],
    ja: [
      'アシストモードの**認識改善への参加（任意）**をオンにした場合、認識に**失敗した動作**（合成1回、ギフト獲得画面、売却）のゲーム画面を**動作ごとに最大48枚**送信します。動作ごとに読み取れたかどうかの回数と、手動で追加・削除したギフトの記録も一緒に送信します。正しく認識できた動作の画面はブラウザーですぐ削除し、送信しません。',
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
