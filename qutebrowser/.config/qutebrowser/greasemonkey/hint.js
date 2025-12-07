// ==UserScript==
// @name         Mark Clickable Elements
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Marks elements that have registered a 'click' event listener by adding a custom CSS class for easier identification (e.g., by qutebrowser).
// @author       xavia
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes     true
// ==/UserScript==

(function() {
    'use strict';

    const originalAddEventListener = Element.prototype.addEventListener;

    /**
     * Override Element.prototype.addEventListener to intercept event registration.
     * @param {string} type - The event type (e.g., 'click', 'mouseover')
     * @param {Function} listener - the function to be called when the event occurs.
     * @param {boolean|Object} options - Event listener options.
     */
    Element.prototype.addEventListener = function(type, listener, options) {
        if (type === 'click') {
            this.classList.add('qutebrowser_custom_click');
        }

        return originalAddEventListener.apply(this, arguments);
    };
})();
