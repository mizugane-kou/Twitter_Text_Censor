let mode = "off"; // 'off', 'censor', 'media'
const modes = ["off", "censor", "media"];

function isTimeline() {
  return location.pathname === "/home";
}

function applyCensorship(container) {
  const tweetNodes = container.querySelectorAll('article');

  tweetNodes.forEach(tweet => {
    const textNode = tweet.querySelector('div[data-testid="tweetText"]');
    const mediaNode = tweet.querySelector('div[data-testid="tweetPhoto"]');

    if (!textNode) return;

    if (textNode.dataset.processed === "true") return;

    const originalHTML = textNode.innerHTML;
    textNode.dataset.originalText = originalHTML;
    textNode.dataset.processed = "true";

    if (mode === "censor") {
      textNode.innerHTML = "■■■■■■■■■■（クリックで表示）";
      textNode.classList.add("censored-text");
      textNode.addEventListener("click", (e) => {
        e.stopPropagation();
        textNode.innerHTML = textNode.dataset.originalText;
        textNode.classList.remove("censored-text");
      });
      tweet.style.display = "";
    } else if (mode === "media") {
      if (!mediaNode) {
        tweet.style.display = "none";
      } else {
        textNode.style.display = "none";
        tweet.style.display = "";
      }
    } else {
      // off
      textNode.innerHTML = textNode.dataset.originalText;
      textNode.style.display = "";
      textNode.classList.remove("censored-text");
      tweet.style.display = "";
    }
  });
}

function observeTimeline() {
  if (!isTimeline()) return;

  applyCensorship(document.body);

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          applyCensorship(node);
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
  const button = document.createElement("button");
  button.id = "toggle-mode-button";
  button.textContent = "表示: OFF";
  document.body.appendChild(button);

  button.addEventListener("click", () => {
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    mode = nextMode;
    button.textContent = `表示: ${mode === "off" ? "OFF" : mode === "censor" ? "伏せ字" : "メディアのみ"}`;
    resetCensorship();
  });
}

function monitorURLChange(callback) {
  let lastPath = location.pathname;

  const check = () => {
    const newPath = location.pathname;
    if (newPath !== lastPath) {
      lastPath = newPath;
      callback();
    }
  };

  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(history, args);
    setTimeout(check, 100);
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(history, args);
    setTimeout(check, 100);
  };
  window.addEventListener("popstate", check);
}

function resetCensorship() {
  document.querySelectorAll('[data-processed="true"]').forEach(node => {
    node.dataset.processed = "";
    node.innerHTML = node.dataset.originalText || node.innerHTML;
    node.style.display = "";
    node.classList.remove("censored-text");
  });

  applyCensorship(document.body);
}

window.addEventListener("load", () => {
  createToggleButton();
  observeTimeline();
  monitorURLChange(() => {
    if (isTimeline()) {
      applyCensorship(document.body);
    }
  });
});
