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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMenuSocialIconSwap);
  } else {
    setupMenuSocialIconSwap();
  }
})();
