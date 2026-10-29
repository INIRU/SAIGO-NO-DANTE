// The third-party fonts and runtime the site ships (the /licenses page), checked against each distributor's own terms
// (2026-10-29). Holders are the fonts' own copyright fields. `license` is a license's proper name; `licenseKey` a message
// of licensesPage for the distributors' own terms, which have no short name of their own.
export type LicenseKey = 'kogl1' | 'scoreFont' | 'dafontFree' | 'authorFree'
export type LicenseItem = { name: string; holder: string; url: string } & ({ license: string } | { licenseKey: LicenseKey })
export type LicenseGroup = { group: 'fonts' | 'software'; items: LicenseItem[] }

const OFL = 'SIL Open Font License 1.1'

export const LICENSES: LicenseGroup[] = [
  {
    group: 'fonts',
    items: [
      { name: 'Pretendard', holder: 'Kil Hyung-jin', license: OFL, url: '/fonts/Pretendard-LICENSE.txt' },
      { name: 'M PLUS 1p', holder: 'The M+ Project Authors', license: OFL, url: '/fonts/licenses/MPLUS1p-OFL.txt' },
      // ver3: the kana of LOGOTYPE.JP over Source Han Sans, "源ノ角ゴシックと同じ SIL Open Font License 1.1" (logotype.jp)
      { name: 'Corporate Logo', holder: 'LOGOTYPE.JP, Adobe (Source Han Sans)', license: OFL, url: '/fonts/licenses/CorporateLogo-OFL.txt' },
      { name: 'Noto Sans Mono', holder: 'The Noto Project Authors', license: OFL, url: '/fonts/licenses/NotoSansMono-OFL.txt' },
      // The distributor says OFL without a version
      { name: 'Paperlogy', holder: 'PT&', license: 'SIL Open Font License', url: 'https://freesentation.blog/paperlogyfont' },
      { name: 'Bebas Kai', holder: 'Dharma Type', license: OFL, url: 'https://github.com/dharmatype/Bebas' },
      { name: 'Mikodacs', holder: 'gluk', license: OFL, url: 'https://www.fontsquirrel.com/fonts/mikodacs' },
      // KOGL type 1 (attribution) at the Korea Copyright Commission; KOTRA: no modification or redistribution of the file
      { name: 'KOTRA Bold', holder: 'KOTRA', licenseKey: 'kogl1', url: 'https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13302258&menuNo=200023' },
      { name: 'S-Core Dream', holder: 'S-Core Co., Ltd.', licenseKey: 'scoreFont', url: 'https://s-core.co.kr/company/font/' },
      // "Trek, Classic Credits" in its name table: AJ Paglia's Excelsior Sans
      { name: 'Excelsior Sans', holder: 'AJ Paglia', licenseKey: 'dafontFree', url: 'https://www.dafont.com/excelsior-sans.font' },
      // No license file; the author: free to use in whatever you want (DaFont comments, 2014)
      { name: 'Perfect DOS VGA 437', holder: 'Zeh Fernando', licenseKey: 'authorFree', url: 'https://www.dafont.com/font-comment.php?file=perfect_dos_vga_437' },
    ],
  },
  {
    group: 'software',
    items: [
      { name: 'Spine Runtimes', holder: 'Esoteric Software LLC', license: 'Spine Runtimes License', url: '/licenses/spine-runtimes.txt' },
    ],
  },
]
