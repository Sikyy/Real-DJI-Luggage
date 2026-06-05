/* Word-by-word scroll reveal for ".word-reveal" elements — matches the
   homepage "We empower" effect. Each word fades from faint to full as the
   element scrolls up through the viewport. */
(function () {
  var els = [].slice.call(document.querySelectorAll('.word-reveal'));
  if (!els.length) return;

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var tokenRe = /(\s+|[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]|[^\s\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]+)/g;

  function revealHTML(text) {
    return (String(text || '').trim().match(tokenRe) || []).map(function (segment) {
      if (/^\s+$/.test(segment)) return ' ';
      return '<span class="wr-w">' + esc(segment) + '</span>';
    }).join('');
  }

  var style = document.createElement('style');
  style.textContent = '.word-reveal{opacity:1 !important;transform:none !important}' +
    '.word-reveal .wr-w{opacity:.16;transition:opacity .12s linear}';
  document.head.appendChild(style);

  els.forEach(function (el) {
    el.innerHTML = revealHTML(el.textContent);
    el._w = el.querySelectorAll('.wr-w');
  });

  function update() {
    var vh = window.innerHeight;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var start = vh * 0.85, end = vh * 0.38;
      var p = (start - r.top) / (start - end);
      p = Math.max(0, Math.min(1, p));
      var reveal = p * (el._w.length + 4);
      for (var i = 0; i < el._w.length; i++) {
        el._w[i].style.opacity = Math.max(0.16, Math.min(1, reveal - i));
      }
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
