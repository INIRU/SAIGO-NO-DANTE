'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { BookOpen, ChevronRight, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import styles from './NoteEditorGuide.module.css'

const copy = {
  ko: {
    badge:'사용 가이드', title:'작성 도구 사용법', intro:'기프트·테마팩부터 접히는 공략까지, /로 간편하게 넣어보세요.',
    close:'닫기', image:'실제 편집 화면: 아코디언 안의 기프트, 작은 키워드 라벨, 테마팩 추가 슬롯',
    caption:'빈 슬롯과 입력 안내는 편집할 때만 보이며, 미리보기와 게시글에는 나타나지 않습니다.',
    steps:[['/ 입력하기','글을 쓰는 자리에서 /기프트 또는 /테마팩을 입력하고 Tab을 누르세요. 툴바의 블록 삽입에서도 고를 수 있습니다.'],['+ 눌러 선택하기','빈 슬롯의 +를 누르면 검색창이 열립니다. 원하는 에셋을 골라 넣고, 변경 버튼으로 다시 선택할 수 있습니다.'],['미리보기로 확인하기','툴바의 미리보기를 눌러 게시될 모습을 확인하세요. 편집으로 돌아오면 계속 작성할 수 있습니다.']],
    tips:[['내용 접고 펼치기','/아코디언 → Tab. 제목을 적고 Enter를 누르면 안쪽에 글이나 기프트를 넣을 수 있습니다.'],['문장 안에 키워드 넣기','화상처럼 키워드 이름을 적고 Tab을 누르세요. 작은 아이콘과 글자 라벨로 바뀝니다. 일반 글자로 쓰려면 \\못처럼 앞에 백슬래시를 붙이세요 (\\못 → 못).'],['이미지 첨부하기','이미지를 편집 영역에 끌어 놓거나 붙여넣으세요. 툴바의 이미지 버튼도 사용할 수 있습니다. 로그인 필요 · PNG, JPEG, WebP · 최대 8MB.'],['내 유튜브 영상 넣기','유튜브 영상 주소를 붙여넣으면 재생 가능한 영상으로 들어갑니다. /유튜브 명령으로도 넣을 수 있습니다.']],
    commands:'사용할 수 있는 명령', commandList:['/기프트','/테마팩','/인격','/에고','/스킬','/죄악','/키워드','/아코디언','/유튜브'], foot:'덱 노트와 플랜 메모에서 같은 방법으로 사용할 수 있습니다.',
  },
  en: {
    badge:'Guide', title:'Writing tools guide', intro:'Add gifts, theme packs and collapsible guides with /.', close:'Close',
    image:'Actual editor showing a gift inside an accordion, an inline keyword and an empty theme pack slot',
    caption:'Empty slots and input hints appear only while editing. They are hidden in previews and published posts.',
    steps:[['Type /','Type /gift or /theme where you write, then press Tab. You can also use Insert block in the toolbar.'],['Choose with +','Click + in an empty slot to open search. Pick an asset; use Change to replace it.'],['Check the preview','Choose Preview in the toolbar to see how your post will look. Choose Edit to keep writing.']],
    tips:[['Collapsible sections','Type /accordion and press Tab. Write a title, then press Enter to add text or gifts inside.'],['Keywords within sentences','Type a keyword such as Burn, then press Tab. It becomes a small icon and text label. To keep one as plain text, add a backslash first (\\Burn → Burn).'],['Attach images','Drop or paste an image into the editor, or use the Image button. Sign-in required · PNG, JPEG, WebP · up to 8MB.'],['Embed your YouTube video','Paste a YouTube video URL to insert a playable video. You can also use /youtube.']],
    commands:'Available commands', commandList:['/gift','/theme','/identity','/ego','/skill','/sin','/keyword','/accordion','/youtube'],foot:'The same tools work in deck notes and planner notes.',
  },
  ja: {
    badge:'ガイド', title:'作成ツールの使い方', intro:'/ でギフト・テーマパック・折りたためる攻略を追加できます。', close:'閉じる',
    image:'アコーディオン内のギフト、文中のキーワード、空のテーマパックスロットを表示した編集画面',
    caption:'空のスロットと入力案内は編集中だけ表示され、プレビューや投稿には表示されません。',
    steps:[['/ を入力','文章を書く場所で /gift または /theme を入力し、Tabを押します。ツールバーのブロック挿入からも選べます。'],['+ から選択','空のスロットの + を押すと検索が開きます。追加した後も変更ボタンで選び直せます。'],['プレビューで確認','ツールバーのプレビューで投稿時の表示を確認します。編集に戻ると続きを書けます。']],
    tips:[['内容を折りたたむ','/accordion → Tab。見出しを入力してEnterを押すと、内側に文章やギフトを追加できます。'],['文中にキーワードを入れる','火傷などのキーワードを入力してTabを押すと、小さなアイコンと文字のラベルになります。通常の文字にするには \\火傷 のように前にバックスラッシュを付けます (\\火傷 → 火傷)。'],['画像を添付する','画像を編集領域にドロップ・貼り付けするか、画像ボタンを使います。ログインが必要・PNG、JPEG、WebP・最大8MB。'],['YouTube動画を埋め込む','YouTube動画のURLを貼り付けると、再生可能な動画を挿入できます。/youtube も使えます。']],
    commands:'使えるコマンド',commandList:['/gift','/theme','/identity','/ego','/skill','/sin','/keyword','/accordion','/youtube'],foot:'デッキノートとプランのメモで同じように使えます。',
  },
}

export default function NoteEditorGuide({compact=false}:{compact?:boolean}) {
  const locale=useLocale(), lang=locale==='en'||locale==='ja'?locale:'ko', c=copy[lang]
  const [open,setOpen]=useState(false)
  return <>
    <button type="button" className={compact?styles.help:styles.notice} onClick={()=>setOpen(true)} aria-label={c.title} aria-haspopup="dialog">
      {compact ? <><BookOpen size={15}/>{c.title}</> : <><span className={styles.badge}>{c.badge}</span><span className={styles.noticeText}><strong>{c.title}</strong><span>{c.intro}</span></span><ChevronRight size={18}/></>}
    </button>
    <BaseModal open={open} onClose={()=>setOpen(false)} title={c.title} maxWidth="60rem" zIndex={10000}>
      <div className={styles.guide}>
        <header className={styles.header}><div><span>{c.badge}</span><h2>{c.title}</h2></div><button type="button" onClick={()=>setOpen(false)} aria-label={c.close}><X size={20}/></button></header>
        <div className={styles.content}>
          <div className={styles.walkthrough}><figure className={styles.figure}><img src={`/images/guides/editor-${lang}.png`} alt={c.image} width={1050} height={521} loading="lazy"/><figcaption>{c.caption}</figcaption></figure>
          <ol className={styles.steps}>{c.steps.map(([title,body],i)=><li key={title}><span className={styles.number}>{i+1}</span><div><h3>{title}</h3><p>{body}</p></div></li>)}</ol></div>
          <section className={styles.commands} aria-label={c.commands}><h3>{c.commands}</h3><div>{c.commandList.map(command=><code key={command}>{command}</code>)}<span>→ <kbd>Tab</kbd></span></div></section>
          <div className={styles.tips}>{c.tips.map(([title,body])=><section key={title}><h3>{title}</h3><p>{body}</p></section>)}</div>
        </div>
        <div className={styles.footer}><p>{c.foot}</p><button type="button" onClick={()=>setOpen(false)}>{c.close}</button></div>
      </div>
    </BaseModal>
  </>
}
