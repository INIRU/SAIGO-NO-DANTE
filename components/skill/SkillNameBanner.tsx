/** Shared striped nameplate. Its clipped tail and text stay within narrow cards. */
export default function SkillNameBanner({ name, sinColor, fontSize = '0.875rem' }: {
  name: string; sinColor: string; fontSize?: string
}) {
  return (
    <div data-skill-name-banner className="overflow-hidden mb-1" style={{
      width: 'fit-content', maxWidth: '100%', fontSize,
      clipPath: 'polygon(0 0, calc(100% - 0.8em) 0, 100% 100%, 0 100%)',
      color: '#e8dcc8', backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${sinColor}30 1.5em)`,
    }}>
      <div style={{
        padding: '0.1em 0 0.1em 0.3em',
        backgroundImage: `linear-gradient(290deg, transparent 2em, ${sinColor}40 2em, ${sinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${sinColor}40 2.24em, ${sinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${sinColor}40 2.48em, ${sinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${sinColor}40 2.72em)`,
        textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
      }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 800,
          paddingRight: '3.5em', overflowWrap: 'anywhere', wordBreak: 'keep-all' }}>
          {name}
        </span>
      </div>
    </div>
  )
}
