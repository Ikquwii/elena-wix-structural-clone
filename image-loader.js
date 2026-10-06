(function (root) {
  function loadPortfolioImage(image, source, onFailure) {
    let retries = 0;
    let retryTimer;
    const cleanup = () => {
      clearTimeout(retryTimer);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
    };
    const loaded = () => { image.hidden = false; cleanup(); };
    const failed = () => {
      if (retries === 2) {
        cleanup();
        onFailure();
        return;
      }
      retries += 1;
      retryTimer = setTimeout(() => {
        const retryUrl = new URL(source, image.ownerDocument.baseURI);
        retryUrl.searchParams.set('retry', `${Date.now()}-${retries}`);
        image.loading = 'eager';
        image.src = retryUrl.href;
      }, retries === 1 ? 400 : 1200);
    };
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    image.src = source;
    return cleanup;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = loadPortfolioImage;
  else root.loadPortfolioImage = loadPortfolioImage;
})(typeof window !== 'undefined' ? window : null);
