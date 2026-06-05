(function () {
  const CMS_BASE = window.DJI_CMS_BASE || 'http://localhost:3000';
  const SUPPORTED_LOCALES = ['en', 'id', 'zh'];
  const DEFAULT_LOCALE = 'en';
  const LOGO_ASSET_VERSION = '20260601d';
  const DEFAULT_LOGO_LIGHT_URL = '/assets/brand/dji-luggage-logo-white.png?v=20260601d';
  const DEFAULT_LOGO_DARK_URL = '/assets/brand/dji-luggage-logo-black.png?v=20260601d';

  function detectLocale() {
    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
    return SUPPORTED_LOCALES.includes(firstSegment) ? firstSegment : DEFAULT_LOCALE;
  }

  const CURRENT_LOCALE = detectLocale();

  const UI_COPY = {
    en: {
      contactRequired: 'Please leave an email or phone number.',
      sending: 'Sending...',
    },
    id: {
      contactRequired: 'Mohon isi email atau nomor telepon.',
      sending: 'Mengirim...',
    },
    zh: {
      contactRequired: '请留下邮箱或电话号码。',
      sending: '发送中...',
    },
  };

  const COPY = UI_COPY[CURRENT_LOCALE] || UI_COPY[DEFAULT_LOCALE];
  const REVEAL_TOKEN_RE = /(\s+|[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]|[^\s\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+)/g;

  function documentLang(locale) {
    return locale === 'zh' ? 'zh-CN' : locale;
  }

  function applyLocaleToDocument() {
    document.documentElement.lang = documentLang(CURRENT_LOCALE);
    document.documentElement.dataset.locale = CURRENT_LOCALE;
  }

  const iconNames = ['linkedin', 'x', 'instagram', 'youtube', 'whatsapp'];
  const socialIconSvgs = {
    linkedin: '<svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 2a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Zm5.2-.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 11.85a29 29 0 0 0-.46-5.43ZM9.75 15.02V8.48l5.75 3.27-5.75 3.27Z"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.97L2.05 22l5.25-1.38a9.91 9.91 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 19.05 4.91 9.85 9.85 0 0 0 12.04 2Zm.01 18.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.19 8.19 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.25 8.23Zm4.52-6.17c-.25-.12-1.47-.73-1.7-.81-.23-.08-.4-.12-.57.12-.17.25-.65.81-.8.98-.15.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.1-.5.11-.11.25-.3.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.57-1.37-.78-1.88-.2-.49-.41-.42-.57-.43l-.49-.01c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.09s.9 2.42 1.02 2.59c.12.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg>',
  };
  const DEFAULT_SOCIAL_LINKS = [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/', icon: 'linkedin' },
    { label: 'X', url: 'https://x.com/', icon: 'x' },
    { label: 'Instagram', url: 'https://www.instagram.com/', icon: 'instagram' },
    { label: 'YouTube', url: 'https://www.youtube.com/', icon: 'youtube' },
    { label: 'WhatsApp', url: 'https://wa.me/6281266189081', icon: 'whatsapp' },
  ];

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function lineBreakHTML(value) {
    return escapeHTML(value).replace(/\n/g, '<br>');
  }

  function setText(selector, value, root) {
    if (value === undefined || value === null) return;
    const el = (root || document).querySelector(selector);
    if (el) el.textContent = value;
  }

  function isExternalUrl(url) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(String(url || ''));
  }

  function stripLocalePrefix(pathname) {
    const parts = String(pathname || '/').split('/').filter(Boolean);
    if (SUPPORTED_LOCALES.includes(parts[0])) parts.shift();
    return '/' + parts.join('/');
  }

  function localizeUrl(url) {
    if (!url || isExternalUrl(url) || !String(url).startsWith('/')) return url;
    const [pathAndQuery, hash = ''] = String(url).split('#');
    const [pathname, query = ''] = pathAndQuery.split('?');
    const cleanPath = stripLocalePrefix(pathname);
    const localizedPath = CURRENT_LOCALE === DEFAULT_LOCALE
      ? cleanPath || '/'
      : '/' + CURRENT_LOCALE + (cleanPath === '/' ? '' : cleanPath);
    return localizedPath + (query ? '?' + query : '') + (hash ? '#' + hash : '');
  }

  function cmsQuery(params) {
    const search = new URLSearchParams(params || {});
    search.set('locale', CURRENT_LOCALE);
    search.set('fallback-locale', DEFAULT_LOCALE);
    return search.toString();
  }

  function setHref(el, url) {
    if (el && url) el.setAttribute('href', localizeUrl(url));
  }

  function localizeStaticLinks() {
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href) link.setAttribute('href', localizeUrl(href));
    });
  }

  function revealSegments(value) {
    return String(value || '').trim().match(REVEAL_TOKEN_RE) || [];
  }

  function revealSpanHTML(value, spanClass) {
    return revealSegments(value).map((segment) => {
      if (/^\s+$/.test(segment)) return ' ';
      return '<span class="' + spanClass + '">' + escapeHTML(segment) + '</span>';
    }).join('');
  }

  function setFormStatus(form, message, tone) {
    if (!form) return;
    let status = form.querySelector('.quote-form-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'quote-form-status';
      status.setAttribute('role', 'status');
      form.appendChild(status);
    }
    status.textContent = message || '';
    status.dataset.tone = tone || '';
  }

  function fieldValue(fields, index) {
    const field = fields[index];
    return field && field.value ? field.value.trim() : '';
  }

  function bindContactForm(contact) {
    const form = document.querySelector('.quote-form');
    if (!form || form.dataset.cmsSubmitBound === 'true') return;
    form.dataset.cmsSubmitBound = 'true';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fields = Array.from(form.querySelectorAll('input'));
      const textarea = form.querySelector('textarea');
      const button = form.querySelector('.quote-submit');
      const defaultLabel = button ? button.textContent : '';
      const payload = {
        productType: fieldValue(fields, 0),
        orderQuantity: fieldValue(fields, 1),
        companyName: fieldValue(fields, 2),
        emailOrPhone: fieldValue(fields, 3),
        customerName: fieldValue(fields, 4),
        destinationMarket: fieldValue(fields, 5),
        message: textarea && textarea.value ? textarea.value.trim() : '',
        sourceUrl: window.location.href,
      };

      if (!payload.emailOrPhone) {
        setFormStatus(form, COPY.contactRequired, 'error');
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = COPY.sending;
      }

      try {
        const response = await fetch(CMS_BASE + '/api/contact-submissions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Contact submission failed with ' + response.status);
        form.reset();
        setFormStatus(form, contact.form?.successMessage || 'Inquiry sent. We will contact you shortly.', 'success');
        if (button) button.textContent = contact.form?.submitLabel || defaultLabel || 'Send Inquiry';
      } catch (error) {
        console.warn('[DJI Luggage CMS] Contact form submission failed.', error);
        setFormStatus(
          form,
          contact.form?.errorMessage || 'Unable to send right now. Please try again or email us directly.',
          'error',
        );
        if (button) button.textContent = defaultLabel || contact.form?.submitLabel || 'Send Inquiry';
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function setSectionLabel(el, label) {
    if (!el || !label) return;
    const before = window.getComputedStyle ? window.getComputedStyle(el, '::before').content : 'none';
    const hasPseudoPlus = before && before !== 'none' && before !== 'normal' && before !== '""';
    if (hasPseudoPlus) {
      el.textContent = String(label).toUpperCase();
      return;
    }
    el.innerHTML = '<span style="font-size:13px;">+</span> ' + escapeHTML(label).toUpperCase();
  }

  function animatedLines(el, value, spanClass, delayStep) {
    if (!el || !value) return;
    let charIndex = 0;
    const segments = String(value).split(/\n|<br\s*\/?>/gi);
    el.innerHTML = segments.map((segment) => {
      return segment.split('').map((char) => {
        charIndex += 1;
        const display = char === ' ' ? '&nbsp;' : escapeHTML(char);
        return '<span class="' + spanClass + '" style="animation-delay:' + (charIndex * delayStep).toFixed(3) + 's;transition-delay:' + (charIndex * delayStep).toFixed(3) + 's">' + display + '</span>';
      }).join('');
    }).join('<br>');
  }

  function animatedHeroTitle(el, value) {
    if (!el || !value) return;
    const text = String(value);
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split('').map((char, index) => {
      const display = char === ' ' ? '&nbsp;' : escapeHTML(char);
      return '<span class="hac" style="animation-delay:' + (index * 0.03).toFixed(2) + 's">' + display + '</span>';
    }).join('');
  }

  function rewrapWordReveal(el, value) {
    if (!el || !value) return;
    el.innerHTML = revealSpanHTML(value, 'wr-w');
    el._w = el.querySelectorAll('.wr-w');
  }

  function wrapEmpowerWords(el) {
    if (!el) return;
    el.innerHTML = revealSpanHTML(el.textContent, 'word');
    const spans = el.querySelectorAll('.word');
    function update() {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.85;
      const end = vh * 0.38;
      let progress = (start - rect.top) / (start - end);
      progress = Math.max(0, Math.min(1, progress));
      const reveal = progress * (spans.length + 4);
      spans.forEach((span, index) => {
        span.style.opacity = Math.max(0.18, Math.min(1, reveal - index));
      });
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function rewrapProductionWorkflowWords(el, value) {
    if (!el || !value) return;
    el.innerHTML = revealSpanHTML(value, 'fi-word');
    const spans = el.querySelectorAll('.fi-word');
    function update() {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.95;
      const end = -vh * 0.2;
      let progress = (start - rect.top) / (start - end);
      progress = Math.max(0, Math.min(1, progress));
      const reveal = progress * (spans.length + 2);
      spans.forEach((span, index) => {
        span.style.opacity = Math.max(0.18, Math.min(1, reveal - index));
      });
    }
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return String(date.getMonth() + 1) + '.' + String(date.getDate()).padStart(2, '0') + '.' + String(date.getFullYear()).slice(-2);
  }

  function categoryLabel(value) {
    if (!value) return '';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function employmentTypeLabel(value) {
    const labels = {
      'full-time': 'FULL-TIME',
      'part-time': 'PART-TIME',
      contract: 'CONTRACT',
    };
    return labels[value] || String(value || '').toUpperCase();
  }

  function imageUrlFrom(item, externalField, uploadField) {
    if (!item) return '';
    const external = item[externalField || 'externalImageUrl'];
    const upload = item[uploadField || 'image'];
    return external || (upload && upload.url) || '';
  }

  function setImage(img, src, alt) {
    if (!img) return;
    if (src) img.setAttribute('src', src);
    if (alt !== undefined && alt !== null) img.setAttribute('alt', alt);
  }

  function injectBrandStyles() {
    if (document.getElementById('dji-cms-brand-styles')) return;
    const style = document.createElement('style');
    style.id = 'dji-cms-brand-styles';
    style.textContent = [
      '.logo .cms-logo-text,.menu-footer-logo .cms-logo-text{display:inline-block;font-family:Geist,Switzer,Inter,"Helvetica Neue",Arial,sans-serif;font-size:23px;font-style:italic;font-weight:700;line-height:1;letter-spacing:0;white-space:nowrap;transition:color .35s ease;}',
      '.logo .cms-logo-text,.logo:link .cms-logo-text,.logo:visited .cms-logo-text{color:var(--white,#fff);}',
      '.menu-footer-logo .cms-logo-text{color:var(--text-dark,#080808);}',
      '.logo .cms-logo-image-stack,.menu-footer-logo .cms-logo-image-stack{display:inline-grid;align-items:center;height:18px;width:115px;max-width:115px;}',
      '.logo .cms-logo-image,.menu-footer-logo .cms-logo-image{grid-area:1/1;display:block;width:115px;height:13px;max-width:115px;max-height:13px;object-fit:contain;transition:opacity .25s ease;}',
      '.logo .cms-logo-image-light{opacity:1;}',
      '.logo .cms-logo-image-dark{opacity:0;}',
      '.menu-footer-logo .cms-logo-image-light{opacity:0;}',
      '.menu-footer-logo .cms-logo-image-dark{opacity:1;}',
      'header.txt-light .logo .cms-logo-text{color:#fff;}',
      'header.txt-dark .logo .cms-logo-text,header.header-solid .logo .cms-logo-text,header.header-dark .logo .cms-logo-text,header.scrolled .logo .cms-logo-text,header.menu-open .logo .cms-logo-text{color:#000;}',
      'header.txt-light .logo .cms-logo-image-light{opacity:1;}',
      'header.txt-light .logo .cms-logo-image-dark{opacity:0;}',
      'header.txt-dark .logo .cms-logo-image-light,header.header-solid .logo .cms-logo-image-light,header.header-dark .logo .cms-logo-image-light,header.scrolled .logo .cms-logo-image-light,header.menu-open .logo .cms-logo-image-light{opacity:0;}',
      'header.txt-dark .logo .cms-logo-image-dark,header.header-solid .logo .cms-logo-image-dark,header.header-dark .logo .cms-logo-image-dark,header.scrolled .logo .cms-logo-image-dark,header.menu-open .logo .cms-logo-image-dark{opacity:1;}',
      '.menu-overlay .menu-section-label,.menu-overlay .menu-quick-section .menu-section-label,.menu-overlay .menu-address-section .menu-section-label{color:#111!important;}',
      '.menu-overlay .menu-address-section{min-width:clamp(280px,28vw,460px);max-width:min(520px,calc(100vw - 48px));}',
      '.menu-overlay .menu-address-text{width:auto;min-width:280px;max-width:520px;color:#555;line-height:1.65;}',
      '.quote-form-status{margin:4px 0 0;font-size:14px;line-height:1.4;color:#262626;}',
      '.quote-form-status[data-tone="success"]{color:#0b6b35;}',
      '.quote-form-status[data-tone="error"]{color:#9b1c1c;}',
      '.quote-submit:disabled{cursor:not-allowed;opacity:.72;}',
      '@media (max-width:768px){.logo .cms-logo-text,.menu-footer-logo .cms-logo-text{font-size:20px;}.logo .cms-logo-image-stack,.menu-footer-logo .cms-logo-image-stack{height:18px;width:115px;max-width:115px;}.logo .cms-logo-image,.menu-footer-logo .cms-logo-image{width:115px;height:13px;max-width:115px;max-height:13px;}.menu-overlay .menu-address-section,.menu-overlay .menu-address-text{width:100%;min-width:0;max-width:100%;}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function syncInitialBrandHeaderTheme() {
    const header = document.querySelector('header');
    if (!header) return;
    const hasKnownTheme = ['txt-light', 'txt-dark', 'header-solid', 'header-dark'].some((className) => header.classList.contains(className));
    if (hasKnownTheme) return;
    if (document.querySelector('.hero')) return;
    const firstThemedSection = document.querySelector('[data-header]');
    if (!firstThemedSection) {
      header.classList.add('txt-dark');
      return;
    }
    header.classList.add(firstThemedSection.getAttribute('data-header') === 'light' ? 'txt-light' : 'txt-dark');
  }

  function versionLocalLogoUrl(url) {
    if (!url) return url;
    const base = String(url).split('?')[0];
    if (/\/assets\/brand\/dji-luggage-logo-(white|black)\.png$/.test(base)) {
      return base + '?v=' + LOGO_ASSET_VERSION;
    }
    return url;
  }

  function logoImageUrls(site) {
    return {
      light: versionLocalLogoUrl(site.externalLogoImageUrl || (site.logoImage && site.logoImage.url) || DEFAULT_LOGO_LIGHT_URL),
      dark: versionLocalLogoUrl(site.externalDarkLogoImageUrl || (site.darkLogoImage && site.darkLogoImage.url) || DEFAULT_LOGO_DARK_URL),
    };
  }

  function renderBrandLogo(site, large) {
    const label = site.logoLabel || site.brandName || 'DJI LUGGAGE';
    const alt = site.logoAlt || label;
    if (site.logoDisplay === 'image') {
      const imageUrls = logoImageUrls(site);
      return [
        '<span class="cms-logo-image-stack" aria-label="' + escapeHTML(alt) + '">',
        '<img class="cms-logo-image cms-logo-image-light" src="' + escapeHTML(imageUrls.light) + '" alt="' + escapeHTML(alt) + '">',
        '<img class="cms-logo-image cms-logo-image-dark" src="' + escapeHTML(imageUrls.dark) + '" alt="">',
        '</span>',
      ].join('');
    }
    return '<span class="cms-logo-text' + (large ? ' cms-logo-text-large' : '') + '">' + escapeHTML(label) + '</span>';
  }

  function applyBrandLogo(site) {
    injectBrandStyles();
    const label = site.logoLabel || site.brandName || 'DJI LUGGAGE';
    document.querySelectorAll('.logo').forEach((logo) => {
      logo.innerHTML = renderBrandLogo(site, false);
      setHref(logo, site.logoHref || '/');
      logo.setAttribute('aria-label', site.logoAlt || label);
    });
    document.querySelectorAll('.menu-footer-logo').forEach((logo) => {
      logo.innerHTML = renderBrandLogo(site, false);
    });
    document.querySelectorAll('footer .footer-large-text').forEach((logo) => {
      logo.textContent = label;
    });
    syncInitialBrandHeaderTheme();
  }

  function renderLogoCard(logo) {
    const name = escapeHTML(logo.name || 'Trusted logo');
    let media = '';
    if (logo.sourceType === 'sourceSymbol' && logo.sourceSymbolId) {
      media = '<svg viewBox="' + escapeHTML(logo.viewBox || '0 0 268 116') + '" role="img" aria-label="' + name + '"><use href="#' + escapeHTML(logo.sourceSymbolId) + '"></use></svg>';
    } else if (logo.sourceType === 'inlineSvg' && logo.svgMarkup) {
      media = logo.svgMarkup;
    } else {
      const src = logo.externalUrl || (logo.media && logo.media.url);
      if (src) media = '<img src="' + escapeHTML(src) + '" alt="' + name + '">';
    }
    const content = logo.destinationUrl
      ? '<a href="' + escapeHTML(logo.destinationUrl) + '" aria-label="' + name + '">' + media + '</a>'
      : media;
    return '<div class="trusted-logo-card">' + content + '</div>';
  }

  function rotateForCarouselStart(items, startOffset) {
    if (!items.length) return [];
    const offset = ((items.length - (startOffset % items.length)) + items.length) % items.length;
    return items.slice(offset).concat(items.slice(0, offset));
  }

  async function fetchGlobal(slug, depth) {
    const response = await fetch(CMS_BASE + '/api/globals/' + slug + '?' + cmsQuery({ depth: String(depth || 1) }));
    if (!response.ok) throw new Error('CMS request failed for ' + slug);
    return response.json();
  }

  function applySiteSettings(site) {
    if (!site) return;

    applyBrandLogo(site);

    const headerCta = document.querySelector('.header-cta');
    if (headerCta) {
      headerCta.textContent = (site.requestQuoteLabel || headerCta.textContent).toUpperCase();
      setHref(headerCta, site.requestQuoteUrl);
    }

    const menuLinks = document.querySelectorAll('.menu-nav a');
    (site.mainNavigation || []).forEach((item, index) => {
      const link = menuLinks[index];
      if (!link) return;
      link.textContent = item.label || link.textContent;
      setHref(link, item.url);
    });

    const menuButtons = document.querySelectorAll('.menu-contact-btns a');
    if (site.menuContact) {
      document.querySelectorAll('.menu-quick-section .menu-section-label').forEach((label) => {
        label.textContent = site.menuContact.quickContactLabel || label.textContent;
      });
      if (menuButtons[0]) {
        menuButtons[0].textContent = site.menuContact.messageLabel || menuButtons[0].textContent;
        setHref(menuButtons[0], site.menuContact.email ? 'mailto:' + site.menuContact.email : undefined);
      }
      if (menuButtons[1]) {
        menuButtons[1].textContent = site.menuContact.quoteLabel || menuButtons[1].textContent;
        setHref(menuButtons[1], site.menuContact.quoteUrl);
      }
    }

    const menuAddress = document.querySelector('.menu-address-text');
    if (menuAddress && site.address) {
      menuAddress.innerHTML = lineBreakHTML(site.address);
    }

    if (site.footerContact) {
      setText('footer .footer-contact-label', site.footerContact.label);
      setText('footer .footer-contact h3', site.footerContact.heading);
      const footerButton = document.querySelector('footer .footer-contact .btn');
      if (footerButton) {
        footerButton.textContent = site.footerContact.buttonLabel || footerButton.textContent;
        setHref(footerButton, site.footerContact.buttonUrl);
      }
    }

    const footerColumns = document.querySelectorAll('footer .footer-nav-col');
    if (footerColumns[0] && site.address) {
      setText('h4', 'Address', footerColumns[0]);
      const address = footerColumns[0].querySelector('p');
      if (address) address.innerHTML = lineBreakHTML(site.address);
    }
    (site.footerColumns || []).forEach((column, index) => {
      const el = footerColumns[index + 1];
      if (!el) return;
      setText('h4', column.heading, el);
      const links = el.querySelectorAll('a');
      const visibleLinks = (column.links || []).filter((item) => !isFooter404Link(item));
      visibleLinks.forEach((item, linkIndex) => {
        const link = links[linkIndex];
        if (!link) return;
        link.textContent = String(item.label || '').toUpperCase();
        setHref(link, item.url);
      });
      Array.from(links).slice(visibleLinks.length).forEach((link) => link.remove());
    });

    const socialLinks = normalizeSocialLinks(site.socialLinks);
    applySocialLinks(document.querySelectorAll('.menu-social .social-icon'), socialLinks);
    applySocialLinks(document.querySelectorAll('footer .social-icons .social-icon'), socialLinks);

    const copyrightSpans = document.querySelectorAll('footer .footer-copyright span');
    if (copyrightSpans[0] && site.copyright) copyrightSpans[0].textContent = site.copyright;
    if (copyrightSpans[2] && site.credit) copyrightSpans[2].textContent = site.credit;
  }

  function applySocialLinks(nodes, socialLinks) {
    nodes = ensureSocialLinkNodes(nodes, socialLinks.length);
    socialLinks.forEach((item, index) => {
      const node = nodes[index];
      if (!node) return;
      const icon = socialIconSvgs[item.icon] || socialIconSvgs[iconNames[index]] || '';
      node.setAttribute('href', item.url || '#');
      node.setAttribute('aria-label', item.label || iconNames[index] || 'Social link');
      node.setAttribute('title', item.label || iconNames[index] || 'Social link');
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      if (icon) {
        node.innerHTML = [
          '<span class="menu-social-icon-clip" aria-hidden="true">',
          '<span class="menu-social-icon-track">',
          icon,
          icon,
          '</span>',
          '</span>',
        ].join('');
      }
    });
  }

  function ensureSocialLinkNodes(nodes, count) {
    const list = Array.from(nodes || []);
    const parent = list[0] && list[0].parentElement;
    if (!parent) return list;

    while (list.length < count) {
      const node = list[list.length - 1].cloneNode(false);
      node.className = 'social-icon';
      node.innerHTML = '';
      parent.appendChild(node);
      list.push(node);
    }

    return list;
  }

  function isFooter404Link(item) {
    const label = String(item && item.label ? item.label : '').trim();
    const url = String(item && item.url ? item.url : '').trim().split(/[?#]/)[0];
    return label === '404' || stripLocalePrefix(url) === '/404';
  }

  function normalizeSocialLinks(socialLinks) {
    const configured = Array.isArray(socialLinks) ? socialLinks : [];
    return DEFAULT_SOCIAL_LINKS.map((fallback) => {
      const match = configured.find((item) => item && (item.icon === fallback.icon || String(item.label || '').toLowerCase() === fallback.label.toLowerCase()));
      return Object.assign({}, fallback, match || {}, { url: (match && match.url) || fallback.url });
    });
  }

  function applyFinalCta(finalCta) {
    if (!finalCta) return;
    const bg = document.querySelector('.final-cta-bg');
    const bgUrl = finalCta.externalBackgroundImageUrl || (finalCta.backgroundImage && finalCta.backgroundImage.url);
    if (bg && bgUrl) bg.setAttribute('src', bgUrl);
    setText('.final-cta .section-label', finalCta.label);
    const ctaTitle = document.getElementById('ctaTitle');
    animatedLines(ctaTitle, finalCta.heading, 'cta-char', 0.025);
    if (ctaTitle && ctaTitle.getBoundingClientRect().top < window.innerHeight) {
      ctaTitle.classList.add('visible');
    }
    const button = document.querySelector('.final-cta .btn');
    if (button) {
      button.textContent = finalCta.buttonLabel || button.textContent;
      setHref(button, finalCta.buttonUrl);
    }
  }

  function applyHomePage(home) {
    if (!home) return;
    if (home.metaTitle) document.title = home.metaTitle;

    if (home.hero) {
      setText('.hero-breadcrumb', home.hero.breadcrumb);
      animatedLines(document.getElementById('heroTitle'), home.hero.title, 'char', 0.02);
      setText('.hero-desc p', home.hero.description);
      const heroButton = document.querySelector('.hero-right .btn');
      if (heroButton) {
        heroButton.textContent = home.hero.buttonLabel || heroButton.textContent;
        setHref(heroButton, home.hero.buttonUrl);
      }
      const heroVideo = document.querySelector('.hero-video');
      const heroSource = document.querySelector('.hero-video source');
      if (heroVideo && home.hero.posterUrl) heroVideo.setAttribute('poster', home.hero.posterUrl);
      if (heroSource && home.hero.videoUrl && heroSource.getAttribute('src') !== home.hero.videoUrl) {
        heroSource.setAttribute('src', home.hero.videoUrl);
        if (heroVideo && typeof heroVideo.load === 'function') heroVideo.load();
      }
    }

    if (home.services) {
      setSectionLabel(document.querySelector('.services-left-label .section-label'), home.services.label);
      const intro = document.getElementById('empowerText');
      if (intro && home.services.heading) {
        intro.textContent = home.services.heading;
        wrapEmpowerWords(intro);
      }
      const cards = document.querySelectorAll('.services-cards-row .service-card');
      (home.services.cards || []).forEach((card, index) => {
        const el = cards[index];
        if (!el) return;
        setText('h3', card.title, el);
        setText('p', card.description, el);
      });
      const servicesButton = document.querySelector('.services-right > .btn');
      if (servicesButton) {
        servicesButton.textContent = home.services.buttonLabel || servicesButton.textContent;
        setHref(servicesButton, home.services.buttonUrl);
      }
    }

    const values = document.querySelectorAll('.values .value-card');
    (home.values || []).forEach((value, index) => {
      const el = values[index];
      if (!el) return;
      setText('.value-number', value.number, el);
      setText('h3', value.title, el);
      setText('p', value.description, el);
    });

    if (home.technologyCta) {
      setSectionLabel(document.querySelector('.yellow-cta .section-label'), home.technologyCta.label);
      const title = document.querySelector('.yellow-cta-title');
      if (title && home.technologyCta.headingHtml) title.innerHTML = home.technologyCta.headingHtml;
      const button = document.querySelector('.yellow-cta .btn');
      if (button) {
        button.textContent = home.technologyCta.buttonLabel || button.textContent;
        setHref(button, home.technologyCta.buttonUrl);
      }
    }

    if (home.howWeWork) {
      setSectionLabel(document.querySelector('.how-we-work .section-label'), home.howWeWork.label);
      setText('.how-we-work-text', home.howWeWork.body);
      const steps = document.querySelectorAll('.how-we-work .step');
      (home.howWeWork.steps || []).forEach((step, index) => {
        const el = steps[index];
        if (!el) return;
        setText('.step-number', step.number, el);
        setText('p', step.body, el);
      });
    }

    if (home.newsroom) {
      setSectionLabel(document.querySelector('.newsroom .section-label'), home.newsroom.label);
      setText('.newsroom h2', home.newsroom.heading);
      const posts = (home.newsroom.posts || []).filter((post) => post && typeof post === 'object');
      if (posts.length > 0) {
        const cards = document.querySelectorAll('#newsCarousel .news-card');
        cards.forEach((card, index) => {
          const post = posts[index % posts.length];
          const url = '/newsroom/' + post.slug;
          setHref(card, url);
          setText('.news-card-tag', categoryLabel(post.category), card);
          setText('.news-date', formatDate(post.publishedAt), card);
          setText('.news-card-title h4', post.title, card);
          const img = card.querySelector('.news-card-image img');
          const imageUrl = post.externalCoverImageUrl || (post.coverImage && post.coverImage.url);
          if (img && imageUrl) img.setAttribute('src', imageUrl);
        });
      }
    }

    if (home.finalCta) {
      const bg = document.querySelector('.final-cta-bg');
      const bgUrl = home.finalCta.externalBackgroundImageUrl || (home.finalCta.backgroundImage && home.finalCta.backgroundImage.url);
      if (bg && bgUrl) bg.setAttribute('src', bgUrl);
      setText('.final-cta .section-label', home.finalCta.label);
      const ctaTitle = document.getElementById('ctaTitle');
      animatedLines(ctaTitle, home.finalCta.heading, 'cta-char', 0.025);
      if (ctaTitle && ctaTitle.getBoundingClientRect().top < window.innerHeight) {
        ctaTitle.classList.add('visible');
      }
      const button = document.querySelector('.final-cta .btn');
      if (button) {
        button.textContent = home.finalCta.buttonLabel || button.textContent;
        setHref(button, home.finalCta.buttonUrl);
      }
    }
  }

  function applyAboutPage(about) {
    if (!about) return;
    if (about.metaTitle) document.title = about.metaTitle;

    const pageTitle = document.querySelector('.page-title');
    if (pageTitle && about.pageTitle) {
      pageTitle.innerHTML = escapeHTML(about.pageTitle) + ' <span class="arrow-down">&darr;</span>';
    }

    const heroImage = document.querySelector('.about-hero-image img');
    const heroUrl = imageUrlFrom(about, 'externalHeroImageUrl', 'heroImage');
    if (heroImage && heroUrl) {
      heroImage.setAttribute('src', heroUrl);
      heroImage.setAttribute('alt', about.pageTitle || heroImage.getAttribute('alt') || 'DJI Luggage manufacturing');
      const heroWrap = document.querySelector('.about-hero-image');
      if (heroWrap) heroWrap.style.backgroundImage = 'url("' + heroUrl + '")';
    }

    if (about.whoWeAre) {
      setSectionLabel(document.querySelector('.who-we-are .section-label'), about.whoWeAre.label);
      rewrapWordReveal(document.querySelector('.who-we-are .about-heading'), about.whoWeAre.heading);
      const columns = document.querySelectorAll('.who-we-are .about-column p');
      (about.whoWeAre.columns || []).forEach((column, index) => {
        if (columns[index]) columns[index].textContent = column.body || '';
      });
    }

    if (about.reach) {
      setSectionLabel(document.querySelector('.our-reach .section-label'), about.reach.label);
      rewrapWordReveal(document.querySelector('.our-reach .about-heading'), about.reach.heading);
      const locations = (about.reach.locations || []).filter(Boolean);
      const track = document.querySelector('.marquee-track');
      if (track && locations.length) {
        const html = [];
        for (let set = 0; set < 3; set += 1) {
          locations.forEach((location) => {
            html.push(
              '<div class="location-item"><span class="location-country">' +
                escapeHTML(location.country) +
                '</span><span class="location-city">' +
                escapeHTML(location.city) +
                '</span></div>',
            );
          });
        }
        track.innerHTML = html.join('');
      }
      const globeVideo = document.querySelector('.reach-globe video');
      if (globeVideo && about.reach.globeVideoUrl && globeVideo.getAttribute('src') !== about.reach.globeVideoUrl) {
        globeVideo.setAttribute('src', about.reach.globeVideoUrl);
        if (typeof globeVideo.load === 'function') globeVideo.load();
      }
    }

    if (about.metrics) {
      setSectionLabel(document.querySelector('.key-metrics .section-label'), about.metrics.label);
      rewrapWordReveal(document.querySelector('.key-metrics .about-heading'), about.metrics.heading);
      const metricsImage = document.querySelector('.metrics-image');
      const metricsImageUrl = imageUrlFrom(about.metrics, 'externalImageUrl', 'image');
      if (metricsImage && metricsImageUrl) {
        metricsImage.setAttribute('src', metricsImageUrl);
        metricsImage.setAttribute('alt', about.metrics.imageAlt || 'person on computer');
      }
      setText('.metrics-subtext', about.metrics.subtext);
      const cards = document.querySelectorAll('.stats-grid .metric-card');
      const toneClasses = ['metric-card-dark', 'metric-card-gray', 'metric-card-yellow', 'metric-card-charcoal'];
      (about.metrics.items || []).forEach((item, index) => {
        const card = cards[index];
        if (!card) return;
        toneClasses.forEach((className) => card.classList.remove(className));
        card.classList.add('metric-card-' + (item.tone || 'dark'));
        setText('.metric-number', item.value, card);
        setText('.metric-label', item.label, card);
      });
    }

    const testimonials = (about.testimonials || []).filter((item) => item && typeof item === 'object' && item.isActive !== false);
    if (testimonials.length) {
      const slides = document.querySelectorAll('.testimonial-slide');
      slides.forEach((slide, index) => {
        const testimonial = testimonials[index % testimonials.length];
        const img = slide.querySelector('img');
        const imageUrl = imageUrlFrom(testimonial, 'externalImageUrl', 'image');
        if (img && imageUrl) {
          img.setAttribute('src', imageUrl);
          img.setAttribute('alt', testimonial.company || 'customer testimonial');
        }
        setText('.testimonial-quote', testimonial.quote, slide);
        setText('.testimonial-company', testimonial.company, slide);
      });
    }

    const trustedLogos = (about.trustedLogos || []).filter((item) => item && typeof item === 'object' && item.isActive !== false);
    if (trustedLogos.length) {
      setText('.trusted-by > .section-label', (about.trustedLabel || 'Trusted By').toUpperCase());
      const trustedTrack = document.querySelector('.trusted-track');
      if (trustedTrack) {
        const repeated = [];
        for (let set = 0; set < 4; set += 1) {
          trustedLogos.forEach((logo) => repeated.push(renderLogoCard(logo)));
        }
        trustedTrack.innerHTML = repeated.join('');
      }
    }

    const teamMembers = (about.teamMembers || []).filter((item) => item && typeof item === 'object' && item.isActive !== false);
    if (teamMembers.length) {
      setText('.our-team .section-label', (about.teamLabel || 'Our Team').toUpperCase());
      setText('.team-title', about.teamHeading);
      const cards = document.querySelectorAll('.team-card');
      const displayMembers = rotateForCarouselStart(teamMembers, 3);
      cards.forEach((card, index) => {
        const member = displayMembers[index % displayMembers.length];
        setText('.team-card-name', member.name, card);
        setText('.team-card-title', member.role, card);
        const img = card.querySelector('img');
        const imageUrl = imageUrlFrom(member, 'externalImageUrl', 'image');
        if (img && imageUrl) {
          img.setAttribute('src', imageUrl);
          img.setAttribute('alt', member.imageAlt || member.name || 'Team member');
        }
      });
    }

    if (about.careersCta) {
      setText('.careers-cta .section-label', (about.careersCta.label || 'Careers').toUpperCase());
      setText('.careers-cta .about-heading', about.careersCta.heading);
      const button = document.querySelector('.careers-cta .btn');
      if (button) {
        button.textContent = about.careersCta.buttonLabel || button.textContent;
        setHref(button, about.careersCta.buttonUrl);
      }
    }

    if (about.finalCta) {
      const bg = document.querySelector('.final-cta-bg');
      const bgUrl = about.finalCta.externalBackgroundImageUrl || (about.finalCta.backgroundImage && about.finalCta.backgroundImage.url);
      if (bg && bgUrl) bg.setAttribute('src', bgUrl);
      setText('.final-cta .section-label', about.finalCta.label);
      const ctaTitle = document.getElementById('ctaTitle');
      animatedLines(ctaTitle, about.finalCta.heading, 'cta-char', 0.025);
      if (ctaTitle && ctaTitle.getBoundingClientRect().top < window.innerHeight) ctaTitle.classList.add('visible');
      const button = document.querySelector('.final-cta .btn');
      if (button) {
        button.textContent = about.finalCta.buttonLabel || button.textContent;
        setHref(button, about.finalCta.buttonUrl);
      }
    }
  }

  function applyServicesPage(servicesPage) {
    if (!servicesPage) return;
    if (servicesPage.metaTitle) document.title = servicesPage.metaTitle;

    if (servicesPage.hero) {
      setSectionLabel(document.querySelector('.services-hero .section-label'), servicesPage.hero.label);
      animatedHeroTitle(document.querySelector('.services-hero-title'), servicesPage.hero.title);
      setText('.services-hero-desc', servicesPage.hero.description);
      setImage(
        document.querySelector('.services-hero-bg'),
        imageUrlFrom(servicesPage.hero, 'externalBackgroundImageUrl', 'backgroundImage'),
        servicesPage.hero.imageAlt || 'Luggage manufacturing floor',
      );
    }

    if (servicesPage.focus) {
      setSectionLabel(document.querySelector('.our-focus .section-label'), servicesPage.focus.label);
      rewrapWordReveal(document.querySelector('.our-focus-heading'), servicesPage.focus.heading);
      const paragraphs = document.querySelectorAll('.our-focus-details p');
      (servicesPage.focus.paragraphs || []).forEach((paragraph, index) => {
        if (paragraphs[index]) paragraphs[index].textContent = paragraph.body || '';
      });
    }

    if (servicesPage.aerial) {
      setImage(
        document.querySelector('.aerial-highway img'),
        imageUrlFrom(servicesPage.aerial, 'externalImageUrl', 'image'),
        servicesPage.aerial.imageAlt || 'Luggage production workflow',
      );
      const labels = document.querySelectorAll('.aerial-label');
      (servicesPage.aerial.labels || []).forEach((item, index) => {
        if (labels[index]) labels[index].textContent = '+ ' + String(item.label || '').toUpperCase();
      });
    }

    if (servicesPage.services) {
      setText('.services-detail-title', servicesPage.services.heading);
      const items = servicesPage.services.items || [];
      const nodes = document.querySelectorAll('.service-item');
      nodes.forEach((node, index) => {
        const item = items[index];
        node.style.display = item ? '' : 'none';
        if (!item) return;
        setText('.service-item-number', item.number, node);
        setText('.service-item-name', item.title, node);
        setText('.service-item-desc', item.description, node);
        setImage(
          node.querySelector('.service-item-image img'),
          imageUrlFrom(item, 'externalImageUrl', 'image'),
          item.imageAlt || item.title || 'Service image',
        );
      });
    }

    if (servicesPage.industries) {
      setText('.industries-title', servicesPage.industries.title);
      setImage(
        document.querySelector('.industries-image img'),
        imageUrlFrom(servicesPage.industries, 'externalImageUrl', 'image'),
        servicesPage.industries.imageAlt || 'Finished luggage storage',
      );
      const industries = servicesPage.industries.items || [];
      const nodes = document.querySelectorAll('.industry-name');
      nodes.forEach((node, index) => {
        const item = industries[index];
        node.style.display = item ? '' : 'none';
        if (item) node.textContent = item.name || '';
      });
    }

    applyFinalCta(servicesPage.finalCta);
  }

  function applyPlatformPage(platform) {
    if (!platform) return;
    if (platform.metaTitle) document.title = platform.metaTitle;

    if (platform.hero) {
      setText('.page-header-label', String(platform.hero.label || '').toUpperCase());
      animatedHeroTitle(document.querySelector('.page-header .hero-anim-title'), platform.hero.title);
      setText('.page-header-desc', platform.hero.description);
      setImage(
        document.querySelector('.page-header-bg'),
        imageUrlFrom(platform.hero, 'externalBackgroundImageUrl', 'backgroundImage'),
        '',
      );
    }

    if (platform.interfaceIntro) {
      setSectionLabel(document.querySelector('.production-interface .section-label'), platform.interfaceIntro.label);
      rewrapProductionWorkflowWords(document.getElementById('productionInterfaceText'), platform.interfaceIntro.body);
    }

    if (platform.tabletMockup) {
      setImage(
        document.querySelector('.tablet-mockup img'),
        imageUrlFrom(platform.tabletMockup, 'externalImageUrl', 'image'),
        platform.tabletMockup.imageAlt || 'DJI Luggage production workflow',
      );
    }

    const features = platform.featureSections || [];
    document.querySelectorAll('.feature-section').forEach((section, index) => {
      const feature = features[index];
      section.style.display = feature ? '' : 'none';
      if (!feature) return;
      setSectionLabel(section.querySelector('.feature-section-label'), feature.label);
      rewrapWordReveal(section.querySelector('.feature-section-heading'), feature.heading);
      setText('.feature-section-text', feature.body, section);
      setImage(
        section.querySelector('.feature-image-wrapper img'),
        imageUrlFrom(feature, 'externalImageUrl', 'image'),
        feature.imageAlt || feature.heading || 'Platform feature',
      );
    });

    if (platform.whyChoose) {
      setSectionLabel(document.querySelector('.why-choose .section-label'), platform.whyChoose.label);
      setText('.why-choose-text', platform.whyChoose.body);
      setImage(
        document.querySelector('.why-choose-bg'),
        imageUrlFrom(platform.whyChoose, 'externalBackgroundImageUrl', 'backgroundImage'),
        '',
      );
    }

    if (platform.highlights) {
      setSectionLabel(document.querySelector('.highlights .section-label'), platform.highlights.label);
      setText('.highlights-title', platform.highlights.heading);
      const items = platform.highlights.items || [];
      document.querySelectorAll('.highlight-item').forEach((node, index) => {
        const item = items[index];
        node.style.display = item ? '' : 'none';
        if (!item) return;
        setText('.highlight-number', item.number, node);
        setText('.highlight-text', item.body, node);
        setImage(
          node.querySelector('.highlight-icon img'),
          imageUrlFrom(item, 'externalIconUrl', 'icon'),
          item.iconAlt || '',
        );
      });
    }

    applyFinalCta(platform.finalCta);
  }

  function applyNewsroomPage(newsroom) {
    if (!newsroom) return;

    if (newsroom.hero) {
      setText('.newsroom-hero h1', newsroom.hero.title);
      const descriptions = document.querySelectorAll('.newsroom-hero-descriptions p');
      (newsroom.hero.descriptions || []).forEach((item, index) => {
        if (descriptions[index]) descriptions[index].innerHTML = lineBreakHTML(item.body || '');
      });
    }

    const filters = newsroom.filters || [];
    document.querySelectorAll('.filter-tab').forEach((tab, index) => {
      const item = filters[index];
      tab.style.display = item ? '' : 'none';
      if (!item) return;
      tab.setAttribute('href', localizeUrl('/newsroom/filters/' + item.value));
      tab.setAttribute('data-filter', item.value);
      tab.querySelectorAll('.filter-tab-track span').forEach((span) => {
        span.textContent = item.label || '';
      });
    });

    const posts = (newsroom.posts || []).filter((post) => post && typeof post === 'object' && post.status === 'published');
    const cards = document.querySelectorAll('.news-grid .news-card');
    cards.forEach((card, index) => {
      const post = posts[index];
      card.style.display = post ? '' : 'none';
      if (!post) return;
      const category = post.category || 'news';
      setHref(card, '/newsroom/' + post.slug);
      card.setAttribute('data-category', category);
      setText('.news-card-tag', categoryLabel(category).toUpperCase(), card);
      setText('.news-date', formatDate(post.publishedAt), card);
      setText('.news-card-title h4', post.title, card);
      setImage(
        card.querySelector('.news-card-image img'),
        post.externalCoverImageUrl || (post.coverImage && post.coverImage.url),
        post.title || 'News article',
      );
    });

    const filterMatch = window.location.pathname.match(/\/newsroom\/filters\/(all|insights|news)\/?$/);
    const currentFilter = filterMatch ? filterMatch[1] : 'all';
    document.querySelectorAll('.filter-tab').forEach((tab) => {
      const active = tab.getAttribute('data-filter') === currentFilter;
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    cards.forEach((card) => {
      if (!card.getAttribute('href')) return;
      const category = card.getAttribute('data-category');
      card.style.display = currentFilter === 'all' || category === currentFilter ? '' : 'none';
    });

    const activeLabel = filters.find((filter) => filter.value === currentFilter)?.label || 'All';
    document.title = currentFilter === 'all' && newsroom.metaTitle
      ? newsroom.metaTitle
      : activeLabel + ' - DJI Luggage';

    applyFinalCta(newsroom.finalCta);
  }

  function applyCareersPage(careers) {
    if (!careers) return;
    if (careers.metaTitle) document.title = careers.metaTitle;

    if (careers.hero) {
      const title = document.querySelector('.careers-hero-title');
      if (title && careers.hero.title) title.innerHTML = lineBreakHTML(careers.hero.title);
      const descriptions = document.querySelectorAll('.careers-hero-desc p');
      (careers.hero.descriptions || []).forEach((item, index) => {
        if (descriptions[index]) descriptions[index].textContent = item.body || '';
      });
    }

    const teamPhotos = careers.teamPhotos || [];
    if (teamPhotos.length) {
      document.querySelectorAll('.team-photo img').forEach((img, index) => {
        const photo = teamPhotos[index % teamPhotos.length];
        setImage(img, imageUrlFrom(photo, 'externalImageUrl', 'image'), photo.imageAlt || 'Career image');
      });
    }

    if (careers.benefitsIntro) {
      setImage(
        document.querySelector('.benefits-portrait'),
        imageUrlFrom(careers.benefitsIntro, 'externalImageUrl', 'image'),
        careers.benefitsIntro.imageAlt || '',
      );
      const intro = document.querySelector('.benefits-intro-text');
      if (intro && careers.benefitsIntro.bodyHtml) intro.innerHTML = careers.benefitsIntro.bodyHtml;
    }

    const benefits = careers.benefits || [];
    document.querySelectorAll('.benefit-card').forEach((card, index) => {
      const benefit = benefits[index];
      card.style.display = benefit ? '' : 'none';
      if (!benefit) return;
      setText('.benefit-number', benefit.number, card);
      setText('h3', benefit.title, card);
      setText('p', benefit.body, card);
    });

    if (careers.clock) {
      setText('.clock-location', careers.clock.locationLabel);
      setImage(
        document.querySelector('.clock-bg'),
        imageUrlFrom(careers.clock, 'externalBackgroundImageUrl', 'backgroundImage'),
        '',
      );
    }

    const jobs = (careers.positions || []).filter((job) => job && typeof job === 'object' && job.isOpen !== false);
    if (careers.positionsHeading) setText('.positions-title', careers.positionsHeading);
    setText('.positions-count', '(' + String(jobs.length).padStart(2, '0') + ')');
    document.querySelectorAll('.position-row').forEach((row, index) => {
      const job = jobs[index];
      row.style.display = job ? '' : 'none';
      if (!job) return;
      setHref(row, '/careers/' + job.slug);
      setText('.position-number', String(index + 1).padStart(2, '0'), row);
      setText('.position-title', job.title, row);
      setText('.position-location', job.location, row);
    });

    applyFinalCta(careers.finalCta);
  }

  function applyContactPage(contact) {
    if (!contact) return;
    if (contact.metaTitle) document.title = contact.metaTitle;

    if (contact.hero) {
      setText('.contact-email', contact.hero.email ? '↳ ' + contact.hero.email : undefined);
      setText('.contact-title', contact.hero.title);
      setImage(
        document.querySelector('.contact-hero-bg'),
        imageUrlFrom(contact.hero, 'externalBackgroundImageUrl', 'backgroundImage'),
        '',
      );
    }

    if (contact.form) {
      setSectionLabel(document.querySelector('.contact-card .section-label'), contact.form.label);
      setText('.contact-card-title', contact.form.title);
      const inputs = document.querySelectorAll('.quote-form input');
      (contact.form.fields || []).forEach((field, index) => {
        const input = inputs[index];
        if (input && field.placeholder) input.setAttribute('placeholder', field.placeholder);
      });
      const textarea = document.querySelector('.quote-form textarea');
      if (textarea && contact.form.messagePlaceholder) {
        textarea.setAttribute('placeholder', contact.form.messagePlaceholder);
      }
      setText('.quote-submit', contact.form.submitLabel);
      bindContactForm(contact);
    }
  }

  async function connect() {
    applyLocaleToDocument();
    localizeStaticLinks();

    try {
      const hasHome = Boolean(document.querySelector('.hero'));
      const hasAbout = Boolean(document.querySelector('.who-we-are') && document.querySelector('.key-metrics'));
      const hasServices = Boolean(document.querySelector('.services-hero') && document.querySelector('.services-detail'));
      const hasPlatform = Boolean(document.querySelector('.page-header') && document.querySelector('.production-interface'));
      const hasNewsroom = Boolean(document.querySelector('.newsroom-hero') && document.querySelector('.news-grid'));
      const hasCareers = Boolean(document.querySelector('.careers-hero') && document.querySelector('.positions'));
      const hasContact = Boolean(document.querySelector('.contact-hero') && document.querySelector('.quote-form'));
      const [site, home, about, servicesPage, platform, newsroom, careers, contact] = await Promise.all([
        fetchGlobal('site-settings', 2),
        hasHome ? fetchGlobal('home-page', 2) : Promise.resolve(null),
        hasAbout ? fetchGlobal('about-page', 2) : Promise.resolve(null),
        hasServices ? fetchGlobal('services-page', 2) : Promise.resolve(null),
        hasPlatform ? fetchGlobal('platform-page', 2) : Promise.resolve(null),
        hasNewsroom ? fetchGlobal('newsroom-page', 2) : Promise.resolve(null),
        hasCareers ? fetchGlobal('careers-page', 2) : Promise.resolve(null),
        hasContact ? fetchGlobal('contact-page', 2) : Promise.resolve(null),
      ]);
      applySiteSettings(site);
      applyHomePage(home);
      applyAboutPage(about);
      applyServicesPage(servicesPage);
      applyPlatformPage(platform);
      applyNewsroomPage(newsroom);
      applyCareersPage(careers);
      applyContactPage(contact);
      localizeStaticLinks();
      document.documentElement.dataset.cmsConnected = 'true';
      window.dispatchEvent(new CustomEvent('dji:cms-connected', { detail: { site, home, about, servicesPage, platform, newsroom, careers, contact } }));
    } catch (error) {
      console.warn('[DJI Luggage CMS] Falling back to static content.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
