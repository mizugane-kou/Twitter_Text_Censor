let mode = "off";
const modes = ["off", "censor", "media"];
let toggleButton = null;

function isTimeline() {
  return location.pathname === "/home";
}

function applyCensorship(container) {
  // タイムライン外では何もしない (ただし、クリアは呼び出し元で行う)
  if (!isTimeline()) return;

  const tweetNodes = container.querySelectorAll('article');

  tweetNodes.forEach(tweet => {
    const textNodes = tweet.querySelectorAll('div[data-testid="tweetText"]');

    textNodes.forEach(textNode => {
      if (!textNode) return;

      let originalHTML = textNode.dataset.originalText;
      if (originalHTML === undefined) {
        originalHTML = textNode.innerHTML;
        textNode.dataset.originalText = originalHTML;
      }
      textNode.dataset.processed = "true";
      textNode.dataset.currentMode = mode;

      const oldListener = textNode.revealClickListener;
      if (oldListener) {
        textNode.removeEventListener("click", oldListener);
        delete textNode.revealClickListener;
      }

      if (mode === "censor") {
        textNode.innerHTML = "■■■■■■■■■■.........";
        textNode.classList.add("censored-text");

        const revealOnClick = function(e) {
          e.stopPropagation();
          if (textNode.dataset.originalText) {
            textNode.innerHTML = textNode.dataset.originalText;
          }
          textNode.classList.remove("censored-text");
          textNode.removeEventListener("click", revealOnClick);
          delete textNode.revealClickListener;
        };
        textNode.addEventListener("click", revealOnClick);
        textNode.revealClickListener = revealOnClick;

        tweet.style.display = "";
        textNode.style.display = "";
      } else if (mode === "media") {
        const mediaNode = tweet.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]');
        if (!mediaNode) {
          tweet.style.display = "none";
        } else {
          textNode.innerHTML = originalHTML; // 元のテキストに戻す
          textNode.classList.remove("censored-text");
          textNode.style.display = "none"; // テキストノードを非表示
          tweet.style.display = "";
        }
      } else { // mode === "off"
        textNode.innerHTML = originalHTML;
        textNode.style.display = "";
        textNode.classList.remove("censored-text");
        tweet.style.display = "";
      }
    });
  });
}

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          applyCensorship(node.querySelector('article') ? node : document.body);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function createToggleButton() {
  if (toggleButton) return; // 既に存在する場合は何もしない

  console.log("CreateToggleButton: Creating button.");
  toggleButton = document.createElement("button");
  toggleButton.id = "toggle-mode-button";
  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", () => {
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  });
  // ラベル更新は loadModeFromStorage または setMode で行われる
}

function updateButtonLabel() {
  if (toggleButton) {
    toggleButton.textContent = `表示: ${mode === "off" ? "OFF" : mode === "censor" ? "伏せ字" : "メディアのみ"}`;
  }
}

function clearAllCensorshipEffects() {
  console.log("ClearAllCensorshipEffects called");
  document.querySelectorAll('div[data-testid="tweetText"][data-processed="true"]').forEach(textNode => {
    if (textNode.dataset.originalText) {
      textNode.innerHTML = textNode.dataset.originalText;
    }
    textNode.classList.remove("censored-text");
    textNode.style.display = "";

    const listener = textNode.revealClickListener;
    if (listener) {
        textNode.removeEventListener("click", listener);
        delete textNode.revealClickListener;
    }

    delete textNode.dataset.processed;
    // originalTextは再適用時に必要なので、ここでは削除しない方が良い場合もあるが、
    // applyCensorshipで再取得するのでクリアしても問題ない。
    delete textNode.dataset.originalText;
    delete textNode.dataset.currentMode;
  });

  document.querySelectorAll('article').forEach(tweet => {
    tweet.style.display = ""; // 非表示にされたツイートも表示に戻す
  });
}

function setMode(newMode) {
  console.log(`SetMode: Changing from ${mode} to ${newMode}`);
  mode = newMode;
  chrome.storage.local.set({ displayMode: mode });
  updateButtonLabel();
  clearAllCensorshipEffects(); // まず既存の検閲効果をすべてクリア
  if (isTimeline()) {
    applyCensorship(document.body); // タイムラインなら新しいモードで再適用
  }
}

function loadModeFromStorage() {
  chrome.storage.local.get("displayMode", (result) => {
    const savedMode = result.displayMode;
    if (modes.includes(savedMode)) {
      mode = savedMode;
    } else {
      mode = "off"; // デフォルト
    }
    console.log("LoadModeFromStorage: Mode loaded as", mode);
    updateButtonLabel(); // ボタンのラベルを更新
    clearAllCensorshipEffects(); // まず既存の検閲効果をすべてクリア
    if (isTimeline()) {
      applyCensorship(document.body); // タイムラインなら保存されたモードで適用
    }
  });
}

// トグルボタンを削除する関数は不要になったため削除
// function removeToggleButton() { ... }

function handlePageChange() {
  const currentPath = location.pathname;
  const onTimeline = isTimeline();
  console.log(
    `HandlePageChange: path="${currentPath}", onTimeline=${onTimeline}`
  );

  // ボタンは常に表示されるため、表示/非表示のロジックは不要

  clearAllCensorshipEffects(); // ページ遷移時にはまず既存の検閲効果をクリア
  if (onTimeline) {
    // タイムラインにいる場合、現在のモードに基づいて検閲を適用
    // モード自体はloadModeFromStorage (初期ロード時) または setMode (ボタンクリック時) で設定されている
    applyCensorship(document.body);
  }
  // ボタンのラベルはモード変更時に更新されるため、ここでは更新不要
}

function monitorURLChange(callback) {
  let lastKnownPath = location.pathname;
  let debounceTimer = null;

  const checkURL = () => {
    requestAnimationFrame(() => {
      const currentPath = location.pathname;
      if (currentPath !== lastKnownPath) {
        console.log(`URLChangeMonitor: Detected URL change from "${lastKnownPath}" to "${currentPath}".`);
        lastKnownPath = currentPath;
        callback();
      }
    });
  };

  const scheduleCheck = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(checkURL, 250);
  };

  const origPushState = history.pushState;
  history.pushState = function(...args) {
    const result = origPushState.apply(this, args);
    console.log("URLChangeMonitor: history.pushState");
    scheduleCheck();
    return result;
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function(...args) {
    const result = origReplaceState.apply(this, args);
    console.log("URLChangeMonitor: history.replaceState");
    scheduleCheck();
    return result;
  };

  window.addEventListener("popstate", () => {
    console.log("URLChangeMonitor: popstate event");
    scheduleCheck();
  });
}

window.addEventListener("load", () => {
  console.log("Window loaded. Initializing. Path:", location.pathname);
  createToggleButton();     // ボタンを最初に1回作成 (常に表示)
  loadModeFromStorage();    // 初期モードをストレージから読み込み、適用
  observeMutations();       // DOM変更の監視を開始
  monitorURLChange(handlePageChange); // URL変更の監視を開始
});
