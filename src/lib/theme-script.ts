// Shared by the server layout (the inline script) and components/theme.tsx.
export const THEME_KEY = "theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before first paint, so a dark page never flashes light.
 * Mirrors applyTheme in components/theme.tsx.
 */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
