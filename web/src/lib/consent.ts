export const CONSENT_KEY = 's4_cookie_consent';
const LEGACY_CONSENT_KEY = 'orion_cookie_consent';

const FONTS =
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:opsz,wght@14..32,400;14..32,500;14..32,600;14..32,700&display=swap';

export function hasConsent() {
  try {
    if (localStorage.getItem(CONSENT_KEY) === 'accepted') return true;
    if (localStorage.getItem(LEGACY_CONSENT_KEY) === 'accepted') {
      localStorage.setItem(CONSENT_KEY, 'accepted');
      localStorage.removeItem(LEGACY_CONSENT_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function acceptConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    localStorage.removeItem(LEGACY_CONSENT_KEY);
  } catch {
    /* ignore */
  }
  document.documentElement.classList.remove('cookie-wait');
}

export function injectFonts() {
  if (document.getElementById('s4-fonts')) return;

  const pre1 = document.createElement('link');
  pre1.rel = 'preconnect';
  pre1.href = 'https://fonts.googleapis.com';

  const pre2 = document.createElement('link');
  pre2.rel = 'preconnect';
  pre2.href = 'https://fonts.gstatic.com';
  pre2.crossOrigin = 'anonymous';

  const link = document.createElement('link');
  link.id = 's4-fonts';
  link.rel = 'stylesheet';
  link.href = FONTS;

  document.head.appendChild(pre1);
  document.head.appendChild(pre2);
  document.head.appendChild(link);
}

export function pingAccess(path?: string) {
  try {
    const p = path ?? location.pathname + location.search;
    fetch('/api/v1/public/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page', path: p }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
