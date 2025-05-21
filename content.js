let mode = "off";
const modes = ["off", "censor", "media"];
let toggleButton = null;

function isTimeline() {
  return location.pathname === "/home";
}


function applyCensorship(container) {
    if (!isTimeline()) return;
  
    const tweetNodes = container.querySelectorAll('article');
  
    tweetNodes.forEach(tweet => {
      const textNodes = tweet.querySelectorAll('div[data-testid="tweetText"]');
  
      textNodes.forEach(textNode => {
        if (!textNode || textNode.dataset.processed === "true") return;
  
        const originalHTML = textNode.innerHTML;
        textNode.dataset.originalText = originalHTML;
        textNode.dataset.processed = "true";
  
        if (mode === "censor") {
          textNode.innerHTML = "■■■■■■■■■■.........";
          textNode.classList.add("censored-text");
          textNode.addEventListener("click", (e) => {
            e.stopPropagation();
            textNode.innerHTML = textNode.dataset.originalText;
            textNode.classList.remove("censored-text");
          });
          tweet.style.display = "";
        } else if (mode === "media") {
          const mediaNode = tweet.querySelector('div[data-testid="tweetPhoto"]');
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
    });
  }
  




function observeMutations() {
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
  if (toggleButton) return;

  toggleButton = document.createElement("button");
  toggleButton.id = "toggle-mode-button";
  document.body.appendChild(toggleButton);

  toggleButton.addEventListener("click", () => {
    const currentIndex = modes.indexOf(mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setMode(nextMode);
  });
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
  resetCensorship();
}

function loadModeFromStorage() {
  chrome.storage.local.get("displayMode", (result) => {
    const savedMode = result.displayMode;
    if (modes.includes(savedMode)) {
      mode = savedMode;
    } else {
      mode = "off";
    }
    updateButtonLabel();
    resetCensorship();
  });
}

function removeToggleButton() {
  if (toggleButton) {
    toggleButton.remove();
    toggleButton = null;
  }
}

function resetCensorship() {
  document.querySelectorAll('[data-processed="true"]').forEach(node => {
    node.dataset.processed = "";
    node.innerHTML = node.dataset.originalText || node.innerHTML;
    node.style.display = "";
    node.classList.remove("censored-text");
  });

  if (isTimeline()) applyCensorship(document.body);
}

function handlePageChange() {
  if (isTimeline()) {
    createToggleButton();
    loadModeFromStorage();
  } else {
    removeToggleButton();
    resetCensorship();
  }
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

window.addEventListener("load", () => {
  handlePageChange();
  observeMutations();
  monitorURLChange(() => {
    handlePageChange();
  });
});
