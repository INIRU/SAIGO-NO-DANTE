import PageError from '@/components/ui/PageError'

export default function NotFound() {
  return (
    <PageError
      statusCode="404"
      eyebrow="bus stop missing"
      quote="승객이 길을 잃었어."
      subQuote="여긴 아무것도 없어. 카론도 잘 모르는 곳이야."
      homeHref="/"
      homeLabel="컴퍼니로 돌아가기"
      variant="warning"
    />
  )
}
