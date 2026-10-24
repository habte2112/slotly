export const en = {
  "lang.en": "English",
  "lang.am": "አማርኛ",
  "lang.label": "Language",
} as const;

export type Messages = Record<keyof typeof en, string>;