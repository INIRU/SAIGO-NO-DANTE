/** Estimated width in em: Hangul/CJK glyphs are about 1em, spaces and punctuation 0.3em, Latin letters about 0.55em. */
function visualLength(name: string) {
  let n = 0
  for (const ch of name) n += /[\u1100-\u11ff\u3000-\u9fff\uac00-\ud7a3\uff00-\uffef]/.test(ch) ? 1 : /[\s\p{P}]/u.test(ch) ? 0.3 : 0.55
  return n
}

/**
 * Shared striped nameplate. Its clipped tail and text stay within narrow cards.
 * A name that would not fit on one line first steps down one size (never below 88%), then wraps into balanced lines.
 */
export default function SkillNameBanner({ name, sinColor, fontSize = '0.875rem' }: {
  name: string; sinColor: string; fontSize?: string
}) {
  // 3.9em = the 0.3em left padding + 3.5em reserved for the striped tail, plus a little slack.
  const fitted = `min(${fontSize}, max(calc(${fontSize} * 0.88), calc(100cqi / ${(visualLength(name) + 3.9).toFixed(2)})))`
  return (
    <div style={{ containerType: 'inline-size' }}>
      <div data-skill-name-banner className="overflow-hidden mb-1" style={{
        width: 'fit-content', maxWidth: '100%', fontSize: fitted,
        clipPath: 'polygon(0 0, calc(100% - 0.8em) 0, 100% 100%, 0 100%)',
        color: '#e8dcc8', backgroundImage: `linear-gradient(255deg, transparent 1.5em, ${sinColor}30 1.5em)`,
      }}>
        <div style={{
          padding: '0.1em 0 0.1em 0.3em',
          backgroundImage: `linear-gradient(290deg, transparent 2em, ${sinColor}40 2em, ${sinColor}40 2.12em, transparent 2.12em, transparent 2.24em, ${sinColor}40 2.24em, ${sinColor}40 2.36em, transparent 2.36em, transparent 2.48em, ${sinColor}40 2.48em, ${sinColor}40 2.6em, transparent 2.6em, transparent 2.72em, ${sinColor}40 2.72em)`,
          textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
        }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontWeight: 800,
            paddingRight: '3.5em', overflowWrap: 'anywhere', wordBreak: 'keep-all', textWrap: 'balance' }}>
            {name}
          </span>
        </div>
      </div>
    </div>
  )
}
