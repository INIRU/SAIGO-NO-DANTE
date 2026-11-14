import type { ComponentType } from 'react'

/** 카드가 설명 한 줄을 그릴 때 쓰는 컴포넌트. 노트 문법(칩·툴팁)은 notes 기능이 알고, 카드는 모양만 받는다. */
export type NotePreviewComponent = ComponentType<{ text: string }>
