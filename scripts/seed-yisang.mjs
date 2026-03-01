import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://lpgqcleszdlldneiwgep.supabase.co',
  'REMOVED'
)

const SIN_MAP = { '분노':'wrath','색욕':'lust','나태':'sloth','탐식':'gluttony','우울':'gloom','오만':'pride','질투':'envy','없음':null }
const TYPE_MAP = { '참격':'slash','관통':'pierce','타격':'blunt','방어':'defense','회피':'evade','반격':'counter' }

// Crawled from baslimbus.store API
const crawled = [
  {id:76,name:"LCB 수감자",affiliation:"LCB",grade:1,status:{life:"221",speed:"4-8",defend:"58(-2)"},skill1:{name:"쳐내기",type:"참격",resource:"우울",skillSeq:1,skillPower:3,coinPower:7,coinNum:1,normalEffect:"",coin1Effect:"[앞면 적중시] 침잠 2 부여"},skill2:{name:"밀어찌르기",type:"관통",resource:"질투",skillSeq:2,skillPower:4,coinPower:4,coinNum:2,normalEffect:"",coin2Effect:"[적중시] 침잠 1 부여, 침잠 횟수 1 증가"},skill3:{name:"연격",type:"참격",resource:"나태",skillSeq:3,skillPower:6,coinPower:1,coinNum:3,normalEffect:"",coin3Effect:"[적중시] 대상의 정신력이 0 미만 이면 다음 턴에 취약 1 부여"},defSkill:{name:"가드",type:"방어",resource:"없음",skillSeq:4,skillPower:7,coinPower:3,coinNum:1,normalEffect:""}},
  {id:77,name:"남부 세븐 협회 6과",affiliation:"세븐 협회",grade:2,status:{life:"251",speed:"5-8",defend:"62(+2)"},skill1:{name:"플레쉬",type:"관통",resource:"우울",skillSeq:1,skillPower:4,coinPower:6,coinNum:1,normalEffect:"",coin1Effect:"[앞면 적중시] 파열 2 부여"},skill2:{name:"리포스트",type:"관통",resource:"탐식",skillSeq:2,skillPower:5,coinPower:2,coinNum:2,normalEffect:"[합 승리시] 다음 턴에 마비 3 부여",coin2Effect:"[적중시] 취약 1 부여"},skill3:{name:"물리네",type:"타격",resource:"나태",skillSeq:3,skillPower:5,coinPower:3,coinNum:3,normalEffect:"",coin1Effect:"[적중시] 마지막 코인의 효과 부여 값 +1",coin2Effect:"[적중시] 마지막 코인의 효과 부여 값 +1",coin3Effect:"[적중시] 다음 턴에 관통 취약 1 부여"},defSkill:{name:"가드",type:"방어",resource:"없음",skillSeq:4,skillPower:9,coinPower:3,coinNum:1,normalEffect:""}},
  {id:78,name:"검계 살수",affiliation:"검계",grade:3,status:{life:"203",speed:"3-7",defend:"56(-4)"},skill1:{name:"격세",type:"참격",resource:"오만",skillSeq:1,skillPower:5,coinPower:6,coinNum:1,normalEffect:"",coin1Effect:"[적중시] 다음 턴에 호흡 3 얻음"},skill2:{name:"두의틀기",type:"참격",resource:"분노",skillSeq:2,skillPower:7,coinPower:1,coinNum:2,normalEffect:"[합 승리시] 다음 턴에 자신의 호흡 횟수 2 증가"},skill3:{name:"이면찬자",type:"참격",resource:"질투",skillSeq:3,skillPower:8,coinPower:1,coinNum:3,normalEffect:"",coin1Effect:"[앞면 적중시] 다음 턴에 호흡 2 얻음",coin2Effect:"크리티컬 발동 시 피해량 +50%"},defSkill:{name:"반격",type:"반격",resource:"오만",skillSeq:4,skillPower:10,coinPower:8,coinNum:1,normalEffect:""}},
  {id:79,name:"개화 E.G.O::동백",affiliation:"기술해방연합",grade:3,status:{life:"203",speed:"3-7",defend:"56(-4)"},skill1:{name:"움트는 봉우리",type:"관통",resource:"탐식",skillSeq:1,skillPower:3,coinPower:2,coinNum:3,normalEffect:"[사용시] 진동 횟수 3을 얻음",coin2Effect:"[적중시] 다음 턴에 침잠 횟수 1 증가",coin3Effect:"[적중시] 다음 턴에 침잠 횟수 1 증가"},skill2:{name:"찰나의 꽃바람",type:"타격",resource:"나태",skillSeq:2,skillPower:4,coinPower:4,coinNum:3,normalEffect:"[전투 시작시] 자신의 진동 횟수를 6 소모하여 공격 가중치 3 스킬로 변경",coin1Effect:"[적중시] 다음 턴에 침잠 2 부여",coin2Effect:"[적중시] 다음 턴에 침잠 2 부여",coin3Effect:"[적중시] 다음 턴에 침잠 2 부여"},skill3:{name:"피를 머금은 향기",type:"관통",resource:"오만",skillSeq:3,skillPower:6,coinPower:4,coinNum:3,normalEffect:"[합 패배] 정신력 20 감소\n[사용시] 진동 횟수 6을 얻음",coin1Effect:"[적중시] 침잠 횟수 1 증가",coin2Effect:"[적중시] 침잠 횟수 1 증가",coin3Effect:"[적중시] 대상의 침잠이 6 이상이면, 침잠쇄도\n[적중시] 자신의 진동 횟수가 10 이상이면, 피해량의 30%만큼 추가 피해"},defSkill:{name:"흩날리는 잔향",type:"회피",resource:"없음",skillSeq:4,skillPower:4,coinPower:10,coinNum:1,normalEffect:"[회피 성공시] 침잠 1 부여"}},
  {id:80,name:"어금니 사무소 해결사",affiliation:"어금니 사무소",grade:2,status:{life:"224",speed:"4-7",defend:"58(-2)"},skill1:{name:"침착하게",type:"관통",resource:"색욕",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"이 스킬이 버려지면 자신의 진동 횟수 4 증가\n[사용시] 자신의 진동 횟수 2 증가",coin2Effect:"[적중시] 진동 횟수 2 증가"},skill2:{name:"도박수",type:"타격",resource:"나태",skillSeq:2,skillPower:4,coinPower:12,coinNum:1,normalEffect:"이 스킬이 버려지면 자신의 진동 횟수 4 증가\n[사용시] 자신의 모든 스킬 슬롯에서 등급이 가장 낮은 스킬 1개를 버림",coin1Effect:"[적중시] 진동 횟수 2 증가\n[적중시] 자신의 진동 횟수가 5 이상일 때, 진동 폭발"},skill3:{name:"어금니 갈기",type:"타격",resource:"분노",skillSeq:3,skillPower:4,coinPower:3,coinNum:3,normalEffect:"[사용시] 자신의 모든 스킬 슬롯에서 등급이 가장 낮은 스킬 1개를 버림\n[사용시] 자신의 진동 횟수 10을 소모해서 코인 위력 +1",coin1Effect:"[적중시] 진동 4 부여\n스킬 사용 시 진동 횟수를 소모했으면, 진동 폭발",coin3Effect:"[앞면 적중시] 방어 레벨 감소 2 부여\n스킬 사용 시 진동 횟수를 소모했으면, 진동 폭발"},defSkill:{name:"가드",type:"방어",resource:"없음",skillSeq:4,skillPower:10,coinPower:2,coinNum:1,normalEffect:"[사용시] 자신의 모든 스킬 슬롯에서 등급이 가장 낮은 스킬 1개를 버림"}},
  {id:81,name:"W사 3등급 정리 요원",affiliation:"W사",grade:3,status:{life:"243",speed:"3-7",defend:"58(-2)"},skill1:{name:"차원 긋기",type:"참격",resource:"나태",skillSeq:1,skillPower:5,coinPower:6,coinNum:1,normalEffect:"[사용시] 자신의 충전 횟수 2 증가",coin1Effect:"[적중시] 자신의 충전 횟수 2 증가\n[앞면 적중시] 파열 2 부여"},skill2:{name:"에너지 순환",type:"관통",resource:"탐식",skillSeq:2,skillPower:5,coinPower:5,coinNum:2,normalEffect:"[사용시] 자신의 충전 횟수 6 증가\n충전 횟수가 10 이상이면, 코인 위력 +1",coin1Effect:"[적중시] 다음 턴에 속박 1 부여",coin2Effect:"[적중시] 파열 3 부여\n[적중시] 자신의 충전 횟수가 10 이상이면, 파열 3 부여"},skill3:{name:"차원의 틈",type:"관통",resource:"우울",skillSeq:3,skillPower:5,coinPower:4,coinNum:3,normalEffect:"[사용시] 충전 횟수가 15 미만이면, 충전 횟수를 10 소모하여 코인 위력 +1\n[사용시] 충전 횟수를 15 소모하여 코인 위력 +2",coin1Effect:"[앞면 적중시] 파열 1 부여",coin2Effect:"[앞면 적중시] 파열 1 부여",coin3Effect:"[적중시] 스킬 사용시 소모한 충전 횟수 5 당 파열 2 부여(최대 6)\n[적중시] 스킬 사용시 충전 횟수 15 소모하였으면, 차원 균열 2 부여\n[적 처치 시] 충전 역장 3 얻음"},defSkill:{name:"텅 빈 차원",type:"회피",resource:"우울",skillSeq:4,skillPower:4,coinPower:10,coinNum:1,normalEffect:"충전 횟수 5 당 기본 위력 +1(최대 2)\n[회피 성공 시] 다음 턴에 처음으로 스킬로 부여하는 파열 +1(턴 당 최대 증가량: 3)"}},
  {id:82,name:"피쿼드호 일등 항해사",affiliation:"피쿼드호",grade:2,status:{life:"212",speed:"4-7",defend:"57(-3)"},skill1:{name:"후벼파기",type:"관통",resource:"오만",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"[사용시] 자신의 호흡 횟수 2 증가",coin2Effect:"[앞면 적중시] 다음 턴에 속박 1 부여\n[적중시] 출혈 2 부여"},skill2:{name:"쑤시고 쑤시기",type:"관통",resource:"질투",skillSeq:2,skillPower:4,coinPower:4,coinNum:2,normalEffect:"[사용시] 자신의 호흡 횟수 2 증가\n자신의 호흡이 5 이상이면, 합 위력 +2",coin1Effect:"[앞면 적중시] 호흡 2 얻음",coin2Effect:"[적중시] 출혈 1 부여\n[크리티컬 적중시] 이 코인 재사용 (최대 1회)"},skill3:{name:"급습",type:"관통",resource:"탐식",skillSeq:3,skillPower:4,coinPower:6,coinNum:2,normalEffect:"[사용시] 호흡 5 얻음",coin1Effect:"[앞면 적중시] 자신의 호흡 횟수 2 증가",coin2Effect:"[적중시] 출혈 4 부여\n[크리티컬 적중시] 출혈 횟수 4 증가"},defSkill:{name:"회피",type:"회피",resource:"없음",skillSeq:4,skillPower:2,coinPower:10,coinNum:1,normalEffect:""}},
  {id:86,name:"남부 디에치 협회 4과",affiliation:"디에치 협회",grade:2,status:{life:"251",speed:"4-6",defend:"63(+3)"},skill1:{name:"지식 소모",type:"관통",resource:"탐식",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"이 스킬이 버려지면 (탐구한 지식 × 최대 체력의 3%)만큼 보호막을 얻음\n[사용시] 자신의 모든 스킬 슬롯에서 등급이 가장 높은 스킬 1개를 버림",coin1Effect:"[적중시] 탐구한 지식만큼 흐트러짐 회복",coin2Effect:"[적중시] 탐구한 지식만큼 흐트러짐 회복"},skill2:{name:"잠궈닫기",type:"타격",resource:"색욕",skillSeq:2,skillPower:4,coinPower:3,coinNum:3,normalEffect:"이 스킬이 버려지면 (탐구한 지식 × 최대 체력의 5%)만큼 보호막을 얻음\n[사용시] 자신의 모든 스킬 슬롯에서 등급이 가장 높은 스킬 1개를 버림\n[사용시] 다음 턴에 이 슬롯이 도발치 3 얻음",coin2Effect:"[앞면 적중시] 탐구한 지식만큼 침잠 부여",coin3Effect:"[앞면 적중시] 탐구한 지식만큼 침잠 부여"},skill3:{name:"지식의 가호",type:"타격",resource:"나태",skillSeq:3,skillPower:4,coinPower:2,coinNum:4,normalEffect:"이 스킬이 버려지면 (탐구한 지식 × 최대 체력의 9%)만큼 보호막을 얻음\n[사용시] 다음 턴에 이 슬롯이 도발치 8 얻음",coin4Effect:"[적중시] 침잠 횟수 2 증가"},defSkill:{name:"탐구 몰입",type:"방어",resource:"없음",skillSeq:4,skillPower:10,coinPower:6,coinNum:1,normalEffect:"[사용시] 자신의 모든 스킬 슬롯에서 무작위 스킬 2개를 등급이 낮은 순으로 버림\n[사용시] 다음 턴에 이 슬롯이 도발치 3 얻음"}},
  {id:100,name:"약지 점묘파 스튜던트",affiliation:"약지",grade:3,status:{life:"214",speed:"3-7",defend:"58(-2)"},skill1:{name:"덧칠",type:"관통",resource:"우울",skillSeq:1,skillPower:2,coinPower:3,coinNum:3,normalEffect:"",coin2Effect:"[앞면 적중시] 화상, 출혈, 진동, 파열, 침잠 중 무작위 1개 효과의 횟수 2 증가",coin3Effect:"[적중시] 출혈 2 부여"},skill2:{name:"혈점묘화",type:"관통",resource:"색욕",skillSeq:2,skillPower:8,coinPower:8,coinNum:1,normalEffect:"대상의 출혈 6 당 합 위력 +1",coin1Effect:"[적중시] 20% 확률로 코인 재사용\n[적중시] 출혈 횟수 1 증가"},skill3:{name:"핏방울 채색",type:"관통",resource:"나태",skillSeq:3,skillPower:3,coinPower:3,coinNum:4,normalEffect:"대상의 출혈 6 당 합 위력 +1",coin2Effect:"[적중시] 출혈 횟수 1 증가",coin3Effect:"[적중시] 출혈 1 부여",coin4Effect:"대상이 보유한 부정적인 효과 1개당 피해량 +15% (최대 75%)"},defSkill:{name:"붓 털기",type:"방어",resource:"없음",skillSeq:4,skillPower:10,coinPower:4,coinNum:1,normalEffect:"대상의 출혈 1 당 기본 위력 +1 (최대 10)"}},
  {id:120,name:"로보토미 E.G.O::엄숙한 애도",affiliation:"로보토미 본사",grade:3,status:{life:"203",speed:"3-8",defend:"62(+2)"},skill1:{name:"떠난이에게 축하를",type:"관통",resource:"오만",skillSeq:1,skillPower:4,coinPower:4,coinNum:2,normalEffect:"대상의 침잠과 모든 나비의 합이 6 이상이면, 코인 위력 +1\n[합 승리시] 침잠 횟수 2 증가",coin1Effect:"산나비·죽은나비 1 소모\n[적중시] 소모한 산나비·죽은나비만큼 나비 부여",coin2Effect:"산나비·죽은나비 1 소모\n[적중시] 소모한 산나비·죽은나비만큼 나비 부여"},skill2:{name:"남은자에게 엄숙한 애도를",type:"관통",resource:"우울",skillSeq:2,skillPower:4,coinPower:6,coinNum:2,normalEffect:"대상의 침잠과 모든 나비의 합 6 당 코인 위력 +1 (최대 2)",coin1Effect:"산나비·죽은나비 5 소모\n[적중시] 소모한 산나비·죽은나비만큼 나비 부여",coin2Effect:"산나비·죽은나비 1 소모\n[적중시] 소모한 산나비·죽은나비만큼 나비 부여"},skill3:{name:"이상으로 장례는 이상이오",type:"관통",resource:"나태",skillSeq:3,skillPower:4,coinPower:3,coinNum:4,normalEffect:"보유한 산나비·죽은나비 10 당 기본 위력 +1 (최대 2)\n[합 승리시] 침잠 횟수 3 증가\n[공격 종료시] 재장전",coin1Effect:"산나비·죽은나비 1 소모",coin2Effect:"산나비·죽은나비 6 소모",coin3Effect:"보유한 산나비·죽은나비 전부 소모",coin4Effect:"[적중시] 대상의 모든 나비만큼 우울 피해"},defSkill:{name:"관에서나비가날아오리라",type:"방어",resource:"없음",skillSeq:4,skillPower:10,coinPower:4,coinNum:1,normalEffect:"[전투 시작시] 재장전 (턴 당 1회)"}},
  {id:133,name:"LCE E.G.O::초롱",affiliation:"LCE",grade:2,status:{life:"224",speed:"4-6",defend:"60(0)"},skill1:{name:"E.G.O는 제식 장비라 할지라도",type:"타격",resource:"나태",skillSeq:1,skillPower:4,coinPower:3,coinNum:2,normalEffect:"[전투 시작시] 자신을 타겟팅한 스킬의 수만큼 합 패배 시 최종 위력이 증가 (최대 2)",coin1Effect:"파괴 불가 코인\n[적중시] 파열 1 부여",coin2Effect:"파괴 불가 코인\n[적중시] 파열 1 부여"},skill2:{name:"로보토미때의 E.G.O보다",type:"관통",resource:"질투",skillSeq:2,skillPower:8,coinPower:6,coinNum:1,normalEffect:"[전투 시작시] 자신을 타켓팅 한 스킬의 수 만큼 합 패배 시 최종 위력이 증가 (최대 3)",coin1Effect:"파괴 불가 코인\n[적중시] 파열 횟수 2 증가"},skill3:{name:"본체의 특징을 더 유연하게 활용 가능하오",type:"타격",resource:"탐식",skillSeq:3,skillPower:16,coinPower:-5,coinNum:3,normalEffect:"자신의 잃은 체력 1% 당 피해량 +0.5%",coin1Effect:"[적중시] 파열 횟수 2 증가\n[적중시] 다음 턴에 속박 2 부여",coin2Effect:"[적중시] 파열 1 부여",coin3Effect:"[적중시] 파열 1 부여"},defSkill:{name:"잡아먹힐 수 있소",type:"반격",resource:"탐식",skillSeq:4,skillPower:10,coinPower:5,coinNum:1,normalEffect:"[전투 시작시] 미끼 요정 2 얻음 (턴 당 1회)",coin1Effect:"[적중시] 파열 횟수 2 증가"}},
  {id:137,name:"남부 리우 협회 3과",affiliation:"리우 협회",grade:3,status:{life:"230",speed:"4-6",defend:"62(+2)"},skill1:{name:"염참",type:"참격",resource:"나태",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"대상의 화상 3 이상이면, 코인 위력 +1",coin1Effect:"[적중시] 화상 1 부여",coin2Effect:"[적중시] 화상 1 부여"},skill2:{name:"정면돌파",type:"참격",resource:"분노",skillSeq:2,skillPower:3,coinPower:4,coinNum:3,normalEffect:"대상의 화상 6 당, 코인 위력 +1 (최대 2)",coin1Effect:"[적중시] 화상 2 부여",coin2Effect:"[적중시] 화상 2 부여",coin3Effect:"대상의 화상당, 피해량 +2.5% (최대 30%)\n[적중시] 대상의 화상이 6 이상이면, 화상 횟수 2 증가"},skill3:{name:"검의 흐름",type:"참격",resource:"질투",skillSeq:3,skillPower:4,coinPower:3,coinNum:4,normalEffect:"대상의 화상 6 이상이면, 코인 위력 +1",coin1Effect:"[적중시] 화상 1 부여",coin2Effect:"[적중시] 화상 1 부여",coin3Effect:"[적중시] 화상 2 부여",coin4Effect:"대상의 화상당, 피해량 +2% (최대 60%)"},defSkill:{name:"염반",type:"반격",resource:"분노",skillSeq:4,skillPower:4,coinPower:3,coinNum:2,normalEffect:"[피격 직전] 대상의 화상만큼 보호막을 얻음 (최대 10, 턴 당 1회)",coin1Effect:"[앞면 적중시] 화상 1 부여",coin2Effect:"[앞면 적중시] 화상 1 부여"}},
  {id:151,name:"N사 E.G.O::흉탄",affiliation:"N사",grade:3,status:{life:"203",speed:"4-7",defend:"62(+2)"},skill1:{name:"헛점 파악",type:"타격",resource:"분노",skillSeq:1,skillPower:4,coinPower:6,coinNum:1,normalEffect:"[사용시] 자신의 찢어진 추억당, 피해량 +10% (최대 70%)",coin1Effect:"[적중시] 자신의 호흡 횟수 1 증가\n[크리티컬 적중시] 출혈 횟수 1 증가"},skill2:{name:"꿰뚫으리라",type:"관통",resource:"색욕",skillSeq:2,skillPower:3,coinPower:6,coinNum:2,normalEffect:"[사용시] 자신의 찢어진 추억당, 피해량 +10% (최대 70%)",coin1Effect:"[적중시] 호흡 2 얻음\n[크리티컬 적중시] 출혈 2 부여",coin2Effect:"파괴 불가 코인\n[적중시] 호흡 2 얻음"},skill3:{name:"대상 조정 사격",type:"관통",resource:"오만",skillSeq:3,skillPower:3,coinPower:7,coinNum:2,normalEffect:"[전투 시작시] 체력이 가장 낮은 대상 우선 공격",coin1Effect:"파괴 불가 코인",coin2Effect:"파괴 불가 코인\n자신의 찢어진 추억당, 피해량 +15% (최대 105%)"},defSkill:{name:"전방 지원",type:"관통",resource:"오만",skillSeq:4,skillPower:5,coinPower:6,coinNum:1,normalEffect:"합 가능 반격",coin1Effect:"[적중시] 호흡 2 얻음"}},
  {id:157,name:"흑수 - 오 필두",affiliation:"흑수",grade:3,status:{life:"254",speed:"4-7",defend:"65(+5)"},skill1:{name:"베어 무너뜨리리",type:"참격",resource:"나태",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"[사용시] 자신의 속도가 대상보다 높으면, 코인 위력 +1",coin1Effect:"[적중시] 파열 1 부여",coin2Effect:"[적중시] 파열 횟수 1 증가\n[적중시] 진동 1 부여"},skill2:{name:"월도격",type:"참격",resource:"질투",skillSeq:2,skillPower:4,coinPower:5,coinNum:2,normalEffect:"자신의 속도가 대상보다 높으면, 코인 위력 +1",coin1Effect:"[적중시] 파열 횟수 2 증가\n[적중시] 진동 3 부여",coin2Effect:"[적중시] 진동 폭발. 대상의 진동 횟수 1 감소"},skill3:{name:"선봉주파",type:"참격",resource:"탐식",skillSeq:3,skillPower:5,coinPower:4,coinNum:3,normalEffect:"자신의 속도가 대상보다 높으면 최종 위력 +1",coin1Effect:"[적중시] 파열 2 부여\n[적중시] 진동 2 부여",coin2Effect:"[적중시] 다음 턴에 속박 1 부여",coin3Effect:"[적중시] 진동 폭발. 대상의 진동 횟수 1 감소"},defSkill:{name:"돌진 전, 가다듬겠소",type:"방어",resource:"없음",skillSeq:4,skillPower:3,coinPower:10,coinNum:1,normalEffect:"합 가능 가드\n[전투 시작시] 다음 턴에 각력 [오] 3 얻음 (턴 당 1회)",coin1Effect:"파괴 불가 코인"}},
  {id:174,name:"거미집 검지 아비",affiliation:"검지",grade:3,status:{life:"248",speed:"3-8",defend:"62(+2)"},skill1:{name:"얼어붙은 피를 삼백삼십 휘감아",type:"타격",resource:"탐식",skillSeq:1,skillPower:3,coinPower:4,coinNum:2,normalEffect:"[사용시] (해금 단계 - 1)만큼 마지막 코인부터 파괴 불가 코인으로 변경됨",coin2Effect:"[적중시] 호흡 2 얻음\n[파괴되지 않고 적중시] 침잠 1 부여"},skill2:{name:"소리 없이 손뼉 쳐 즐기고",type:"관통",resource:"오만",skillSeq:2,skillPower:4,coinPower:4,coinNum:3,normalEffect:"[사용시] 해금 단계만큼 마지막 코인부터 파괴 불가 코인으로 변경됨",coin2Effect:"[적중시] 침잠 2 부여",coin3Effect:"[적중시] 자신의 호흡 횟수 1 증가"},skill3:{name:"날 세워 칼을 웃거라",type:"참격",resource:"우울",skillSeq:3,skillPower:3,coinPower:3,coinNum:4,normalEffect:"턴 시작 시 대행 [헤르메스]가 9면, Furioso-Replica로 변경됨",coin2Effect:"[적중시] 호흡 2 얻음",coin3Effect:"[적중시] 침잠 2 부여",coin4Effect:"해금 단계 1당 피해량 +10% (최대 30%)"},defSkill:{name:"예측할 수 없는 변덕으로",type:"회피",resource:"없음",skillSeq:4,skillPower:4,coinPower:10,coinNum:1,normalEffect:"[전투 시작시] 호흡 횟수 2 증가 (턴당 1회)"}},
]

async function main() {
  // Get existing identities
  const { data: existing } = await sb.schema('limbus').from('identities').select('id, name_kr').eq('sinner_id', 'yi-sang')
  const nameToId = {}
  existing.forEach(e => nameToId[e.name_kr] = e.id)
  console.log('Found', existing.length, 'existing identities')

  // 1. Update identities with accurate stats
  let updated = 0
  for (const c of crawled) {
    const dbId = nameToId[c.name]
    if (!dbId) { console.log('NOT FOUND:', c.name); continue }

    const speed = c.status.speed.split('-')
    const defMatch = c.status.defend.match(/^(\d+)/)

    const { error } = await sb.schema('limbus').from('identities').update({
      hp: parseInt(c.status.life),
      speed_min: parseInt(speed[0]),
      speed_max: parseInt(speed[1]),
      def_level: defMatch ? parseInt(defMatch[1]) : 0,
      keywords: [c.affiliation],
    }).eq('id', dbId)

    if (error) console.log('UPDATE ERROR:', c.name, error.message)
    else updated++
  }
  console.log('Updated identities:', updated)

  // 2. Delete existing skills for yi-sang identities
  const ids = Object.values(nameToId)
  for (const id of ids) {
    await sb.schema('limbus').from('skills').delete().eq('identity_id', id)
  }
  console.log('Cleared old skills')

  // 3. Insert skills
  let inserted = 0
  for (const c of crawled) {
    const dbId = nameToId[c.name]
    if (!dbId) continue

    const skills = [c.skill1, c.skill2, c.skill3, c.defSkill].filter(Boolean)

    for (const sk of skills) {
      // Build description from coin effects
      const effects = []
      if (sk.normalEffect) effects.push(sk.normalEffect)
      for (let i = 1; i <= 9; i++) {
        const eff = sk['coin' + i + 'Effect']
        if (eff) effects.push('[코인 ' + i + '] ' + eff)
      }

      const sinAff = SIN_MAP[sk.resource]

      const { error } = await sb.schema('limbus').from('skills').insert({
        identity_id: dbId,
        name: sk.name,
        skill_type: TYPE_MAP[sk.type] || sk.type,
        sin_affinity: sinAff || 'sloth',
        coins: sk.coinNum,
        base_power: sk.skillPower,
        coin_power: sk.coinPower,
        description: effects.join('\n'),
        skill_order: sk.skillSeq,
      })

      if (error) console.log('SKILL INSERT ERROR:', sk.name, error.message)
      else inserted++
    }
  }
  console.log('Inserted skills:', inserted)
}

main()
