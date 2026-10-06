(() => {
  'use strict';
  history.scrollRestoration = 'manual';
  const data = window.PORTFOLIO_DATA;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 700px)');
  const labels = { fashion: 'Fashion Weeks', commercial: 'Commercial Projects & Collections', editorials: 'Editorials & Publications' };
  const status = document.querySelector('#copy-status');
  let statusTimer;
  function announce(message) {
    clearTimeout(statusTimer);
    status.textContent = message;
    statusTimer = setTimeout(() => { status.textContent = ''; }, 4500);
  }

  function makePhoto(photo, index, group, label, project = false) {
    const frame = document.createElement(project ? 'a' : 'button');
    frame.className = 'photo-frame';
    frame.dataset.photoId = photo.id;
    if (project) {
      frame.href = photo.href;
      frame.target = '_blank';
      frame.rel = 'noopener noreferrer';
      frame.setAttribute('aria-label', `${photo.title} — view project (opens in a new tab)`);
    } else {
      frame.type = 'button';
      frame.setAttribute('aria-label', `View ${label}, photograph ${index + 1}`);
      frame.setAttribute('aria-haspopup', 'dialog');
      frame.addEventListener('click', () => openViewer(group, index, frame, label));
    }
    if (photo.available === false) {
      frame.classList.add('unavailable-photo');
      frame.setAttribute('aria-label', 'Photograph unavailable in the source portfolio');
      frame.textContent = 'Image currently unavailable';
      if (!project) frame.disabled = true;
      return frame;
    }
    const image = document.createElement('img');
    image.alt = project ? photo.title : photo.title || `${label} — photograph ${index + 1}`;
    image.width = photo.downloadedWidth || photo.width;
    image.height = photo.downloadedHeight || photo.height;
    image.loading = 'lazy';
    image.decoding = 'async';
    if (photo.focalPoint) image.style.objectPosition = `${photo.focalPoint[0]*100}% ${photo.focalPoint[1]*100}%`;
    window.loadPortfolioImage(image, photo.src, () => {
      frame.classList.add('unavailable-photo');
      image.hidden = true;
      const message = document.createElement('span');
      message.textContent = 'Image could not be loaded';
      frame.append(message);
    });
    frame.append(image);
    if (project) {
      const caption = document.createElement('span');
      caption.className = 'project-caption';
      caption.textContent = photo.title;
      frame.append(caption);
    }
    return frame;
  }

  function addControls(shell, viewport, label, step, initialOffset = 0) {
    const controls = document.createElement('div');
    controls.className = 'row-controls';
    const previous = document.createElement('button');
    const next = document.createElement('button');
    previous.type = next.type = 'button';
    previous.className = 'row-arrow row-previous';
    next.className = 'row-arrow row-next';
    previous.textContent = '‹';
    next.textContent = '›';
    previous.setAttribute('aria-label', `Previous photographs — ${label}`);
    next.setAttribute('aria-label', `Next photographs — ${label}`);
    controls.append(previous, next);
    shell.append(controls);
    viewport.tabIndex = 0;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', `${label}. Scroll horizontally to view all photographs.`);
    const minimum = () => mobile.matches ? 0 : typeof initialOffset === 'function' ? initialOffset() : initialOffset;
    const maximum = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const sync = () => {
      previous.disabled = viewport.scrollLeft <= minimum() + 1;
      next.disabled = viewport.scrollLeft >= maximum() - 1;
      controls.hidden = maximum() < 2;
    };
    const move = direction => viewport.scrollTo({ left: Math.max(minimum(), Math.min(maximum(), viewport.scrollLeft + direction * step())), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    viewport.addEventListener('scroll', sync, { passive: true });
    viewport.addEventListener('keydown', event => {
      if (event.target !== viewport) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        viewport.scrollTo({ left: event.key === 'Home' ? minimum() : maximum(), behavior: 'instant' });
      }
    });
    // Trackpad scrolling is native. Shift+wheel also works with a mouse.
    viewport.addEventListener('wheel', event => {
      if (!event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1;
      const delta = event.deltaY * unit;
      if (delta > 0 ? viewport.scrollLeft < maximum() - 1 : viewport.scrollLeft > 1) {
        event.preventDefault();
        viewport.scrollLeft += delta;
      }
    }, { passive: false });
    let previousMinimum = minimum();
    viewport.scrollLeft = previousMinimum;
    new ResizeObserver(() => {
      const nextMinimum = minimum();
      // Keep the same gallery position when its edge moves across the window.
      viewport.scrollLeft += nextMinimum - previousMinimum;
      previousMinimum = nextMinimum;
      sync();
    }).observe(viewport);
    sync();
  }

  data.rows.forEach((row, rowIndex) => {
    const section = document.querySelector(`#${row.section}-gallery`);
    const shell = document.createElement('div');
    shell.className = `photo-row${row.gray ? ' gray-row' : ''}`;
    shell.dataset.gallery = row.id;
    shell.dataset.photoCount = row.items.length;
    shell.style.setProperty('--row-height', `${row.height}px`);
    shell.style.setProperty('--row-gap', `${row.gap}px`);
    shell.style.setProperty('--row-before', `${row.before}px`);
    shell.style.setProperty('--row-inset', `${Math.max(0, row.start)}px`);
    if (row.viewportWidth) {
      shell.style.setProperty('--row-left', `max(0px, calc((100% - 1280px) / 2 + ${row.start}px))`);
      shell.style.setProperty('--row-right', `max(0px, calc((100% - 1280px) / 2 + ${1280 - row.start - row.viewportWidth}px))`);
    }
    const viewport = document.createElement('div');
    viewport.className = 'row-viewport';
    const strip = document.createElement('div');
    strip.className = 'row-strip';
    row.items.forEach((photo, index) => {
      const frame = makePhoto(photo, index, row.items, labels[row.section]);
      frame.style.setProperty('--frame-width', `${photo.frameWidth}px`);
      frame.style.setProperty('--frame-ratio', photo.frameWidth / photo.frameHeight);
      strip.append(frame);
    });
    viewport.append(strip);
    shell.append(viewport);
    section.append(shell);
    addControls(shell, viewport, `${labels[row.section]}, row ${rowIndex + 1}`, () =>
      strip.firstElementChild.getBoundingClientRect().width + parseFloat(getComputedStyle(strip).gap),
      () => row.viewportWidth ? Math.max(0, -((shell.clientWidth - 1280) / 2 + row.start)) : 0);
  });

  data.layouts.forEach(layout => {
    const shell = document.createElement('div');
    shell.className = `measured-layout ${layout.kind}`;
    shell.dataset.gallery = layout.id;
    shell.dataset.photoCount = layout.items.length;
    shell.style.setProperty('--layout-before', `${layout.before}px`);
    const viewport = document.createElement('div');
    viewport.className = 'layout-viewport';
    const board = document.createElement('div');
    board.className = 'layout-board';
    board.style.setProperty('--board-width', layout.width);
    board.style.setProperty('--board-height', layout.height);
    layout.items.forEach((photo, index) => {
      const frame = makePhoto(photo, index, layout.items, labels.editorials);
      const [x, y, width, height] = photo.frame;
      Object.assign(frame.style, { left: `${x/layout.width*100}%`, top: `${y/layout.height*100}%`, width: `${width/layout.width*100}%`, height: `${height/layout.height*100}%` });
      board.append(frame);
    });
    viewport.append(board);
    shell.append(viewport);
    document.querySelector('#editorials-gallery').append(shell);
    if (layout.kind === 'mixed') addControls(shell, viewport, 'Editorials & Publications, final row', () => viewport.clientWidth * .75);
  });

  const latestBoard = document.createElement('div');
  latestBoard.className = 'latest-board';
  data.latest.forEach((photo, index) => {
    const card = makePhoto(photo, index, data.latest, 'Latest Projects', true);
    const [x, y, width, height] = photo.frame;
    card.style.setProperty('--card-x', `${x/1200*100}%`);
    card.style.setProperty('--card-y', `${y/1884*100}%`);
    card.style.setProperty('--card-w', `${width/1200*100}%`);
    card.style.setProperty('--card-h', `${height/1884*100}%`);
    card.style.setProperty('--card-ratio', width/height);
    latestBoard.append(card);
  });
  const latestSlider = document.createElement('div');
  latestSlider.className = 'latest-slider';
  latestSlider.append(latestBoard);
  document.querySelector('#latest-gallery').append(latestSlider);
  const latestStep = () => latestBoard.firstElementChild.getBoundingClientRect().width + 16;
  addControls(latestSlider, latestBoard, 'Latest Projects', latestStep);
  let latestFrame = 0;
  function sizeLatestSlide() {
    if (!mobile.matches) {
      latestBoard.style.removeProperty('height');
      return;
    }
    const index = Math.min(data.latest.length - 1, Math.round(latestBoard.scrollLeft / latestStep()));
    const card = latestBoard.children[index];
    const ratio = data.latest[index].frame[2] / data.latest[index].frame[3];
    latestBoard.style.height = `${card.getBoundingClientRect().width / ratio}px`;
  }
  latestBoard.addEventListener('scroll', () => {
    cancelAnimationFrame(latestFrame);
    latestFrame = requestAnimationFrame(sizeLatestSlide);
  }, { passive: true });
  window.addEventListener('resize', sizeLatestSlide, { passive: true });
  sizeLatestSlide();

  const viewer = document.createElement('dialog');
  viewer.className = 'photo-viewer';
  viewer.setAttribute('aria-label', 'Photograph viewer');
  viewer.innerHTML = '<button class="viewer-close" type="button" aria-label="Close photograph viewer">×</button><button class="viewer-previous" type="button" aria-label="Previous photograph">‹</button><figure><img alt=""><figcaption></figcaption></figure><button class="viewer-next" type="button" aria-label="Next photograph">›</button>';
  document.body.append(viewer);
  let viewerPhotos = [], viewerIndex = 0, viewerTrigger, viewerLabel;
  let cancelViewerImage;
  const viewerImage = viewer.querySelector('img');
  const viewerCaption = viewer.querySelector('figcaption');
  const viewerPrevious = viewer.querySelector('.viewer-previous');
  const viewerNext = viewer.querySelector('.viewer-next');
  function showViewerPhoto() {
    const photo = viewerPhotos[viewerIndex];
    cancelViewerImage?.();
    viewerImage.hidden = false;
    cancelViewerImage = window.loadPortfolioImage(viewerImage, photo.src, () => {
      viewerImage.hidden = true;
      viewerCaption.textContent = `${viewerLabel} · Image could not be loaded`;
    });
    viewerImage.alt = photo.title || `${viewerLabel} — photograph ${viewerIndex + 1}`;
    viewerCaption.textContent = `${viewerLabel} · ${viewerIndex + 1} / ${viewerPhotos.length}`;
    viewerPrevious.disabled = viewerIndex === 0;
    viewerNext.disabled = viewerIndex === viewerPhotos.length - 1;
  }
  function openViewer(photos, index, trigger, label) {
    viewerPhotos = photos.filter(photo => photo.available !== false);
    viewerIndex = viewerPhotos.findIndex(photo => photo.id === photos[index].id);
    if (viewerIndex < 0) return;
    viewerTrigger = trigger;
    viewerLabel = label;
    showViewerPhoto();
    viewer.showModal();
    document.body.classList.add('viewer-open');
    viewer.querySelector('.viewer-close').focus();
  }
  function navigateViewer(direction) {
    viewerIndex = Math.max(0, Math.min(viewerPhotos.length-1, viewerIndex+direction));
    showViewerPhoto();
  }
  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewerPrevious.addEventListener('click', () => navigateViewer(-1));
  viewerNext.addEventListener('click', () => navigateViewer(1));
  viewer.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      navigateViewer(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  viewer.addEventListener('click', event => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => {
    cancelViewerImage?.();
    document.body.classList.remove('viewer-open');
    viewerTrigger?.focus({ preventScroll: true });
  });

  document.querySelectorAll('[data-copy-section]').forEach(button => {
    button.innerHTML = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>';
    button.addEventListener('click', async () => {
    const url = new URL(window.location.href);
    url.hash = button.dataset.copySection;
    try {
      await navigator.clipboard.writeText(url.href);
      announce('Section link copied');
    } catch {
      // A selected field keeps sharing usable when clipboard access is denied.
      const field = document.createElement('input');
      field.type = 'text';
      field.value = url.href;
      field.className = 'manual-copy-link';
      field.setAttribute('aria-label', 'Section link — select and copy');
      button.parentElement.append(field);
      field.focus();
      field.select();
      field.addEventListener('blur', () => field.remove(), { once: true });
      announce('Copy this selected link');
    }
    });
  });

  document.querySelectorAll('.publication-marquee').forEach(band => {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'marquee-toggle';
    toggle.textContent = 'Ⅱ';
    toggle.setAttribute('aria-label', 'Pause publication strip');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => {
      const paused = band.classList.toggle('is-paused');
      toggle.textContent = paused ? '▷' : 'Ⅱ';
      toggle.setAttribute('aria-label', paused ? 'Play publication strip' : 'Pause publication strip');
      toggle.setAttribute('aria-pressed', String(paused));
    });
    band.append(toggle);
  });

  async function restoreAnchor() {
    await document.fonts.ready;
    if (window.location.hash) {
      // All public section IDs are plain ASCII; malformed fragments stay harmless.
      const target = document.getElementById(window.location.hash.slice(1));
      target?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }
  window.addEventListener('pageshow', restoreAnchor);
  window.addEventListener('hashchange', restoreAnchor);
  restoreAnchor();
})();
