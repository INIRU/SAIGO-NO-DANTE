import Image from 'next/image'
import { EgoCardRows, type EgoSlotItem } from '@/components/cards/EgoSlotRows'
import { getSinnerLogoUrl } from '@/lib/utils/images'
import styles from '@/features/decks/components/EgoBackPanel.module.css'
import boardStyles from '@/features/decks/components/FormationBoard.module.css'

/**
 * The back of a formation card: a flat panel with the sinner's logo and a name (identity, or the sinner when there is none) over
 * that sinner's five E.G.O rows. Sizes are in cqi, so it needs a container-type: inline-size ancestor as wide as the card
 * (the flip box on the deck board, `.box` here for the builders).
 */
export default function EgoBackPanel({ sinnerId, name, egos, onEgoClick, className, inert }: {
  sinnerId: string
  name: string
  egos: Record<string, EgoSlotItem | undefined>
  onEgoClick?: (egoId: string) => void
  className?: string
  inert?: boolean
}) {
  return (
    <span className={[styles.panel, className].filter(Boolean).join(' ')} inert={inert}>
      <span className={styles.head}>
        <Image src={getSinnerLogoUrl(sinnerId)} alt="" width={20} height={20} />
        <span>{name}</span>
      </span>
      <EgoCardRows egos={egos} onEgoClick={onEgoClick} />
    </span>
  )
}

type EgoPanelBoardItem = {
  key: string
  sinnerId: string
  name: string
  egos: Record<string, EgoSlotItem | undefined>
  disabled?: boolean
  ariaLabel: string
  onClick: () => void
}

/** The builders' E.G.O board: one back panel per sinner on the formation board's grid, each a button (opens that sinner's E.G.O picker). */
export function EgoPanelBoard({ items }: { items: EgoPanelBoardItem[] }) {
  return (
    <ol className={boardStyles.grid}>
      {items.map(item => (
        <li key={item.key}>
          <button
            type="button"
            className={boardStyles.tile}
            onClick={item.onClick}
            disabled={item.disabled}
            aria-label={item.ariaLabel}
            style={{ opacity: item.disabled ? 0.5 : 1, transition: 'opacity 0.16s ease, filter 0.15s ease' }}
          >
            <span className={styles.box}>
              <EgoBackPanel sinnerId={item.sinnerId} name={item.name} egos={item.egos} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
