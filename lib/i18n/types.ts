export type SupportedLang = 'ko' | 'en' | 'ja';

export const SUPPORTED_LANGS: { value: SupportedLang; label: string; nativeLabel: string }[] = [
  { value: 'ko', label: 'Korean', nativeLabel: '한국어' },
  { value: 'en', label: 'English', nativeLabel: 'English' },
  { value: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

export const DEFAULT_LANG: SupportedLang = 'en';
