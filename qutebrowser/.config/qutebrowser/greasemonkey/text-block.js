// ==UserScript==
// @name 文本块区域标记 (通用稳定版 V8)
// @namespace http://tampermonkey.net/
// @version 0.8
// @description 使用隐藏DOM元素进行通信，实现标记的Hint驱动、按需开启/关闭和文本提取，使用通用ID和Class名。
// @author Your Name (Stable DOM-Communicated Text Region)
// @include *
// @grant GM_addStyle
// @run-at document-idle
// ==/UserScript==

(function() {
  'use strict';

  return;

  // ====================================
  // 0. 核心隔离和工具
  // ====================================
  const uW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const OriginalTextEncoder = uW.TextEncoder;

  function getByteLength(str) {
    if (typeof str !== 'string') return 0;
    try {
      return new OriginalTextEncoder().encode(str).length;
    } catch (e) {
      return str.length * 2;
    }
  }

  // ====================================
  // 1. 常量定义 (使用通用、不含版本号的名称)
  // ====================================
  const DEFAULT_CONFIG = {
    MIN_TEXT_BYTE_LENGTH: 3,
  };

  // 样式和标记类名 (通用名称)
  const TARGET_TOGGLE_CLASS = 'highlight-region-active';
  const REGION_WRAPPER_CLASS = 'text-region-wrapper';
  const ANCHOR_CLASS = 'zero-width-anchor';

  // DOM 触发器 ID (通用名称)
  const TOGGLE_TRIGGER_ID = '__qutebrowser_region_trigger';
  const EXTRACT_TRIGGER_ID = '__qutebrowser_extract_trigger';
  // 临时 ID，用于 qutebrowser 选中元素后进行定位
  const TEMP_HINT_ID = '__temp_hint_target';

  // 核心排除选择器 (更新为通用名称)
  const EXCLUDE_SELECTORS = `script, style, head, meta, link, noscript, cite, svg, img, video, audio, object, embed, iframe, input, textarea, select, [contenteditable="true"], .gm-translation-area, .simple-inserted-translation-unified, .${REGION_WRAPPER_CLASS}, .${ANCHOR_CLASS}, #${TOGGLE_TRIGGER_ID}, #${EXTRACT_TRIGGER_ID}`;

  let isOutlineEnabled = false;

  // ====================================
  // 2. 样式注入
  // ====================================
  GM_addStyle(`
        /* 文本包裹的基础样式，使用通用类名 */
        .${REGION_WRAPPER_CLASS} {
            display: inline-block; 
            border: none;
            transition: all 0.2s ease-in-out;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: inherit !important;
            white-space: normal;
        }

        /* 边框切换时的样式 */
        .${REGION_WRAPPER_CLASS}.${TARGET_TOGGLE_CLASS} {
            padding: 2px 4px !important;
            border: 1px dashed #FF9800 !important;
            background-color: rgba(255, 152, 0, 0.1) !important;
            border-radius: 3px;
        }
        
        /* 零宽度锚点 */
        .${ANCHOR_CLASS} {
            display: inline;
            content: "\u200b";
            width: 0;
            height: 0;
            overflow: hidden;
            line-height: 0;
        }
    `);

  // ====================================
  // 3. 标记和清理逻辑 (核心)
  // ====================================

  function cleanupPreviousRegions() {
    // 清理包裹元素和锚点 (使用通用类名)
    document.querySelectorAll(`.${REGION_WRAPPER_CLASS}`).forEach(spanWrapper => {
      const textNode = spanWrapper.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const parent = spanWrapper.parentNode;
        if (parent) {
          parent.insertBefore(textNode, spanWrapper);
        }
      }
      spanWrapper.remove();
    });
    document.querySelectorAll(`.${ANCHOR_CLASS}`).forEach(anchor => anchor.remove());

    // 清理临时 Hint ID (使用通用ID)
    const tempTarget = document.getElementById(TEMP_HINT_ID);
    if (tempTarget) tempTarget.removeAttribute('id');

    isOutlineEnabled = false;
    console.log(`[区域标记] 标记已清理并禁用。`);
  }

  function processAndWrapTextNodes(node) {
    let count = 0;
    if (node.nodeType === Node.ELEMENT_NODE) {
      // 使用通用排除选择器
      if (node.matches(EXCLUDE_SELECTORS) || node.closest(EXCLUDE_SELECTORS)) return 0;
      const children = Array.from(node.childNodes);
      for (const child of children) {
        count += processAndWrapTextNodes(child);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '').trim();
      const parent = node.parentNode;

      if (!parent || parent.matches(EXCLUDE_SELECTORS) || parent.closest(EXCLUDE_SELECTORS)) return 0;
      if (getByteLength(text) < DEFAULT_CONFIG.MIN_TEXT_BYTE_LENGTH) return 0;

      const spanWrapper = document.createElement('span');
      spanWrapper.className = REGION_WRAPPER_CLASS; // 使用通用类名

      parent.insertBefore(spanWrapper, node);
      spanWrapper.appendChild(node);

      const anchor = document.createElement('span');
      anchor.className = ANCHOR_CLASS; // 使用通用类名
      parent.insertBefore(anchor, spanWrapper.nextSibling);

      count = 1;
    }
    return count;
  }


  /**
   * 切换标记区域的边框显示
   */
  function toggleBlockOutline(forceState) {
    if (forceState === isOutlineEnabled) return;

    if (forceState) {
      cleanupPreviousRegions();
      try {
        processAndWrapTextNodes(document.body);
      } catch (error) {
        console.error("[区域标记] 重新处理 DOM 失败:", error);
      }

      const wrappers = document.querySelectorAll(`.${REGION_WRAPPER_CLASS}`);
      if (wrappers.length > 0) {
        wrappers.forEach(el => { el.classList.add(TARGET_TOGGLE_CLASS); });
        isOutlineEnabled = true;
        if (typeof qutebrowser !== 'undefined') {
          qutebrowser.message.info(`[标记] 文本区域标记已启用，标记数: ${wrappers.length}`);
        }
      } else {
        if (typeof qutebrowser !== 'undefined') {
          qutebrowser.message.warning("[标记] 未找到可标记文本，Hint将失败。");
        }
        isOutlineEnabled = false;
      }

    } else {
      if (isOutlineEnabled) {
        cleanupPreviousRegions();
      }
    }
  }


  /**
   * 根据临时 ID 获取文本，并在完成后清理标记。
   */
  function extractTextAndCleanup() {
    const element = document.getElementById(TEMP_HINT_ID); // 使用通用ID
    let text = null;

    if (element) {
      // 查找最近的包裹元素 (使用通用类名)
      const wrapper = element.closest(`.${REGION_WRAPPER_CLASS}`);
      const targetElement = wrapper || element;

      // 提取文本
      const textNode = targetElement.firstChild;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        text = textNode.nodeValue.trim();
      } else {
        text = (targetElement.innerText || '').trim();
      }

      // 清理临时 ID
      element.removeAttribute('id');
    }

    // 无论是否提取成功，都关闭标记
    toggleBlockOutline(false);

    // 传递结果给 qutebrowser (通过 dataset)
    const extractTrigger = document.getElementById(EXTRACT_TRIGGER_ID); // 使用通用ID
    if (extractTrigger) {
      extractTrigger.dataset.result = text || ''; // 结果存储在 data-result 中
    }

    if (typeof qutebrowser !== 'undefined') {
      if (text) {
        qutebrowser.message.info(`[提取] 成功 (${text.substring(0, 50)}...)`);
      } else {
        qutebrowser.message.warning("[提取] 未提取到文本。");
      }
    }
  }


  // ====================================
  // 6. 隐藏DOM触发器设置 (DOM 通信核心)
  // ====================================

  // 6.1. 边框切换触发器
  let toggleTrigger = document.createElement('div');
  toggleTrigger.id = TOGGLE_TRIGGER_ID; // 使用通用ID
  toggleTrigger.style.cssText = 'position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
  document.documentElement.appendChild(toggleTrigger);

  toggleTrigger.addEventListener('click', function() {
    let incomingParams = {};
    if (toggleTrigger.dataset.params) {
      try {
        incomingParams = JSON.parse(toggleTrigger.dataset.params);
      } catch (e) {
        console.error("[标记] 解析外部参数失败:", e);
      }
    }

    const forceState = typeof incomingParams.forceState === 'boolean' ? incomingParams.forceState : !isOutlineEnabled;
    toggleBlockOutline(forceState);
    delete toggleTrigger.dataset.params;
  });

  // 6.2. 文本提取触发器
  let extractTrigger = document.createElement('div');
  extractTrigger.id = EXTRACT_TRIGGER_ID; // 使用通用ID
  extractTrigger.style.cssText = 'position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
  document.documentElement.appendChild(extractTrigger);

  extractTrigger.addEventListener('click', function() {
    extractTextAndCleanup();
  });

  console.log(`[区域标记 V8] 已加载。通信ID: #${TOGGLE_TRIGGER_ID}, #${EXTRACT_TRIGGER_ID}`);

})();
