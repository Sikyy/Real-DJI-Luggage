/**
 * Cookie 同意横幅逻辑。
 *
 * 与 <head> 里的 Consent Mode v2 默认值脚本配合：
 *   - 默认脚本负责「声明全部 denied，并在已同意时立刻 update」——必须在 GTM 之前执行
 *   - 本文件只负责横幅 UI、写入 localStorage、以及在用户点击时推送 consent update
 *
 * 授权范围刻意只给 analytics_storage：本站不投放广告，
 * 因此 ad_storage / ad_user_data / ad_personalization 始终保持 denied。
 */
(function () {
  'use strict';

  // 职位详情页会在运行时用 document.body.innerHTML 整体重建 body，横幅与页脚入口
  // 都是新节点，先前绑定的监听器随之失效。所以这里包成可重复调用的函数并挂到
  // window 上，谁重建了 DOM 谁负责再调一次 —— 比重新追加 <script> 可靠。
  function initConsent() {
    var KEY = 'dji_consent_v1';
    var banner = document.getElementById('cookieBanner');
    var settings = document.getElementById('cookieSettings');
    if (!banner) return;

    /** 直接用 dataLayer.push，避免依赖 gtag() 是否已加载 */
    function pushConsent(state) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(['consent', 'update', { analytics_storage: state }]);
    }

    function read() {
      try { return localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function write(value) {
      try { localStorage.setItem(KEY, value); } catch (e) { /* 隐私模式下忽略 */ }
    }

    function apply(state) {
      write(state);
      pushConsent(state);
      banner.hidden = true;
      if (settings) settings.hidden = false;
    }

    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      apply(button.getAttribute('data-consent'));
    });

    // 允许随时撤回或更改选择
    if (settings) {
      settings.addEventListener('click', function (event) {
        // 页脚里是个 <a href="#">，阻止默认锚点跳转
        event.preventDefault();
        banner.hidden = false;
        settings.hidden = true;
      });
    }

    var stored = read();
    if (stored === 'granted' || stored === 'denied') {
      banner.hidden = true;
      if (settings) settings.hidden = false;
    } else {
      banner.hidden = false;
    }
  }

  window.__initConsent = initConsent;
  initConsent();
  })();
