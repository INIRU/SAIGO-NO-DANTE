/**
 * Where the self-hosted site serves optimized images (next/image): the Cloudflare tunnel and its edge cache, not
 * CloudFront, which bills every request and would see over half of them as images.
 */
export const MEDIA_ORIGIN = 'https://media.saigo-no-dante.com'
