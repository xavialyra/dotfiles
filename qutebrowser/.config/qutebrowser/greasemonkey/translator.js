// ==UserScript==
// @name 全页翻译并保留原文
// @namespace http://tampermonkey.net/
// @version 0.1
// @description 统一翻译结果样式，根据文本长度智能决定是内联显示（不换行）还是块级显示（换行）。增加了对 <cite> 标签的排除，避免翻译面包屑路径。集成了微软翻译服务，不进行配置持久化。
// @author You (Optimized V4.1.3 with Microsoft Translate, no persistence)
// @include *
// @grant GM_addStyle
// @grant GM_xmlhttpRequest
// @run-at document-idle
// ==/UserScript==

// 注意：这里不再需要手动声明 var unsafeWindow = ...; 
// 在 Tampermonkey 中，unsafeWindow 通常是直接可用的。

(function() {
  'use strict';
  return;

  // ====================================
  // 0. 核心修复：隔离被污染的原生方法
  // 
  // 如果 unsafeWindow 不存在（理论上不该发生，但作为沙箱防御），则使用 window。
  const uW = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

  // 确保绑定原生的方法，以避免网页脚本的污染（Illegal invocation）
  const originalSetTimeout = uW.setTimeout.bind(uW);
  const originalClearTimeout = uW.clearTimeout.bind(uW);

  const OriginalPromise = uW.Promise;
  const OriginalTextEncoder = uW.TextEncoder;

  // ====================================
  // 1. 常量定义
  // ====================================
  const DEFAULT_CONFIG = {
    INLINE_TRANSLATE_BYTE_LIMIT: 50,
    MIN_TEXT_BYTE_LENGTH: 10,
    MAX_TEXT_BYTE_LENGTH: 7500,
    BATCH_SIZE: 10,
    BATCH_DELAY_MS: 1000,
    DEBOUNCE_SCROLL_MS: 500,
    // 默认翻译服务及语言，可以在触发时覆盖
    translationService: 'microsoft-translator',
    microsoftApiKey: '',
    microsoftRegion: '',
    targetLanguage: 'zh-Hans'
  };
  const TRANSLATION_UNIFIED_CLASS = 'simple-inserted-translation-unified';
  const EXCLUDE_SELECTORS = 'script, style, head, nav, footer, aside, .sidebar, .menu, #comments, [role="navigation"], code, pre, [role="button"], [aria-hidden="true"], svg, img, button, input, textarea, select, [contenteditable="true"], span.mwe-math-element, meta, link, noscript, cite';
  const BLOCK_OR_SEMANTIC_DELIMITERS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, article, section, dd, dt, table, thead, tbody, tfoot, tr, td, th, div';
  const TRANSPARENT_INLINE_TAGS = 'span, strong, em, b, i, small, sup, sub, label';
  const LINK_TAG_NAME = 'A';
  const AD_AND_SCRIPT_CONTAINERS = '#tads, .ad-container, .ads, .ad, [id*="ad_"], [class*="ad_"], [id*="google_ads"], [class*="google_ads"], .guymc, #tvcap, #taw';
  const URL_REGEX = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/[a-zA-Z0-9]+\.[^\s]{2,}|[a-zA-Z0-9]+\.[^\s]{2,})$/i;
  const CODE_REGEX = /^\s*(\{[\s\S]*\}|\[[\s\S]*\]|\<[\s\S]*\>|\/\*[\s\S]*\*\/|`[\s\S]*`)\s*$/i;
  const PURE_SYMBOLS_REGEX = /^[\s.,;?!+\-*/=(){}[\]<>"'`:_#@%^&|$~\\`\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65\u3000-\u303F\uFF00]+$/u;
  const PURE_NUMBER_LIKE_REGEX = /^\s*([+-]?\s*\d[\d,.]*(?:[eE][-+]?\d+)?|\([\d,.]+\))\s*$/;

  let isTranslated = false;
  let translationQueue = [];
  let currentlyTranslating = false;
  let translatedUnits = new Set();
  let scrollTimeout = null;
  let currentScrollHandler = null;
  let activeSessionConfig = { ...DEFAULT_CONFIG };

  // ====================================
  // 2. 样式注入
  // ====================================
  GM_addStyle(`
    .${TRANSLATION_UNIFIED_CLASS} {
      padding: 2px 5px !important;
      border: 1px dashed #4CAF50 !important;
      background-color: #e6ffe6 !important;
      color: #333 !important;
      font-size: .85em !important;
      line-height: 1.2 !important;
      transition: opacity .3s ease-in-out;
      box-sizing: border-box !important;
      text-overflow: unset !important;
      border-radius: 3px;
      margin-left: 0.5em !important;
      display: inline !important;
      white-space: nowrap;
      overflow: visible !important;
    }
    .${TRANSLATION_UNIFIED_CLASS}.block-mode {
      display: block !important;
      margin-top: 5px !important;
      margin-left: 0 !important;
      padding: 8px 12px !important;
      border-left: 4px solid #4CAF50 !important;
      border-top: none !important;
      border-right: none !important;
      border-bottom: none !important;
      white-space: normal;
      border-radius: 0;
    }
    .unclamp-parent {
      -webkit-line-clamp: unset !important;
      line-clamp: unset !important;
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
      display: block !important;
      -webkit-box-orient: unset !important;
      text-overflow: unset !important;
      white-space: normal !important;
    }
    .${TRANSLATION_UNIFIED_CLASS} p {
      margin:0!important;
      padding:0!important;
      color:#333!important;
      font-size:1em!important;
      line-height:1.4!important;
      display: inline;
    }
    .br-before-block-translation {
        display: block;
        margin-top: 5px;
    }
  `);

  // ====================================
  // 3. 翻译 API 服务实现
  // ====================================

  /**
   * 模拟翻译服务 (使用 OriginalPromise 和 originalSetTimeout)
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译结果
   */
  async function mockTranslateService(text) {
    return new OriginalPromise(resolve => {
      originalSetTimeout(() => { // 确保使用原生的 setTimeout
        const byteLength = getByteLength(text);
        const mockTranslation = `【模拟译文-V4.1.3 字节:${byteLength}】${text}`;
        resolve(mockTranslation);
      }, Math.random() * 500 + 200);
    });
  }

  /**
   * 微软翻译 API 服务实现 (使用 OriginalPromise 和 uW.crypto)
   * @param {string} text - 要翻译的文本
   * @returns {Promise<string>} 翻译结果
   */
  async function microsoftTranslateService(text) {
    const apiKey = activeSessionConfig.microsoftApiKey;
    const region = activeSessionConfig.microsoftRegion;
    const targetLang = activeSessionConfig.targetLanguage;
    const endpoint = 'https://api.cognitive.microsofttranslator.com';

    if (!apiKey || !region || !targetLang) {
      console.error("Microsoft Translator API: 缺少 apiKey, region 或 targetLanguage 配置。", { apiKey, region, targetLang });
      throw new Error("Microsoft Translator API: 请在触发时提供有效的 API Key, Region 和 Target Language。");
    }

    try {
      const gmxhrResponse = await new OriginalPromise((resolve, reject) => { // 确保使用 OriginalPromise
        GM_xmlhttpRequest({
          method: "POST",
          url: `${endpoint}/translate?api-version=3.0&to=${targetLang}`,
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
            "Ocp-Apim-Subscription-Region": region,
            "Content-Type": "application/json",
            "X-ClientTraceId": uW.crypto.randomUUID() // 使用 uW.crypto
          },
          data: JSON.stringify([{ "Text": text }]),
          responseType: "text",
          timeout: 10000,
          onload: function(res) {
            resolve(res);
          },
          onerror: function(err) {
            reject(new Error(`GM_xmlhttpRequest error: ${err.status} ${err.statusText}`));
          },
          ontimeout: function() {
            reject(new Error("GM_xmlhttpRequest timeout."));
          }
        });
      });

      if (gmxhrResponse.status !== 200) {
        throw new Error(`Microsoft Translator API request failed with status: ${gmxhrResponse.status}. Response: ${gmxhrResponse.responseText}`);
      }

      let responseData;
      try {
        responseData = JSON.parse(gmxhrResponse.responseText);
      } catch (jsonError) {
        throw new Error(`Failed to parse Microsoft Translator API response as JSON: ${jsonError.message}. ResponseText: ${gmxhrResponse.responseText}`);
      }

      if (responseData && responseData.length > 0 && responseData[0].translations && responseData[0].translations.length > 0) {
        return responseData[0].translations[0].text;
      } else {
        console.error("Microsoft Translator API request failed. Response data does not contain expected translation structure:", responseData);
        const errorMessage = responseData && responseData.error && responseData.error.message
          ? responseData.error.message
          : `Unexpected response structure from API (Status: ${gmxhrResponse.status})`;
        throw new Error(`Failed to translate with Microsoft Translator API: ${errorMessage}`);
      }
    } catch (error) {
      console.log("Error communicating with Microsoft Translator API:", error);
      throw error;
    }
  }

  // 翻译服务映射表
  const TRANSLATION_SERVICES = {
    'mock': mockTranslateService,
    'microsoft-translator': microsoftTranslateService,
  };

  // 当前激活的翻译服务函数
  let _currentTranslateService = TRANSLATION_SERVICES[DEFAULT_CONFIG.translationService];

  // 封装函数，供其他代码调用
  function $translateText(text) {
    if (!_currentTranslateService) {
      console.error("No translation service is set or service name is invalid. Using mock service as fallback.");
      _currentTranslateService = mockTranslateService;
    }
    return _currentTranslateService(text);
  }

  // ====================================
  // 4. DOM 遍历和核心翻译逻辑
  // ====================================

  /**
   * 使用 OriginalTextEncoder
   */
  function getByteLength(str) {
    return new OriginalTextEncoder().encode(str).length;
  }

  function isElementInViewport(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const rect = node.getBoundingClientRect();
    return (
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.left <= (window.innerWidth || document.documentElement.clientWidth) &&
      rect.bottom >= 0 &&
      rect.right >= 0
    );
  }

  function createTranslationBlock(insertionReferenceNode, content, unit, isLoading = false) {
    if (!insertionReferenceNode || !insertionReferenceNode.parentNode) {
      return null;
    }
    const parentToInsertIn = insertionReferenceNode.parentNode;
    const isBlockMode = unit.isBlockMode;
    const block = document.createElement('div');
    block.className = `${TRANSLATION_UNIFIED_CLASS} ${isLoading ? 'loading-temp' : ''}`;
    if (isBlockMode) {
      block.classList.add('block-mode');
    }
    let pElement = document.createElement('p');
    pElement.innerHTML = content;
    block.appendChild(pElement);

    if (isBlockMode) {
      const br = document.createElement('span');
      br.className = `br-before-block-translation`;
      parentToInsertIn.insertBefore(br, insertionReferenceNode.nextSibling);
      parentToInsertIn.insertBefore(block, br.nextSibling);
    } else {
      parentToInsertIn.insertBefore(block, insertionReferenceNode.nextSibling);
    }

    let unclampTarget = parentToInsertIn.closest('[style*="-webkit-line-clamp"],[style*="line-clamp"]') || parentToInsertIn.closest('div, p, li, article, section, h1, h2, h3, h4, h5, h6, blockquote, dd');
    if (unclampTarget) {
      unclampTarget.classList.add('unclamp-parent');
      unclampTarget.style.setProperty('-webkit-line-clamp', 'unset', 'important');
      unclampTarget.style.setProperty('line-clamp', 'unset', 'important');
      unclampTarget.style.setProperty('overflow', 'visible', 'important');
      unclampTarget.style.setProperty('max-height', 'none', 'important');
      unclampTarget.style.setProperty('height', 'auto', 'important');
      if (window.getComputedStyle(unclampTarget).display === '-webkit-box' && window.getComputedStyle(unclampTarget)['-webkit-box-orient'] === 'vertical') {
        unclampTarget.style.setProperty('display', 'block', 'important');
        unclampTarget.style.setProperty('-webkit-box-orient', 'unset', 'important');
      }
    }
    return block;
  }

  function recursiveCollectTextNodes(node, collection, currentContext = { isWithinExternalLink: false }) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains(TRANSLATION_UNIFIED_CLASS) ||
        node.matches(EXCLUDE_SELECTORS) ||
        node.closest(AD_AND_SCRIPT_CONTAINERS)) {
        return;
      }
      if (node.parentNode && (node.parentNode.classList.contains(TRANSLATION_UNIFIED_CLASS) ||
        node.parentNode.matches(EXCLUDE_SELECTORS) ||
        node.parentNode.closest(AD_AND_SCRIPT_CONTAINERS))) {
        return;
      }
    }

    let newContext = { ...currentContext };
    let isLocalForcedBoundaryContainer = false;

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === LINK_TAG_NAME) {
        const href = node.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//'))) {
          newContext.isWithinExternalLink = true;
        } else {
          newContext.isWithinExternalLink = false;
        }
      }

      isLocalForcedBoundaryContainer = (
        node.matches(BLOCK_OR_SEMANTIC_DELIMITERS) ||
        (node.tagName !== LINK_TAG_NAME && !node.matches(TRANSPARENT_INLINE_TAGS) && node.childNodes.length > 0)
      );

      if (isLocalForcedBoundaryContainer && collection.length > 0 &&
        collection[collection.length - 1].type !== 'boundary') {
        collection.push({ type: 'boundary', node: node, context: currentContext });
      }
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.nodeValue || '').trim();
      if (text.length > 0) {
        collection.push({ type: 'text', node: node, text: text, context: currentContext });
      }
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        recursiveCollectTextNodes(node.childNodes[i], collection, newContext);
      }
      if (isLocalForcedBoundaryContainer && collection.length > 0 &&
        collection[collection.length - 1].type !== 'boundary') {
        collection.push({ type: 'boundary', node: node, context: currentContext });
      }
    }
  }


  function mergeTranslatableUnits(fragmentList) {
    const mergedUnits = [];
    let currentUnit = { text: '', nodes: [], contexts: [] };

    for (let i = 0; i < fragmentList.length; i++) {
      const fragment = fragmentList[i];

      if (fragment.type === 'text') {
        currentUnit.text += (currentUnit.text.length > 0 ? ' ' : '') + fragment.text;
        currentUnit.nodes.push(fragment.node);
        currentUnit.contexts.push(fragment.context);
      } else if (fragment.type === 'boundary') {
        if (currentUnit.text.length > 0) {
          mergedUnits.push(currentUnit);
        }
        currentUnit = { text: '', nodes: [], contexts: [] };
      }
    }
    if (currentUnit.text.length > 0) {
      mergedUnits.push(currentUnit);
    }

    return mergedUnits.map(unit => {
      let effectiveInsertionPoint = null;
      if (unit.nodes.length > 0) {
        effectiveInsertionPoint = unit.nodes[unit.nodes.length - 1];
      } else {
        return null;
      }

      let unclampHostNode = null;
      if (unit.nodes.length === 1) {
        unclampHostNode = unit.nodes[0];
      } else {
        unclampHostNode = unit.nodes[0];
        for (let j = 1; j < unit.nodes.length; j++) {
          unclampHostNode = findCommonAncestor(unclampHostNode, unit.nodes[j]);
        }
        if (unclampHostNode && unclampHostNode.nodeType === Node.TEXT_NODE) {
          unclampHostNode = unclampHostNode.parentNode;
        }
      }
      unclampHostNode = unclampHostNode || document.body;

      const trimmedText = unit.text.replace(/\s+/g, ' ');

      let shouldTranslate = true;
      const textByteLength = getByteLength(trimmedText);

      if (textByteLength < activeSessionConfig.MIN_TEXT_BYTE_LENGTH || textByteLength > activeSessionConfig.MAX_TEXT_BYTE_LENGTH) {
        shouldTranslate = false;
      } else if (URL_REGEX.test(trimmedText)) {
        shouldTranslate = false;
      } else if (CODE_REGEX.test(trimmedText)) {
        shouldTranslate = false;
      } else if (PURE_SYMBOLS_REGEX.test(trimmedText.replace(/\s/g, ''))) {
        shouldTranslate = false;
      } else if (PURE_NUMBER_LIKE_REGEX.test(trimmedText)) {
        shouldTranslate = false;
      }

      if (unit.nodes.some(n => {
        const parent = n.parentNode;
        return parent && (parent.classList.contains(TRANSLATION_UNIFIED_CLASS) || parent.matches(EXCLUDE_SELECTORS) || parent.closest(AD_AND_SCRIPT_CONTAINERS));
      })) {
        shouldTranslate = false;
      }


      if (!shouldTranslate) {
        return null;
      }

      return {
        effectiveInsertionPoint: effectiveInsertionPoint,
        unclampHostNode: unclampHostNode,
        text: trimmedText,
        isExternalLinkTextUnit: unit.contexts.length > 0 && unit.contexts.every(ctx => ctx.isWithinExternalLink),
        isBlockMode: textByteLength >= activeSessionConfig.INLINE_TRANSLATE_BYTE_LIMIT
      };
    }).filter(Boolean);
  }

  function findCommonAncestor(nodeA, nodeB) {
    if (nodeA === nodeB) return nodeA;
    if (!nodeA || !nodeB || nodeA === document || nodeB === document) return document.body;

    if (nodeA.contains(nodeB)) return nodeA;
    if (nodeB.contains(nodeA)) return nodeB;

    const pathA = [];
    let current = nodeA;
    while (current && current !== document.body && current !== document.documentElement) {
      pathA.unshift(current);
      current = current.parentNode;
    }
    if (current) pathA.unshift(current);

    const pathB = [];
    current = nodeB;
    while (current && current !== document.body && current !== document.documentElement) {
      pathB.unshift(current);
      current = current.parentNode;
    }
    if (current) pathB.unshift(current);

    let commonAncestor = null;
    let i = 0;
    while (i < pathA.length && i < pathB.length && pathA[i] === pathB[i]) {
      commonAncestor = pathA[i];
      i++;
    }
    return commonAncestor;
  }

  function collectTranslatableElements() {
    const rawFragmentList = [];
    recursiveCollectTextNodes(document.body, rawFragmentList);
    const elementsToTranslate = mergeTranslatableUnits(rawFragmentList);

    elementsToTranslate.sort((a, b) => {
      if (!a.effectiveInsertionPoint || !b.effectiveInsertionPoint) {
        return 0;
      }
      const docPosition = a.effectiveInsertionPoint.compareDocumentPosition(b.effectiveInsertionPoint);
      if (docPosition & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (docPosition & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });

    return elementsToTranslate;
  }


  async function processNextTranslationBatch() {
    if (currentlyTranslating) return;
    if (!isTranslated) {
      currentlyTranslating = false;
      translationQueue = [];
      return;
    }

    if (translationQueue.length === 0) {
      currentlyTranslating = false;
      if (typeof qutebrowser !== 'undefined') {
        qutebrowser.message.info("所有可视区域可翻译内容已处理完成。");
      }
      return;
    }

    currentlyTranslating = true;
    const batch = [];
    const elementsToRemoveFromQueue = [];

    for (let i = 0; i < translationQueue.length; i++) {
      const unit = translationQueue[i];
      if (!unit) {
        elementsToRemoveFromQueue.push(i);
        continue;
      }

      let canProcess = true;
      let insertionRef = unit.effectiveInsertionPoint;
      if (!document.body.contains(insertionRef) || translatedUnits.has(insertionRef)) {
        canProcess = false;
      } else {
        let currentParent = insertionRef.nodeType === Node.TEXT_NODE ? insertionRef.parentNode : insertionRef;
        while (currentParent && currentParent !== document.body) {
          if (currentParent.classList.contains(TRANSLATION_UNIFIED_CLASS) || currentParent.matches(EXCLUDE_SELECTORS) || currentParent.closest(AD_AND_SCRIPT_CONTAINERS)) {
            canProcess = false;
            break;
          }
          currentParent = currentParent.parentNode;
        }
      }

      if (canProcess && isElementInViewport(unit.effectiveInsertionPoint)) {
        batch.push(unit);
        elementsToRemoveFromQueue.push(i);
        if (batch.length >= activeSessionConfig.BATCH_SIZE) break;
      }
    }

    for (let i = elementsToRemoveFromQueue.length - 1; i >= 0; i--) {
      translationQueue.splice(elementsToRemoveFromQueue[i], 1);
    }

    if (batch.length === 0) {
      currentlyTranslating = false;
      originalSetTimeout(processNextTranslationBatch, activeSessionConfig.BATCH_DELAY_MS * 2); // 使用原生的 setTimeout
      return;
    }

    const translationPromises = [];
    const loadingBlocks = [];

    for (const unit of batch) {
      if (unit && unit.effectiveInsertionPoint && !translatedUnits.has(unit.effectiveInsertionPoint)) {
        const loadingBlock = createTranslationBlock(unit.effectiveInsertionPoint, '正在翻译...', unit, true);
        if (loadingBlock) {
          loadingBlocks.push(loadingBlock);
          translationPromises.push($translateText(unit.text));
          translatedUnits.add(unit.effectiveInsertionPoint);
        }
      }
    }

    const results = await OriginalPromise.allSettled(translationPromises); // 使用原生的 Promise.allSettled

    results.forEach((result, index) => {
      const loadingBlock = loadingBlocks[index];
      const originalUnit = batch[index];

      if (loadingBlock && originalUnit) {
        if (result.status === 'fulfilled') {
          const translatedText = result.value;
          const translatedP = document.createElement('p');
          translatedP.innerHTML = translatedText;
          loadingBlock.className = TRANSLATION_UNIFIED_CLASS;
          if (originalUnit.isBlockMode) {
            loadingBlock.classList.add('block-mode');
          }
          loadingBlock.innerHTML = '';
          loadingBlock.appendChild(translatedP);
        } else {
          console.error("[全页翻译脚本] 批次翻译失败:", result.reason);
          loadingBlock.innerHTML = `<p>翻译失败 - ${result.reason.message || '未知错误'}</p>`;
          loadingBlock.style.border = '1px solid red';
          loadingBlock.style.backgroundColor = '#ffe6e6';
        }
      }
    });

    currentlyTranslating = false;

    if (translationQueue.length > 0) {
      originalSetTimeout(processNextTranslationBatch, activeSessionConfig.BATCH_DELAY_MS); // 使用原生的 setTimeout
    } else {
      if (typeof qutebrowser !== 'undefined') {
        qutebrowser.message.info("所有可视区域可翻译内容已处理完成。");
      }
    }
  }

  async function translatePage(sessionConfig) {
    if (isTranslated) return;

    if (currentScrollHandler) {
      window.removeEventListener('scroll', currentScrollHandler);
      window.removeEventListener('resize', currentScrollHandler);
    }

    activeSessionConfig = { ...DEFAULT_CONFIG, ...sessionConfig };

    const serviceName = activeSessionConfig.translationService;
    _currentTranslateService = TRANSLATION_SERVICES[serviceName] || mockTranslateService;
    if (!TRANSLATION_SERVICES[serviceName]) {
      console.warn(`全页翻译：指定的翻译服务 '${serviceName}' 不存在，将使用模拟服务。`);
      if (typeof qutebrowser !== 'undefined') {
        qutebrowser.message.warning(`全页翻译：指定的翻译服务 '${serviceName}' 不存在，将使用模拟服务。`);
      }
    } else {
      console.log(`全页翻译：正在使用 ${serviceName} 翻译服务。`);
    }

    console.log("全页翻译：正在使用配置:", activeSessionConfig);

    const allTranslatableElements = collectTranslatableElements();
    if (allTranslatableElements.length === 0) {
      if (typeof qutebrowser !== 'undefined') {
        qutebrowser.message.info("未找到任何可翻译内容。");
      }
      isTranslated = false;
      return;
    }

    console.log(`全页翻译：检测到 ${allTranslatableElements.length} 个可翻译的文本单元，将分批处理。`);
    translationQueue = allTranslatableElements;
    isTranslated = true;

    processNextTranslationBatch();

    currentScrollHandler = () => {
      if (scrollTimeout) originalClearTimeout(scrollTimeout); // 使用原生的 clearTimeout
      scrollTimeout = originalSetTimeout(() => { // 使用原生的 setTimeout
        if (isTranslated) {
          processNextTranslationBatch();
        }
      }, activeSessionConfig.DEBOUNCE_SCROLL_MS);
    };
    window.addEventListener('scroll', currentScrollHandler, { passive: true });
    window.addEventListener('resize', currentScrollHandler, { passive: true });
    console.log("全页翻译：滚动和窗口大小调整监听器已启用。");
  }

  function removeTranslations() {
    document.querySelectorAll(`.${TRANSLATION_UNIFIED_CLASS}`).forEach(el => {
      const parent = el.parentElement;
      if (parent) {
        if (el.classList.contains('block-mode')) {
          const prevSibling = el.previousElementSibling;
          if (prevSibling && prevSibling.classList.contains(`br-before-block-translation`)) {
            prevSibling.remove();
          }
        }
      }
      el.remove();
    });

    document.querySelectorAll('.unclamp-parent').forEach(up => {
      if (!up.querySelector(`.${TRANSLATION_UNIFIED_CLASS}`)) {
        up.classList.remove('unclamp-parent');
        up.style.removeProperty('-webkit-line-clamp');
        up.style.removeProperty('line-clamp');
        up.style.removeProperty('overflow');
        up.style.removeProperty('max-height');
        up.style.removeProperty('height');
        up.style.removeProperty('display');
        up.style.removeProperty('-webkit-box-orient');
        up.style.removeProperty('text-overflow');
        up.style.removeProperty('white-space');
        if (up.style.length === 0) {
          up.removeAttribute('style');
        }
      }
    });

    isTranslated = false;
    currentlyTranslating = false;
    translationQueue = [];
    translatedUnits.clear();
    if (currentScrollHandler) {
      window.removeEventListener('scroll', currentScrollHandler);
      window.removeEventListener('resize', currentScrollHandler);
      currentScrollHandler = null;
    }
    console.log("[全页翻译脚本] 所有翻译结果已移除，状态已重置。");
  }

  function togglePageTranslation(incomingParams = {}) {
    if (isTranslated) {
      removeTranslations();
      if (typeof qutebrowser !== 'undefined') {
        qutebrowser.message.info('全页翻译已禁用。');
      }
      console.log("全页翻译：状态切换至禁用。");
    } else {
      translatePage(incomingParams);
    }
  }

  // ====================================
  // 5. 隐藏DOM触发器
  // ====================================
  let qutebrowserTrigger = document.createElement('div');
  qutebrowserTrigger.id = '__qutebrowser_translation_trigger';
  qutebrowserTrigger.style.cssText = 'position: fixed; top: -9999px; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
  document.documentElement.appendChild(qutebrowserTrigger);

  qutebrowserTrigger.addEventListener('click', function() {
    let incomingParams = {};
    if (qutebrowserTrigger.dataset.params) {
      try {
        incomingParams = JSON.parse(qutebrowserTrigger.dataset.params);
      } catch (e) {
        console.error("全页翻译：解析外部参数失败，请检查JSON格式:", e, "传入原始参数:", qutebrowserTrigger.dataset.params);
      }
    }

    togglePageTranslation(incomingParams);
    delete qutebrowserTrigger.dataset.params;
  });

})();
