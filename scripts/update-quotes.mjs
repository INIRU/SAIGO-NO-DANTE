import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lpgqcleszdlldneiwgep.supabase.co',
  'REMOVED'
)

// 인격 영문명 → 대사 (나무위키 출처)
const quotes = {
  'LCB Sinner':                                  '이상이라고 하오. 소개는 이상이오.',
  'Seven Assoc. South Section 6':                 '내게는 어떤 것도 감출 필요가 없소.',
  'Blade Lineage Salsu':                          '나는 유려하면서도 비범하게 심장을 베는 법을 알고 있소.',
  'Effloresced E.G.O Spicebush':                  '어서 오시게. 내 마음이… 마음에 드오?',
  'Molar Office Fixer':                           '결국, 우리가 나서서 처리해야겠구료.',
  'W Corp. L3 Cleanup Agent':                     '출근 중에는 되도록 건드리지 않았으면 하오만… 무엇이오?',
  'The Pequod First Mate':                        '이상이라 부르게. 피쿼드호의 일등 항해사를 맡고 있지.',
  'Dieci Assoc. South Section 4':                 '이상이오. 조금 조용히 하도록 하지, 이곳은 지식의 성전이니.',
  'The Ring Pointillist Student':                 '그대께서 새로운 영감을 불러와주시겠는가. 그렇지 않다면… 특별히 흥미가 생기진 않네만.',
  'Lobotomy E.G.O Solemn Lament':                 '죽음에 관한 그대의 의견은 잘 알았소. 잠시, 충동적인 마음은 접어두고 좀 더 대화해보지 않겠는가.',
  'LCE E.G.O Lantern':                            '아, 그대. 잠시 쉬고 가지 않겠나. …그리고 온 김에, 이 실험 결과 정리를 도와주게.',
  'Liu Assoc. South Section 3':                   '여전히도, 참으로 북적스런 공간이 아닐 수 없구료…',
  'N Corp. E.G.O Fell Bullet':                    '친우의 피로 점철한 넝마를 보고 손가락질하는가. 어리석은 자들이로다.',
  'Heishou Pack - Wu Branch Adept':               '군주가 바라는 홍원은, 아씨가 바라는 홍원과 그 끝에서나마 닮아있더구료.',
  'The House of Spiders The Index Nursefather':   '선택하는 삶보다는 선택받는 삶⋯ 후. 딸도⋯ 이 삶의 유쾌함을 느낄 수 있었으면 좋겠소만.',
}

async function main() {
  let updated = 0
  for (const [name, quote] of Object.entries(quotes)) {
    const { error } = await sb
      .schema('limbus')
      .from('identities')
      .update({ quote })
      .eq('name', name)

    if (error) {
      console.error(`✗ ${name}: ${error.message}`)
    } else {
      console.log(`✓ ${name}`)
      updated++
    }
  }
  console.log(`\n${updated}/${Object.keys(quotes).length} identities updated`)
}

main()
