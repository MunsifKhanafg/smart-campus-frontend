import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { assetUrl } from '../api/axios.js';

// Keeps everything the browser shows OUTSIDE the page in step with the university settings, so when the head changes the
// university name or logo it changes here too, without touching any code:
//   - the browser tab title      "Fee Notices · <university name>"
//   - the tab icon (favicon)     the uploaded logo
//   - the page description and the "install / share" names (meta tags)
// (The address in the address bar is the website's own domain. That is set where the site is hosted, not in the app.)

const setMeta = (attr, key, value) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
};

// "/fee-notices" -> "Fee Notices"
const pageLabel = (path) => {
  const first = path.split('/').filter(Boolean)[0];
  return first ? first.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
};

export default function BrandHead() {
  const { universityName, campusName, logoUrl, address } = useSelector((s) => s.settings);
  const { pathname } = useLocation();

  useEffect(() => {
    const page = pageLabel(pathname);
    document.title = page ? `${page} · ${universityName}` : universityName;
  }, [pathname, universityName]);

  useEffect(() => {
    const full = campusName ? `${universityName} - ${campusName}` : universityName;
    const about = `${full}${address ? `, ${address}` : ''}. Student, teacher and department portal.`;
    setMeta('name', 'application-name', universityName);
    setMeta('name', 'apple-mobile-web-app-title', universityName);
    setMeta('name', 'description', about);
    setMeta('property', 'og:site_name', universityName);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', about);
  }, [universityName, campusName, address]);

  useEffect(() => {
    let link = document.head.querySelector('link[rel~="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    // Remember the icon the page came with, so it comes back when the uploaded logo is removed.
    if (link.dataset.original === undefined) {
      link.dataset.original = link.getAttribute('href') || '';
      link.dataset.originalType = link.getAttribute('type') || '';
    }
    if (logoUrl) {
      link.removeAttribute('type'); // the file type can change when another logo is uploaded
      link.href = assetUrl(logoUrl);
    } else if (link.dataset.original) {
      link.setAttribute('href', link.dataset.original);
      if (link.dataset.originalType) link.setAttribute('type', link.dataset.originalType);
    }
  }, [logoUrl]);

  return null;
}
