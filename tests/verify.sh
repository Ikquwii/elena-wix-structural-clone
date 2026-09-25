#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
HTML="$ROOT/index.html"
CSS="$ROOT/styles.css"
JS="$ROOT/app.js"

test -f "$HTML"
test -f "$CSS"
test -f "$JS"

grep -q '<title>Elena Belousova | Fashion Photographer</title>' "$HTML"
grep -q 'ELENA BELOUSOVA' "$HTML"
grep -q 'Fashion Weeks' "$HTML"
grep -q 'Latest Projects &amp; Fashion Editorials' "$HTML"
grep -q 'Latest Projects' "$HTML"
grep -q 'Barcelona | Paris' "$HTML"
grep -q 'instagram.com/whiteusova' "$HTML"

grep -q 'const PAGE_HEIGHT = 13634' "$JS"
grep -q 'const PAGE_WIDTH = 1280' "$JS"
grep -q 'const REMOVED_HEADER_HEIGHT = 133' "$JS"
grep -q 'data-placeholder-count="85"' "$HTML"
grep -q 'data-carousel-count="7"' "$HTML"

slot_count=$(sed -n '/const PLACEHOLDERS = \[/,/^\];$/p' "$JS" | tr ',' '\n' | grep -c '^ *\[')
test "$slot_count" -eq 64

carousel_count=$(sed -n '/const CAROUSELS = \[/,/^\];$/p' "$JS" | grep -c '^  {')
test "$carousel_count" -eq 7

carousel_item_count=$(sed -n '/const CAROUSELS = \[/,/^\];$/p' "$JS" | sed -n 's/.*count: *\([0-9][0-9]*\).*/\1/p' | awk '{sum += $1} END {print sum}')
test "$carousel_item_count" -eq 51

grep -q 'aria-label", "Next Item"' "$JS"
grep -q 'carousel-track' "$JS"
grep -q 'carousel-next' "$CSS"
grep -q 'const INFINITE_COPIES = 3' "$JS"
grep -q 'addEventListener("wheel"' "$JS"
grep -q 'event.deltaX' "$JS"
grep -q 'normalizeCarouselPosition' "$JS"
grep -q '{ passive: false }' "$JS"
grep -q 'const scale = Math.min(1, window.innerWidth / PAGE_WIDTH)' "$JS"
grep -q 'background: var(--paper)' "$CSS"
grep -q -- '--track-start' "$JS"
grep -q 'left: var(--track-start) !important' "$CSS"
grep -q 'width: min(100vw, 1700px) !important' "$CSS"
grep -q 'top: 2012px' "$CSS"
grep -q 'font-size: 54px' "$CSS"

palette_count=$(sed -n '/const PALETTE = \[/,/^\];$/p' "$JS" | grep -o '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]' | wc -l | tr -d ' ')
test "$palette_count" -ge 8

if grep -R -q 'wixstatic.com/media\|<img\|background-image: *url' "$HTML" "$CSS" "$JS"; then
  echo 'Remote photography or image elements found' >&2
  exit 1
fi

grep -q '@media (max-width: 767px)' "$CSS"
grep -q 'prefers-reduced-motion' "$CSS"

for page in commercial.html editorials.html fashion-weeks.html about-contact.html; do
  test -f "$ROOT/$page"
done

grep -q 'Commercial Projects &amp; Collections' "$ROOT/commercial.html"
grep -q 'Editorials &amp; Publications' "$ROOT/editorials.html"
grep -q 'Runways / Shows / Backstages' "$ROOT/fashion-weeks.html"
grep -Fq 'Elena Belousova is a European fashion photographer working between Barcelona and Paris. Her images move between editorial storytelling and commercial campaigns — built on soft light, sculptural composition and a calm, self-assured femininity.' "$ROOT/about-contact.html"
grep -q 'publication-marquee' "$HTML"
marquee_count=$(grep -c 'class="publication-marquee-track"' "$HTML")
test "$marquee_count" -eq 3
grep -q 'publication-marquee-top' "$HTML"
if grep -q 'data-publication-carousel\|publication-carousel-next\|bindPublicationCarousel' "$HTML" "$CSS" "$JS"; then
  echo 'Custom publication carousel must be replaced by the original marquee' >&2
  exit 1
fi
grep -q 'mobile-editorial-grid' "$HTML"
grep -q 'class="mobile-publication-marquee"' "$HTML"
grep -q 'class="mobile-section-index"' "$HTML"
test "$(sed -n '/class="mobile-section-index"/,/<\/nav>/p' "$HTML" | grep -c '<a href=')" -eq 4
if grep -q 'class="site-nav"\|class="mobile-nav"\|mobile-menu-button\|id="mobile-menu"' "$HTML"; then
  echo 'Top navigation plaque still exists' >&2
  exit 1
fi
if grep -q 'mobileMenuButton\|mobileMenu' "$JS"; then
  echo 'Removed mobile menu JavaScript still exists' >&2
  exit 1
fi

for contact in 'tel:' 'mailto:' 'instagram.com'; do
  if grep -q "$contact" "$ROOT/about-contact.html"; then
    echo "Contact detail found outside Main: $contact" >&2
    exit 1
  fi
done

if grep -q 'portfolio-01-gallery-wall\|ELVINA BELLOIR.*ALL' "$HTML" "$ROOT"/*.html; then
  echo 'Gallery Wall structure leaked into the implementation' >&2
  exit 1
fi

echo "Portfolio checks passed: $slot_count mapped slots, $carousel_count carousels, $carousel_item_count carousel items, four direct routes"
