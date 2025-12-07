// ==UserScript==
// @name         键盘模拟点击关闭浮窗
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  通过 Esc 键模拟点击页面上的隐藏元素，触发浮窗的外部点击关闭逻辑。
// @include *
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  const decoyElement = document.createElement('div');
  decoyElement.id = 'tampermonkey-decoy-clicker';


  decoyElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 1px;
        height: 1px;
        opacity: 0; /* 完全透明 */
        z-index: 99999; /* 确保它在最上层，能够被“点击”到 */
        pointer-events: auto; /* 必须是 auto，才能接收点击事件 */
    `;

  decoyElement.addEventListener('click', (e) => {
    console.log("decoy element clicked")
  });

  document.body.appendChild(decoyElement);
})();
