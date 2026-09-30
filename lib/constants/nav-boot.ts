/** localStorage key: '1' when the last resolved session was signed in (written by Navbar). */
export const NAV_AUTH_HINT_KEY = 'nav-auth-hint'

/**
 * Runs in <head> before first paint. The static shell cannot know the platform or the session, so it marks <html>
 * and CSS picks the ⌘K/Ctrl K hint and the avatar/login slot without a post-hydration swap.
 */
export const NAV_BOOT_SCRIPT = `try{var d=document.documentElement;if(/Mac|iPhone|iPad/.test(navigator.userAgent))d.setAttribute('data-mac','');if(localStorage.getItem('${NAV_AUTH_HINT_KEY}')==='1')d.setAttribute('data-auth-hint','')}catch(e){}`
