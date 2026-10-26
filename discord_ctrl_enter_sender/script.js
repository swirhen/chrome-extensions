(() => {
  'use strict';

  const isDiscord = location.hostname === 'discord.com';
  const useCapture = true;
  // Ctrl+Enter から作り直した Enter に付ける目印（自分で再処理しないため）
  const resent = new WeakSet();

  const isMsgTextbox = (el) => {
    if (!(el instanceof HTMLElement)) {
      return false;
    }
    if (isDiscord) {
      // Stack Next SE (Chromium 122) では el.ariaMultiline が undefined になるため属性を直接見る
      return el.getAttribute('role') === 'textbox' && el.getAttribute('aria-multiline') === 'true';
    }
    return el.tagName === 'TEXTAREA' || el.isContentEditable;
  };

  const onKey = (event) => {
    if (event.key !== 'Enter' || resent.has(event) || !isMsgTextbox(event.target)) {
      return;
    }
    if (event.shiftKey || event.altKey || event.metaKey) {
      return;
    }

    // Enter: サイト側の送信処理に届けず、ブラウザ標準の改行だけ行わせる
    if (!event.ctrlKey) {
      event.stopPropagation();
      return;
    }

    // Discord は Ctrl+Enter でそのまま送信される
    if (isDiscord || event.type !== 'keydown' || event.isComposing) {
      return;
    }

    // それ以外のサイトは Ctrl+Enter を素の Enter に差し替えて送信させる
    event.preventDefault();
    event.stopPropagation();
    const init = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
    };
    for (const type of ['keydown', 'keypress', 'keyup']) {
      const ev = new KeyboardEvent(type, init);
      resent.add(ev);
      event.target.dispatchEvent(ev);
    }
  };

  window.addEventListener('keydown', onKey, useCapture);
  window.addEventListener('keypress', onKey, useCapture);

})();
