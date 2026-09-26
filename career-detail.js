(function () {
  const SUPPORTED_LOCALES = ['en', 'id', 'zh'];
  const DEFAULT_LOCALE = 'en';
  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  const CURRENT_LOCALE = SUPPORTED_LOCALES.includes(firstSegment) ? firstSegment : DEFAULT_LOCALE;

  // 本站是纯静态站点，没有 CMS。下面 jobs 里的数据就是页面唯一的内容来源，
  // 同时也是 scripts/prerender-careers.mjs 生成服务端 HTML 的数据源。
  // 改职位文案只需改这里，然后跑一次 `npm run prerender:careers`。
  const jobs = {
    'production-supervisor': {
      title: 'Production Supervisor',
      date: '11.05.2025',
      type: 'FULL-TIME',
      description: 'DJI Luggage is looking for a Production Supervisor to coordinate people, materials, schedules, and quality checkpoints across luggage production. You will help keep orders organized, practical, and ready for buyer review.',
      basicIntro: '3+ years of experience in manufacturing operations or production coordination.',
      preferredIntro: 'Experience with bags, luggage, consumer goods, or assembly-based manufacturing is preferred.'
    },
    'quality-control-specialist': {
      title: 'Quality Control Specialist',
      date: '01.02.2025',
      type: 'FULL-TIME',
      description: 'DJI Luggage is looking for a Quality Control Specialist to check components, assembly, finishing, packing, and final product presentation. You will help the team catch issues early and keep quality records clear.',
      basicIntro: '2+ years of experience in quality control, production inspection, or consumer goods manufacturing.',
      preferredIntro: 'Experience inspecting luggage, bags, textiles, plastic shell products, or hardware is preferred.'
    },
    'export-sales-coordinator': {
      title: 'Export Sales Coordinator',
      date: '9.21.2025',
      type: 'FULL-TIME',
      description: 'DJI Luggage is looking for an Export Sales Coordinator to help buyers move from inquiry to quotation, sampling, production, and repeat order planning. You will keep communication clear and help the team respond quickly.',
      basicIntro: '2+ years of experience in B2B sales support, export coordination, customer service, or order management.',
      preferredIntro: 'Experience with OEM, ODM, private-label, or manufacturing sales coordination is preferred.'
    },
    'sample-development-technician': {
      title: 'Sample Development Technician',
      date: '10.21.2025',
      type: 'FULL-TIME',
      description: 'DJI Luggage is looking for a Sample Development Technician to support product trials, revisions, and technical handover before bulk production. You will help bridge buyer ideas and factory execution.',
      basicIntro: '2+ years of experience in sample making, product development, production support, or technical coordination.',
      preferredIntro: 'Experience with luggage, bags, sewing, shell assembly, trims, or hardware selection is preferred.'
    }
  };

  const fallbackSlug = document.body.dataset.jobSlug || location.pathname.split('/').filter(Boolean).pop();
  const job = jobs[fallbackSlug] || jobs['production-supervisor'];

  function documentLang(locale) {
    return locale === 'zh' ? 'zh-CN' : locale;
  }

  function applyLocaleToDocument() {
    document.documentElement.lang = documentLang(CURRENT_LOCALE);
    document.documentElement.dataset.locale = CURRENT_LOCALE;
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

  function localizeStaticLinks() {
    document.querySelectorAll('a[href^="/"]').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href) link.setAttribute('href', localizeUrl(href));
    });
  }

  function escapeHTML(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const brandLogo = 'DJI LUGGAGE';

  const socialIcons = `
    <a href="#" class="social-icon"><svg viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
    <a href="#" class="social-icon"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8Zm0 2a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8Zm5.2-.8a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/></svg></a>
    <a href="#" class="social-icon"><svg viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 11.85a29 29 0 0 0-.46-5.43ZM9.75 15.02V8.48l5.75 3.27-5.75 3.27Z"/></svg></a>
    <a href="https://wa.me/6285111384747" class="social-icon" aria-label="WhatsApp" target="_blank" rel="noopener"><svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.33 4.97L2.05 22l5.25-1.38a9.91 9.91 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91A9.85 9.85 0 0 0 19.05 4.91 9.85 9.85 0 0 0 12.04 2Zm.01 18.15h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.03-.2-.31a8.19 8.19 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.25-8.24a8.2 8.2 0 0 1 5.83 2.42 8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.25 8.23Zm4.52-6.17c-.25-.12-1.47-.73-1.7-.81-.23-.08-.4-.12-.57.12-.17.25-.65.81-.8.98-.15.17-.3.19-.55.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.14-.25-.02-.38.1-.5.11-.11.25-.3.37-.44.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.12-.57-1.37-.78-1.88-.2-.49-.41-.42-.57-.43l-.49-.01c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.09s.9 2.42 1.02 2.59c.12.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.29Z"/></svg></a>
  `;

  function listItem(text) {
    return `<ul><li><p>${escapeHTML(text)}</p></li></ul>`;
  }

  applyLocaleToDocument();

  document.title = `${job.title} - DJI Luggage`;
  document.body.innerHTML = `
    <header id="header" class="txt-dark">
      <a href="/" class="logo">${brandLogo}</a>
      <div class="hamburger" id="menuToggle" role="button" tabindex="0" aria-label="Open menu" aria-expanded="false" aria-controls="menuOverlay"><span></span><span></span></div>
      <a href="/contact" class="header-cta">GET A QUOTE</a>
    </header>

    <div class="menu-overlay" id="menuOverlay">
      <div class="menu-overlay-content">
        <div class="menu-inner">
          <div class="menu-top">
            <div class="menu-nav-section">
              <div class="menu-nav-label">Main</div>
              <nav class="menu-nav">
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/made-in-indonesia">Made in Indonesia</a>
                <a href="/services">Manufacturing</a>
                <a href="/products">Products</a>
                <a href="/platform">Capabilities</a>
                <a href="/newsroom/filters/all">Insights</a>
              </nav>
            </div>
            <div class="menu-contact-section">
              <div class="menu-section-label">Contact</div>
              <div class="menu-contact-btns">
                <a href="mailto:info@djiluggage.id" class="btn btn-dark menu-btn">Send Us A Message</a>
                <a href="/contact" class="btn btn-yellow menu-btn">Get a Quote</a>
              </div>
            </div>
          </div>
          <div class="menu-bottom">
            <div class="menu-quick-section">
              <div class="menu-section-label">Quick Contact</div>
              <div class="social-icons menu-social">${socialIcons}</div>
            </div>
            <div class="menu-address-section">
              <div class="menu-section-label">Address</div>
              <p class="menu-address-text">JL RAYA PARUNG BOGOR,<br>DESA/KELURAHAN KEMANG,<br>KEC. KEMANG, KAB. BOGOR,<br>PROVINSI JAWA BARAT,<br>KODE POS: 16310</p>
            </div>
            <div class="menu-footer-logo">${brandLogo}</div>
          </div>
        </div>
      </div>
    </div>

    <main class="job-main" data-header="dark">
      <aside class="job-sidebar">
        <div class="job-kicker">JOIN THE TEAM</div>
        <p>DJI Luggage is a Bogor-based luggage manufacturer supporting OEM, ODM, and private-label buyers.</p>
      </aside>

      <section class="job-content">
        <h1 class="job-title">${job.title}</h1>
        <div class="job-meta"><span>${job.date}</span><span>${job.type}</span></div>

        <h2 class="job-heading job-description-title">Job Description</h2>
        <p class="job-description-copy">${job.description}</p>

        <h2 class="job-heading responsibilities-title">Responsibilities</h2>
        <div class="job-list responsibilities-list">
          ${listItem('Coordinate daily work with production, quality, purchasing, and buyer-facing teams.')}
          ${listItem('Keep product specifications, sample feedback, and order requirements clear and documented.')}
          ${listItem('Track timelines, flag risks early, and help the team maintain reliable delivery standards.')}
          ${listItem('Support continuous improvement across luggage production, packing, and customer communication.')}
          ${listItem('Review buyer feedback and production data to improve future orders.')}
          ${listItem('Maintain practical documentation for samples, approvals, inspections, and handovers.')}
        </div>

        <h2 class="job-heading basic-title">Basic Requirements</h2>
        <p class="job-first-copy basic-first">${job.basicIntro}</p>
        <div class="job-list basic-list">
          ${listItem('Experience working in manufacturing, consumer goods, export, quality, or operations.')}
          ${listItem('Strong attention to detail and ability to keep work organized across multiple orders.')}
          ${listItem('Clear communication skills with internal teams, suppliers, and customers.')}
          ${listItem('Ability to prioritize practical work and solve problems calmly under production timelines.')}
          ${listItem('Comfortable working in a hands-on factory environment.')}
        </div>

        <h2 class="job-heading preferred-title">Preferred Requirements</h2>
        <p class="job-first-copy preferred-first">${job.preferredIntro}</p>
        <div class="job-list preferred-list">
          ${listItem('Experience with luggage, bags, plastic shell products, textiles, or travel goods.')}
          ${listItem('Familiarity with OEM or ODM order workflows.')}
          ${listItem('Ability to work with photos, specs, inspection notes, and buyer feedback.')}
          ${listItem('English or Mandarin communication skills are a plus for export coordination.')}
        </div>

        <div class="info-heading">Your info</div>
        <form class="application-form">
          <input type="text" placeholder="Full Name" aria-label="Full Name">
          <input type="email" placeholder="Your Email" aria-label="Your Email">
          <input type="url" placeholder="Your Linkedin" aria-label="Your Linkedin">
          <input type="url" placeholder="Link to portfolio or website" aria-label="Link to portfolio or website">
          <textarea placeholder="Addition Information" aria-label="Addition Information"></textarea>
          <button type="submit">Submit</button>
        </form>
        <a href="/careers" class="view-all">View All</a>
      </section>
    </main>

    <section class="final-cta" data-header="light">
      <picture><source type="image/webp" srcset="/assets/home/final-cta-bg.webp"><img class="final-cta-bg" src="/assets/home/final-cta-bg.png" alt="" loading="lazy"></picture>
      <div class="section-label">Ready To Build</div>
      <h2 class="cta-title">Start Your<br>Luggage Program</h2>
      <a href="/contact" class="btn btn-glass">Get a Quote</a>
    </section>

    <footer data-header="light">
      <div class="footer-top">
        <div>
          <div class="footer-contact-label">CONTACT</div>
          <div class="footer-contact">
            <h3>Let's Get Started</h3>
            <div class="divider"></div>
            <a href="/contact" class="btn btn-frosted" style="font-size:14px;">Get a Quote</a>
          </div>
        </div>
        <div class="footer-nav">
          <div class="footer-nav-col">
            <h4>ADDRESS</h4>
            <p>JL RAYA PARUNG BOGOR,<br>DESA/KELURAHAN KEMANG,<br>KEC. KEMANG, KAB. BOGOR,<br>PROVINSI JAWA BARAT,<br>KODE POS: 16310</p>
          </div>
          <div class="footer-nav-col">
            <h4>MAIN</h4>
            <a href="/">HOME</a>
            <a href="/services">MANUFACTURING</a>
            <a href="/products">PRODUCTS</a>
            <a href="/about">ABOUT</a>
            <a href="/made-in-indonesia">MADE IN INDONESIA</a>
            <a href="/careers">CAREERS</a>
            <a href="/platform">CAPABILITIES</a>
            <a href="/newsroom/filters/all">INSIGHTS</a>
          </div>
          <div class="footer-nav-col">
            <h4>SUPPORT</h4>
            <a href="/privacy-policy">PRIVACY POLICY</a>
          </div>
        </div>
      </div>
      <div class="footer-middle">
        <div class="footer-social-label">QUICK CONTACT</div>
        <div class="social-icons">${socialIcons}</div>
      </div>
      <div class="footer-bottom">
        <div class="footer-copyright">
          <span>&copy;2026 DJI Luggage. All rights reserved.</span>
          <span class="sep"></span>
          <span>Indonesian luggage manufacturer</span>
        </div>
        <div class="footer-large-text">DJI LUGGAGE</div>
      </div>
    </footer>
  `;
  localizeStaticLinks();

  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menuToggle');
  const menuOverlay = document.getElementById('menuOverlay');
  const navSections = Array.from(document.querySelectorAll('[data-header]'));

  function updateHeaderTheme() {
    const line = 37;
    let theme = 'dark';
    for (const section of navSections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) {
        theme = section.dataset.header;
        break;
      }
    }
    header.classList.toggle('txt-dark', theme === 'dark');
    header.classList.toggle('txt-light', theme !== 'dark');
  }

  function closeMenu() {
    menuOverlay.classList.remove('active');
    menuToggle.classList.remove('active');
    header.classList.remove('menu-open');
    document.body.classList.remove('menu-open');
  }

  function syncMenuA11y() {
    var open = menuOverlay.classList.contains('active');
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  menuToggle.addEventListener('click', function () {
    menuOverlay.classList.toggle('active');
    menuToggle.classList.toggle('active');
    header.classList.toggle('menu-open');
    document.body.classList.toggle('menu-open');
    syncMenuA11y();
  });
  menuToggle.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      menuToggle.click();
    }
  });
  syncMenuA11y();
  document.querySelectorAll('.menu-nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
  document.querySelector('.application-form').addEventListener('submit', function (event) {
    event.preventDefault();
  });
  window.addEventListener('scroll', updateHeaderTheme, { passive: true });
  window.addEventListener('resize', updateHeaderTheme);
  updateHeaderTheme();
})();
