/** Assist mode reads the Korean game client only, so it is offered only on the Korean site. */
export const assistAvailable = (locale: string | null | undefined) => locale === 'ko'
