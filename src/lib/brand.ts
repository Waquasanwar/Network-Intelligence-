/** The product's name, wherever it is shown: page titles, the menu, sign-in, the authenticator app. */
export const APP_NAME = "Amana Network";
export const THEME_COOKIE = "amana-theme";
export type Theme = "dark" | "light";
/** Light unless the visitor has chosen dark. */
export const themeFrom = (v: string | undefined): Theme => (v === "dark" ? "dark" : "light");
