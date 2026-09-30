/**
 * 站点通用脚本：语言标记 + 联系表单提交。
 *
 * 这里原本是 cms-connect.js —— 会从 Payload CMS 拉取 8 个 globals 来水合页面文案。
 * CMS 已下线：全站从未给 window.DJI_CMS_BASE 赋值，请求只会打到 http://localhost:3000
 * 并失败，所以那段代码从来没有生效过。相关代码（约 1300 行）已全部移除，
 * 页面文案现在完全由静态 HTML 提供。
 *
 * 保留的两件事：
 *   1. 语言标记（<html lang> 与 data-locale）与站内链接的 locale 前缀处理。
 *      目前只有 en 一种语言，localizeUrl() 实际上是恒等函数；
 *      保留是为了将来真要上线多语言时不必重写（对应 _redirects 里的相关注释）。
 *   2. 联系表单的提交处理。表单写的是 onsubmit="return false;"，
 *      没有这段 JS 就完全无法提交。
 *
 * 注意：表单绑定以前挂在 applyContactPage() 里、且在 if (!contact) return 之后，
 * 而 contact 只能来自那个永远失败的 CMS 请求 —— 也就是说线上表单一直是坏的。
 * 现在改为无条件绑定。
 */
(function () {
  const CONTACT_ENDPOINT = window.DJI_CONTACT_ENDPOINT || '/api/contact';
  const SUPPORTED_LOCALES = ['en', 'id', 'zh'];
  const DEFAULT_LOCALE = 'en';

  // 附件限制必须与 functions/api/contact.js 里的常量保持一致。
  // 前端先拦一道是为了给出即时反馈；真正的强制在后端（前端校验永远可被绕过）。
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_FILE_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg',
    'zip', 'rar', 'ai', 'psd', 'dwg',
  ];

  function detectLocale() {
    const firstSegment = window.location.pathname.split('/').filter(Boolean)[0];
    return SUPPORTED_LOCALES.includes(firstSegment) ? firstSegment : DEFAULT_LOCALE;
  }

  const CURRENT_LOCALE = detectLocale();

  const UI_COPY = {
    en: {
      contactRequired: 'Please leave an email or phone number.',
      sending: 'Sending...',
      fileTooLarge: 'That file is larger than 10 MB. Please compress it or share a link instead.',
      fileType: 'That file type is not supported. Please send PDF, Office, image, archive or design files.',
    },
    id: {
      contactRequired: 'Mohon isi email atau nomor telepon.',
      sending: 'Mengirim...',
      fileTooLarge: 'File tersebut lebih besar dari 10 MB. Mohon kompres atau kirim tautan.',
      fileType: 'Jenis file tersebut tidak didukung. Mohon kirim PDF, Office, gambar, arsip, atau file desain.',
    },
    zh: {
      contactRequired: '请留下邮箱或电话号码。',
      sending: '发送中...',
      fileTooLarge: '文件超过 10 MB，请压缩后重试，或改用链接分享。',
      fileType: '不支持该文件类型，请上传 PDF、Office、图片、压缩包或设计文件。',
    },
  };

  const COPY = UI_COPY[CURRENT_LOCALE] || UI_COPY[DEFAULT_LOCALE];

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
    const base = '/' + parts.join('/');
    if (base === '/') return '/';
    // 目录型页面统一带结尾斜杠。Cloudflare 会把无斜杠版本 308 到带斜杠版本，
    // 站内链接若不带斜杠，每次点击都会多一次重定向；这里既保留原有斜杠，
    // 也给漏写的补上。带扩展名的静态文件（.svg/.xml/.txt/.woff2 等）保持原样。
    const lastSegment = base.slice(base.lastIndexOf('/') + 1);
    if (lastSegment.includes('.')) return base;
    return base + '/';
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
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href) link.setAttribute('href', localizeUrl(href));
    });
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

  // 文件选中后把「+ File」换成文件名，让用户确认真选上了。
  // 文案节点是 .quote-file-text，样式见 contact/index.html 的 .quote-file。
  function updateFileLabel(fileInput) {
    if (!fileInput) return;
    const label = fileInput.closest('.quote-file');
    const text = label ? label.querySelector('.quote-file-text') : null;
    if (!text) return;
    const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    text.textContent = file ? file.name : 'File';
    if (label) label.dataset.hasFile = file ? 'true' : 'false';
  }

  function resetFileLabel(fileInput) {
    if (!fileInput) return;
    const label = fileInput.closest('.quote-file');
    const text = label ? label.querySelector('.quote-file-text') : null;
    if (text) text.textContent = 'File';
    if (label) label.dataset.hasFile = 'false';
  }

  function bindContactForm() {
    const form = document.querySelector('.quote-form');
    if (!form || form.dataset.submitBound === 'true') return;
    form.dataset.submitBound = 'true';

    const fileInputEl = form.querySelector('input[type="file"]');
    if (fileInputEl) {
      resetFileLabel(fileInputEl);
      fileInputEl.addEventListener('change', () => updateFileLabel(fileInputEl));
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const inputs = Array.from(form.querySelectorAll('input:not([type="file"])'));
      const selects = Array.from(form.querySelectorAll('select'));
      const fileInput = form.querySelector('input[type="file"]');
      const textarea = form.querySelector('textarea');
      const button = form.querySelector('.quote-submit');
      const defaultLabel = button ? button.textContent : '';
      const countryCode = selects[0] ? selects[0].value : '';
      const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
      const payload = {
        customerName: fieldValue(inputs, 0),
        email: fieldValue(inputs, 1),
        phone: (countryCode ? countryCode + ' ' : '') + fieldValue(inputs, 2),
        companyName: fieldValue(inputs, 3),
        businessCategory: selects[1] ? selects[1].value : '',
        message: textarea && textarea.value ? textarea.value.trim() : '',
        sourceUrl: window.location.href,
      };
      payload.emailOrPhone = [payload.email, payload.phone].filter(Boolean).join(' / ');
      payload.productType = payload.businessCategory;

      if (!payload.email && !fieldValue(inputs, 2)) {
        setFormStatus(form, COPY.contactRequired, 'error');
        return;
      }

      // 附件在后端是不可信的：这里只是提前给出反馈，后端会重新校验扩展名、大小和魔数。
      if (file) {
        if (file.size > MAX_FILE_BYTES) {
          setFormStatus(form, COPY.fileTooLarge, 'error');
          return;
        }
        const extension = file.name.includes('.')
          ? file.name.split('.').pop().toLowerCase()
          : '';
        if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) {
          setFormStatus(form, COPY.fileType, 'error');
          return;
        }
      }

      if (button) {
        button.disabled = true;
        button.textContent = COPY.sending;
      }

      try {
        // 用 multipart 而不是 JSON：JSON 装不下文件字节。
        // 注意不要手动设置 Content-Type —— 浏览器需要自己补 boundary。
        const body = new FormData();
        Object.keys(payload).forEach((key) => body.append(key, payload[key]));
        if (file) body.append('attachment', file, file.name);

        const response = await fetch(CONTACT_ENDPOINT, {
          method: 'POST',
          body,
        });
        if (!response.ok) throw new Error('Contact submission failed with ' + response.status);
        form.reset();
        if (fileInput) fileInput.value = '';
        resetFileLabel(fileInput);
        setFormStatus(form, 'Inquiry sent. We will contact you shortly.', 'success');
        if (button) button.textContent = defaultLabel || 'Send Inquiry';

        // GA4 转化事件。只推送非个人数据（不含姓名、邮箱、电话、公司名）。
        // 同意状态由 Consent Mode v2 处理：analytics_storage 未授权时 GA4 不写 cookie。
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: 'generate_lead',
          form_id: 'quote_form',
          product_type: payload.businessCategory || 'unspecified',
          page_path: window.location.pathname,
        });
      } catch (error) {
        console.warn('[DJI Luggage] Contact form submission failed.', error);
        setFormStatus(
          form,
          'Unable to send right now. Please try again or email us directly.',
          'error',
        );
        if (button) button.textContent = defaultLabel || 'Send Inquiry';
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  function connect() {
    applyLocaleToDocument();
    localizeStaticLinks();
    bindContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connect);
  } else {
    connect();
  }
})();
