function isTimeline() {
    return location.pathname === "/home";
  }
  
  function censorTweetText(container) {
    if (!isTimeline()) return;
  
    const tweetTexts = container.querySelectorAll('div[data-testid="tweetText"]');
    tweetTexts.forEach(textNode => {
      if (textNode.dataset.censored === "true") return;
  
      const originalHTML = textNode.innerHTML;
      textNode.dataset.originalText = originalHTML;
      textNode.dataset.censored = "true";
      textNode.innerHTML = "■■■■■■■......";
      textNode.classList.add("censored-text");
  
      textNode.addEventListener("click", (e) => {
        e.stopPropagation();
        textNode.innerHTML = textNode.dataset.originalText;
        textNode.classList.remove("censored-text");
      });
    });
  }
  
  function observeTimeline() {
    // 初期処理
    if (isTimeline()) censorTweetText(document.body);
  
    // MutationObserverをセット
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            censorTweetText(node);
          }
        }
      }
    });
  
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // URL変更を監視（TwitterはSPAなのでページ遷移でURLだけ変わる）
  function monitorURLChange(callback) {
    let lastPath = location.pathname;
  
    const check = () => {
      const newPath = location.pathname;
      if (newPath !== lastPath) {
        lastPath = newPath;
        callback();
      }
    };
  
    // pushState / replaceState をフック
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(check, 100);
    };
  
    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(check, 100);
    };
  
    window.addEventListener("popstate", check);
  }
  
  // 初期化
  window.addEventListener("load", () => {
    observeTimeline();
    monitorURLChange(() => {
      if (isTimeline()) {
        censorTweetText(document.body);
      }
    });
  });
  