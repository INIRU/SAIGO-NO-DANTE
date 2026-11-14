// Safari before 14.1 only has the prefixed constructor.
interface Window {
  webkitAudioContext?: typeof AudioContext
}
