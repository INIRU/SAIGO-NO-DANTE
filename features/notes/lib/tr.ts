/** The Korean, Japanese or English line for a locale (anything but ja/en reads Korean). */
export const tr = (lang: string, ko: string, ja: string, en: string) => lang === 'ja' ? ja : lang === 'en' ? en : ko
