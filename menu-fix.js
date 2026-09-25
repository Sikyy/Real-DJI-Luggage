(function () {
  function setupMenuSocialIconSwap() {
    document.querySelectorAll('.menu-social .social-icon, footer .social-icons .social-icon').forEach(function (icon) {
      if (icon.querySelector('.menu-social-icon-track')) return;

      var svg = icon.querySelector(':scope > svg');
      if (!svg) return;

      var clip = document.createElement('span');
      var track = document.createElement('span');
      var clone = svg.cloneNode(true);

      clip.className = 'menu-social-icon-clip';
      track.className = 'menu-social-icon-track';
      clone.setAttribute('aria-hidden', 'true');

      svg.replaceWith(clip);
      clip.appendChild(track);
      track.appendChild(svg);
      track.appendChild(clone);
    });
  }


  // 菜单按钮无障碍状态同步：role/aria-label 已在标记里，这里负责开合状态的实时更新，
  // 并补齐键盘操作（Enter / Space），让屏幕阅读器与 AI 代理都能正确识别与操作。
  function setupMenuToggleA11y() {
    var toggle = document.getElementById('menuToggle');
    var overlay = document.getElementById('menuOverlay');
    if (!toggle || !overlay) return;

    if (!toggle.hasAttribute('role')) toggle.setAttribute('role', 'button');
    if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex', '0');
    if (!toggle.hasAttribute('aria-controls')) toggle.setAttribute('aria-controls', 'menuOverlay');

    function sync() {
      var open = overlay.classList.contains('active');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    toggle.addEventListener('click', sync);
    toggle.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        toggle.click();
      }
    });
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupMenuSocialIconSwap();
      setupMenuToggleA11y();
    });
  } else {
    setupMenuSocialIconSwap();
    setupMenuToggleA11y();
  }
})();
