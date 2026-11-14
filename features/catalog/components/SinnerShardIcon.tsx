import Image from 'next/image'
import { getSinnerShardIconUrl } from '@/lib/utils/images'

/** Native sinner shard, without a glass overlay; decorative beside its label. */
export default function SinnerShardIcon({ sinnerId }: { sinnerId: string }) {
  const src = getSinnerShardIconUrl(sinnerId)
  if (!src) return null
  return <span data-sinner-shard={sinnerId} aria-hidden="true" className="relative inline-block h-8 w-8 shrink-0 isolate align-middle">
    <Image src={src} alt="" width={64} height={64} className="absolute inset-0 h-full w-full object-contain" />
  </span>
}
