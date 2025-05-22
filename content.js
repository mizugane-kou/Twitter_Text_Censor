let mode = "off";
const modes = ["off", "censor", "media"];
let toggleButton = null;

function isTimeline() {
  return location.pathname === "/home";
}


function applyCensorship(container) {
    if (!isTimeline()) return; // 伏せ字処理はタイムラインでのみ行う

    const tweetNodes = container.querySelectorAll('article');

    tweetNodes.forEach(tweet => {
      const textNodes = tweet.querySelectorAll('div[data-testid="tweetText"]');

      textNodes.forEach(textNode => {
        if (!textNode || textNode.dataset.processed === "true" && textNode.dataset.currentMode === mode) return; // 既に処理済みでモード変更がない場合はスキップ

        // モード変更時や未処理の場合、元のテキストを保持
        if (textNode.dataset.originalText === undefined || textNode.dataset.currentMode !== mode) {
            if (textNode.dataset.originalText === undefined) { // 初回処理時
                textNode.dataset.originalText = textNode.innerHTML;
            }
        }
        textNode.dataset.processed = "true";
        textNode.dataset.currentMode = mode;

        // まず元の状態に戻す
        textNode.innerHTML = textNode.dataset.originalText;
        textNode.style.display = "";
        tweet.style.display = "";
        textNode.classList.remove("censored-text");
        // 古いイベントリスナーを削除（単純化のため、ここでは毎回再設定する前提）
        // より効率的なのは、リスナーを一度だけ設定し、ハンドラ内でモードをチェックすること
        const newTextNode = textNode.cloneNode(true); // イベントリスナーを確実に消すためにクローン
        textNode.parentNode.replaceChild(newTextNode, textNode);
        textNode = newTextNode; // textNode参照を更新
        textNode.dataset.originalText = textNode.dataset.originalText || originalHTML; // originalTextがクローンで消える場合があるので再設定
        textNode.dataset.processed = "true";
        textNode.dataset.currentMode = mode;


        if (mode === "censor") {
          textNode.innerHTML = "■■■■■■■■■■.........";
          textNode.classList.add("censored-text");
          textNode.addEventListener("click", (e) => {
            e.stopPropagation();
            textNode.innerHTML = textNode.dataset.originalText;
            textNode.classList.remove("censored-text");
            // 一度表示したら processed フラグを更新して再伏せ字化を防ぐか、
            // もしくは再度クリックで伏せ字に戻すなどの挙動が必要なら追加
          }, { once: true }); // クリックは一度きり
          tweet.style.display = "";
        } else if (mode === "media") {
          const mediaNode = tweet.querySelector('div[data-testid="tweetPhoto"], div[data-testid="videoPlayer"]'); // videoPlayerも考慮
          if (!mediaNode) {
            tweet.style.display = "none";
          } else {
            textNode.style.display = "none";
            tweet.style.display = "";
          }
        } else {
          // off
          // 上の「まず元の状態に戻す」処理で対応済み
        }
      });
    });
  }

function observeMutations() {
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 追加されたノード自体が記事であるか、記事を含む可能性があるかチェック
          if (node.matches && node.matches('article')) {
            applyCensorship(node.parentElement || document.body); // 親要素を渡すか、article単体ならそれで
          } else if (node.querySelector && node.querySelector('article')) {
            applyCensorship(node);
          }
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
  if (document.getElementById("toggle-mode-button")) { // 既にボタンが存在する場合は何もしない
      toggleButton = document.getElementById("toggle-mode-button"); // 参照を更新
      return;
  }

  toggleButton = document.createElement("button");
  toggleButton.id = "toggle-mode-button";
  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", () => {
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  });
  updateButtonLabel(); // ボタン作成時にラベルも更新
}

function updateButtonLabel() {
  if (toggleButton) {
    toggleButton.textContent = `表示: ${mode === "off" ? "OFF" : mode === "censor" ? "伏せ字" : "メディアのみ"}`;
  }
}

function setMode(newMode) {
  mode = newMode;
  chrome.storage.local.set({ displayMode: mode });
  updateButtonLabel();
  resetCensorship(); // モード変更時に現在の表示を更新
}

function loadModeFromStorage() {
  chrome.storage.local.get("displayMode", (result) => {
    const savedMode = result.displayMode;
    if (modes.includes(savedMode)) {
      mode = savedMode;
    } else {
      mode = "off"; // デフォルト値
    }
    updateButtonLabel();
    resetCensorship(); // 保存されたモードを読み込んだ後に表示を更新
  });
}

function resetCensorship() {
  // まず、全ての処理済みマークとスタイルをリセット
  document.querySelectorAll('div[data-testid="tweetText"][data-processed="true"]').forEach(textNode => {
    if (textNode.dataset.originalText) {
      textNode.innerHTML = textNode.dataset.originalText;
    }
    textNode.style.display = "";
    textNode.classList.remove("censored-text");
    // dataset.processed は applyCensorship 内で再設定されるのでここでは消さなくても良い
    // textNode.removeAttribute('data-processed');
    // textNode.removeAttribute('data-current-mode');

    const tweet = textNode.closest('article');
    if (tweet) {
        tweet.style.display = "";
    }
  });

  // 現在のページがタイムラインであれば、新しいモードを適用
  if (isTimeline()) {
    applyCensorship(document.body);
  }
}

// ページ変更に関わらずボタンを表示し、モードをロード/適用する
function handlePageChange() {
  createToggleButton(); // 常にボタンを作成 (既に存在すれば何もしない)
  loadModeFromStorage(); // モードを読み込み、必要なら表示を更新
}

function monitorURLChange(callback) {
  let lastPath = location.pathname + location.search; // searchも考慮するとより確実

  const check = () => {
    const newPath = location.pathname + location.search;
    if (newPath !== lastPath) {
      lastPath = newPath;
      callback();
    }
  };

  // history APIの変更を監視
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(history, args);
    setTimeout(check, 0); // checkを非同期で少し遅らせる
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(history, args);
    setTimeout(check, 0);
  };
  // ブラウザの戻る/進むボタンを監視
  window.addEventListener("popstate", check);
}

// 初期化処理
window.addEventListener("load", () => {
  handlePageChange(); // 初回ロード時にボタン表示とモード適用
  observeMutations(); // DOMの動的な変更を監視開始
  monitorURLChange(() => { // URLの変更を監視開始
    handlePageChange();
  });
});
