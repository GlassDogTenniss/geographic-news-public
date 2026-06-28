(() => {
  const oldLabel = '中国-崑崙山-未解決仮置き';
  const newLabel = '場所不明';

  function tintAsUnknown(item) {
    item.dataset.country = newLabel;
    item.style.setProperty('--country-bg', 'hsl(0 0% 97%)');
    item.style.setProperty('--country-border', 'hsl(0 0% 78%)');
    item.style.setProperty('--country-header-bg', 'hsl(0 0% 95%)');
  }

  function patchNode(root = document) {
    root.querySelectorAll?.('.topic-item').forEach(item => {
      if (!item.textContent.includes(oldLabel)) return;
      tintAsUnknown(item);
      item.querySelectorAll('.topic-meta').forEach(meta => {
        meta.textContent = meta.textContent.replace(oldLabel, newLabel);
      });
    });
    root.querySelectorAll?.('.stat-label').forEach(label => {
      if (label.textContent.trim() === '崑崙山') label.textContent = newLabel;
    });
    root.querySelectorAll?.('.country-indicator').forEach(label => {
      if (label.textContent.trim() === '表示中の国: 中国') label.textContent = `表示中の国: ${newLabel}`;
    });
  }

  if (window.L?.Marker?.prototype?.bindPopup) {
    const originalBindPopup = window.L.Marker.prototype.bindPopup;
    window.L.Marker.prototype.bindPopup = function patchedBindPopup(content, options) {
      if (typeof content === 'string') content = content.replaceAll(oldLabel, newLabel);
      return originalBindPopup.call(this, content, options);
    };
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) patchNode(node);
      });
    }
    patchNode(document);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    patchNode(document);
  }
})();
