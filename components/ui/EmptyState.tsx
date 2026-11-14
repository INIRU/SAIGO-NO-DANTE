/** A quiet one-line note where a list or section has nothing to show. */
export default function EmptyState({ text }: { text: string }) {
  return (
    <p className="border-l-2 border-[#2e2417] py-1 pl-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">{text}</p>
  )
}
