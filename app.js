const PAGE_WIDTH = 1280;
const PAGE_HEIGHT = 13767;
const MAIN_CONTENT_OFFSET = 100;
const INFINITE_COPIES = 3;

const PALETTE = [
  "#343a3f",
  "#b9bec2",
  "#c9c4c0",
  "#aeb6ba",
  "#d7d8d6",
  "#969da1",
  "#c5c9c6",
  "#aaa5a2",
  "#dfe0dd",
  "#7d868b",
  "#cbc7c4",
  "#b3b9bc"
];

const PLACEHOLDERS = [
  [0,133,1280,822],
  [-77,1441,391,521],[324,1441,391,521],[725,1441,391,521],[1126,1441,391,521],
  [5,2162,442,589],[467,2162,442,589],[929,2162,442,589],
  [-63,2783,354,472],[301,2783,354,472],[665,2783,354,472],[1029,2783,354,472],[1393,2783,354,472],
  [-64,3290,354,472],[300,3290,354,472],[664,3290,354,472],[1028,3290,354,472],
  [-64,3793,309,464],[255,3793,309,464],[574,3793,309,464],[893,3793,331,464],[1234,3793,331,464],
  [-29,4283,354,472],[335,4283,354,472],[699,4283,354,472],[1063,4283,354,472],
  [40,4790,442,589],[502,4790,442,589],[964,4790,442,589],
  [40,5419,442,589],[502,5419,442,589],[964,5419,442,589],
  [40,6548,442,589],[502,6548,442,589],[964,6548,442,589],
  [-29,7174,354,472],[335,7174,354,472],[699,7174,354,472],[1063,7174,354,472],[1427,7174,354,472],
  [40,7687,285,285],[345,7687,590,590],[40,7992,285,285],
  [40,8338,563,447],[623,8338,617,447],
  [40,8805,1200,669],
  [0,10384,335,502],[340,10384,149,299],[494,10384,198,299],
  [40,11178,373,299],[453,11178,374,561],[867,11178,373,249],
  [40,11497,373,470],[453,11759,374,300],[867,11447,373,520],
  [40,11987,373,300],[453,12079,374,500],[867,11987,373,300],
  [40,12307,373,540],[453,12599,374,320],[867,12307,373,470],
  [40,12867,373,300],[453,12939,374,260],[867,12797,373,400]
];

const CAROUSELS = [
  { y: 1441, height: 521, startX: -77, widths: [391], gap: 10, count: 14, visible: 4 },
  { y: 2162, height: 589, startX: 5, widths: [442], gap: 20, count: 14, visible: 3 },
  { y: 2783, height: 472, startX: -63, widths: [354], gap: 10, count: 5, visible: 4 },
  { y: 3290, height: 472, startX: -64, widths: [354], gap: 10, count: 4, visible: 4 },
  { y: 3793, height: 464, startX: -64, widths: [309,309,309,331,331], gap: 10, count: 5, visible: 5 },
  { y: 4283, height: 472, startX: -29, widths: [354], gap: 10, count: 4, visible: 4 },
  { y: 7174, height: 472, startX: -29, widths: [354], gap: 10, count: 5, visible: 4 }
];

const CAROUSEL_RANGES = [
  [1,4],
  [5,7],
  [8,12],
  [13,16],
  [17,21],
  [22,25],
  [35,39]
];

const canvas = document.querySelector("#canvas");
const viewport = document.querySelector("#viewport");
const publicationCarousel = document.querySelector("[data-publication-carousel]");

function renderPlaceholders() {
  const fragment = document.createDocumentFragment();

  PLACEHOLDERS.forEach(([x, y, width, height], index) => {
    const belongsToCarousel = CAROUSEL_RANGES.some(([start, end]) => index >= start && index <= end);
    if (belongsToCarousel) return;

    const slot = document.createElement("div");
    slot.className = "placeholder";
    slot.style.left = `${x}px`;
    slot.style.top = `${y >= 1441 ? y + MAIN_CONTENT_OFFSET : y}px`;
    slot.style.width = `${width}px`;
    slot.style.height = `${height}px`;
    slot.style.backgroundColor = index === 0 ? PALETTE[0] : PALETTE[(index % (PALETTE.length - 1)) + 1];
    slot.setAttribute("role", "img");
    slot.setAttribute("aria-label", `Photography placeholder ${index + 1}`);
    slot.dataset.slot = String(index + 1).padStart(2, "0");
    fragment.appendChild(slot);
  });

  canvas.prepend(fragment);
}

function carouselCycleWidth(config) {
  let width = 0;
  for (let item = 0; item < config.count; item += 1) {
    width += config.widths[item % config.widths.length] + config.gap;
  }
  return width;
}

function normalizeCarouselPosition(position, cycleWidth) {
  return ((position % cycleWidth) + cycleWidth) % cycleWidth;
}

function bindInfiniteCarousel(carousel, track, button, config) {
  const cycleWidth = carouselCycleWidth(config);
  let currentPosition = 0;
  let targetPosition = 0;
  let buttonIndex = 0;
  let animationFrame = 0;

  function paint() {
    track.style.transform = `translate3d(${-cycleWidth - currentPosition}px, 0, 0)`;
    carousel.dataset.activeOffset = String(Math.round(normalizeCarouselPosition(currentPosition, cycleWidth)));
  }

  function animate() {
    const difference = targetPosition - currentPosition;
    currentPosition += difference * 0.18;

    if (Math.abs(difference) < 0.35) {
      currentPosition = targetPosition;
    }

    if (currentPosition >= cycleWidth || currentPosition < 0) {
      const normalized = normalizeCarouselPosition(currentPosition, cycleWidth);
      const completedCycles = currentPosition - normalized;
      currentPosition = normalized;
      targetPosition -= completedCycles;
    }

    paint();

    if (currentPosition !== targetPosition) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = 0;
    }
  }

  function moveBy(distance) {
    targetPosition += distance;
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  }

  carousel.addEventListener("wheel", (event) => {
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const distance = horizontalIntent ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (!distance) return;

    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? PAGE_WIDTH : 1;
    moveBy(distance * unit);
  }, { passive: false });

  button.addEventListener("click", () => {
    const itemWidth = config.widths[buttonIndex % config.widths.length];
    buttonIndex = (buttonIndex + 1) % config.count;
    moveBy(itemWidth + config.gap);
  });

  paint();
}

function renderCarousels() {
  const fragment = document.createDocumentFragment();

  CAROUSELS.forEach((config, carouselIndex) => {
    const carousel = document.createElement("section");
    carousel.className = "carousel";
    carousel.style.top = `${config.y + MAIN_CONTENT_OFFSET}px`;
    carousel.style.height = `${config.height}px`;
    carousel.setAttribute("aria-label", `Portfolio carousel ${carouselIndex + 1}`);
    carousel.dataset.carousel = String(carouselIndex + 1);
    carousel.dataset.activeIndex = "0";

    const track = document.createElement("div");
    track.className = "carousel-track";
    track.style.left = `${config.startX}px`;
    track.style.setProperty("--track-start", `${config.startX}px`);
    track.style.height = `${config.height}px`;
    track.style.gap = `${config.gap}px`;

    for (let copyIndex = 0; copyIndex < INFINITE_COPIES; copyIndex += 1) {
      for (let itemIndex = 0; itemIndex < config.count; itemIndex += 1) {
        const item = document.createElement("div");
        item.className = "placeholder carousel-item";
        item.style.width = `${config.widths[itemIndex % config.widths.length]}px`;
        item.style.height = `${config.height}px`;
        item.style.backgroundColor = PALETTE[((carouselIndex * 3 + itemIndex) % (PALETTE.length - 1)) + 1];

        if (copyIndex === 1) {
          item.setAttribute("role", "img");
          item.setAttribute("aria-label", `Carousel ${carouselIndex + 1}, photography placeholder ${itemIndex + 1}`);
          item.dataset.carouselItem = String(itemIndex + 1);
        } else {
          item.setAttribute("aria-hidden", "true");
          item.dataset.carouselClone = String(copyIndex);
        }

        track.appendChild(item);
      }
    }

    const button = document.createElement("button");
    button.className = "carousel-next";
    button.type = "button";
    button.setAttribute("aria-label", "Next Item");

    carousel.append(track, button);
    bindInfiniteCarousel(carousel, track, button, config);
    fragment.appendChild(carousel);
  });

  canvas.prepend(fragment);
}

function bindPublicationCarousel() {
  if (!publicationCarousel) return;

  const track = publicationCarousel.querySelector(".publication-carousel-track");
  const set = publicationCarousel.querySelector(".publication-carousel-set");
  const button = publicationCarousel.querySelector(".publication-carousel-next");
  if (!track || !set || !button) return;

  const cycleWidth = set.getBoundingClientRect().width || PAGE_WIDTH;
  let currentPosition = 0;
  let targetPosition = 0;
  let animationFrame = 0;

  function paint() {
    track.style.transform = `translate3d(${-cycleWidth - currentPosition}px, 0, 0)`;
    publicationCarousel.dataset.activeOffset = String(Math.round(normalizeCarouselPosition(currentPosition, cycleWidth)));
  }

  function animate() {
    const difference = targetPosition - currentPosition;
    currentPosition += difference * 0.18;

    if (Math.abs(difference) < 0.35) currentPosition = targetPosition;

    if (currentPosition >= cycleWidth || currentPosition < 0) {
      const normalized = normalizeCarouselPosition(currentPosition, cycleWidth);
      const completedCycles = currentPosition - normalized;
      currentPosition = normalized;
      targetPosition -= completedCycles;
    }

    paint();

    if (currentPosition !== targetPosition) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      animationFrame = 0;
    }
  }

  function moveBy(distance) {
    targetPosition += distance;
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  }

  publicationCarousel.addEventListener("wheel", (event) => {
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const distance = horizontalIntent ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (!distance) return;

    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? PAGE_WIDTH : 1;
    moveBy(distance * unit);
  }, { passive: false });

  button.addEventListener("click", () => moveBy(260));
  paint();
}

function scaleCanvas() {
  const scale = Math.min(1, window.innerWidth / PAGE_WIDTH);
  document.documentElement.style.setProperty("--scale", String(scale));
  viewport.style.height = `${Math.ceil(PAGE_HEIGHT * scale)}px`;
}

renderPlaceholders();
renderCarousels();
bindPublicationCarousel();
scaleCanvas();
window.addEventListener("resize", scaleCanvas, { passive: true });

const mobileMenuButton = document.querySelector(".mobile-menu-button");
const mobileMenu = document.querySelector("#mobile-menu");

if (mobileMenuButton && mobileMenu) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mobileMenuButton.getAttribute("aria-expanded") === "true";
    mobileMenuButton.setAttribute("aria-expanded", String(!isOpen));
    mobileMenu.classList.toggle("is-open", !isOpen);
  });
}
