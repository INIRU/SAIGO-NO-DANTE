export default function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-[#c8900a] focus:px-4 focus:py-2 focus:text-black focus:font-bold focus:outline-none"
    >
      본문으로 건너뛰기
    </a>
  )
}
