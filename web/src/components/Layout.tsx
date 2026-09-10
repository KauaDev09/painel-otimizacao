import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { hasConsent, injectFonts, pingAccess } from '../lib/consent';
import CookieConsent from './CookieConsent';
import Footer from './Footer';
import Nav from './Nav';
import { ToastProvider } from './Toast';

function footerVariant(pathname: string): 'full' | 'minimal' | 'none' {
  if (['/login', '/checkout', '/sucesso'].includes(pathname)) return 'none';
  if (['/termos', '/privacidade'].includes(pathname)) return 'minimal';
  return 'full';
}

function navMenu(pathname: string) {
  return !['/login', '/checkout', '/sucesso', '/conta'].includes(pathname);
}

export default function Layout() {
  const location = useLocation();
  const footer = footerVariant(location.pathname);
  const showMenu = navMenu(location.pathname);

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (hasConsent()) {
      pingAccess(location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  return (
    <ToastProvider>
      <Nav showMenu={showMenu} />
      <Outlet />
      {footer !== 'none' && <Footer variant={footer} />}
      <CookieConsent />
    </ToastProvider>
  );
}

export function bootConsent() {
  if (hasConsent()) {
    injectFonts();
    pingAccess();
  } else {
    document.documentElement.classList.add('cookie-wait');
  }
}
