// The third-party fonts and runtime the site ships (the /licenses page). Holders are the fonts' own copyright fields;
// `license` is a message key of licensesPage when it is not a license's proper name.
export type LicenseItem = { name: string; holder: string; license: string; url: string }
export type LicenseGroup = { group: 'fonts' | 'software'; items: LicenseItem[] }

const OFL = 'SIL Open Font License 1.1'
const OFL_URL = 'https://openfontlicense.org/open-font-license-official-text/'

export const LICENSES: LicenseGroup[] = [
  {
    group: 'fonts',
    items: [
      { name: 'Pretendard', holder: 'Kil Hyung-jin', license: OFL, url: '/fonts/Pretendard-LICENSE.txt' },
      { name: 'M PLUS 1p', holder: 'The M+ Project Authors', license: OFL, url: '/fonts/licenses/MPLUS1p-OFL.txt' },
      { name: 'Corporate Logo', holder: 'LOGOTYPE.JP', license: OFL, url: '/fonts/licenses/CorporateLogo-OFL.txt' },
      { name: 'Noto Sans Mono', holder: 'The Noto Project Authors', license: OFL, url: '/fonts/licenses/NotoSansMono-OFL.txt' },
      { name: 'Paperlogy', holder: 'PT&', license: OFL, url: 'https://freesentation.blog/paperlogyfont' },
      { name: 'Bebas Kai', holder: 'Dharma Type', license: OFL, url: OFL_URL },
      { name: 'Mikodacs', holder: 'gluk', license: OFL, url: OFL_URL },
      { name: 'KOTRA Bold', holder: 'KOTRA', license: 'freeFont', url: 'https://www.kotra.or.kr' },
      { name: 'S-Core Dream', holder: 'S-Core Co., Ltd.', license: 'freeFont', url: 'https://s-core.co.kr' },
      { name: 'Perfect DOS VGA 437', holder: 'Zeh Fernando', license: 'freeFont', url: 'http://www.fatorcaos.com.br' },
    ],
  },
  {
    group: 'software',
    items: [
      { name: 'Spine Runtimes', holder: 'Esoteric Software LLC', license: 'Spine Runtimes License', url: '/licenses/spine-runtimes.txt' },
    ],
  },
]
