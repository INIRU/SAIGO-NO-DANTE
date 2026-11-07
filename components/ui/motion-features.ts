import { domAnimation } from 'motion/react'

// Its own chunk, loaded by MotionProvider after the page: the animation engine stays out of every page's first load.
export default domAnimation
