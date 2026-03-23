import Image from 'next/image'

export default function MetaItem({
  label,
  value,
  valueColor = '#999',
  icon,
}: {
  label: string
  value: string
  valueColor?: string
  icon?: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[0.625rem]" style={{ color: '#555', fontFamily: 'var(--font-heading)' }}>
        {label}
      </span>
      {icon && <Image src={icon} alt="" width={12} height={12} />}
      <span className="text-[0.6875rem]" style={{ color: valueColor }}>
        {value}
      </span>
    </div>
  )
}
