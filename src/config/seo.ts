export const SITE_NAME = 'Dip Detector';
export const SITE_TAGLINE = 'Smart Dip Detection & Sector Comparison';
export const SITE_DESCRIPTION =
  'Buy the dip smarter. Advanced stock dip detection with sector comparison to spot opportunities across timeframes.';

// Set this to your production origin (e.g., 'https://<user>.github.io/buy_the_fucking_dip/' or custom domain)
// Leave empty to omit canonical/og:url until configured.
export const SITE_URL = 'https://mocialov.github.io/buy_the_fucking_dip/';

export const DEFAULT_TITLE = `${SITE_NAME} – ${SITE_TAGLINE}`;
export const TITLE_TEMPLATE = `%s – ${SITE_NAME}`;

// Social share image (recommended size: 1200x630). Place file at public/og-image.png
// Can be customized to a full URL; by default points to SITE_URL + 'og-image.png'
export const OG_IMAGE = SITE_URL ? `${SITE_URL}og-image.png` : '';
