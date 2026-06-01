/* Hero title char-by-char entrance — matches the homepage hero "open" effect.
   Splits any ".hero-anim-title" into per-character spans that rise/fade in. */
(function () {
  var els = document.querySelectorAll('.hero-anim-title');
  if (!els.length) return;
  els.forEach(function (el) {
    var text = el.textContent;
    el.setAttribute('aria-label', text);
    var html = '';
    for (var c = 0; c < text.length; c++) {
      var ch = text[c];
      var disp = ch === ' ' ? '&nbsp;'
        : ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += '<span class="hac" style="animation-delay:' + (c * 0.03) + 's">' + disp + '</span>';
    }
    el.innerHTML = html;
  });
})();
