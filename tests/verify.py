"""Offline brief/data/asset regression checks; browser layout remains a separate check."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def check(condition, message):
    if not condition:
        raise AssertionError(message)


class Element:
    def __init__(self, tag, attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    @property
    def text(self):
        return ' '.join(' '.join(c.text if isinstance(c, Element) else c for c in self.children).split())

    def all(self, tag=None, cls=None):
        found = []
        for child in self.children:
            if isinstance(child, Element):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get('class', '').split()):
                    found.append(child)
                found.extend(child.all(tag, cls))
        return found


class Document(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Element('document')
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        check(self.stack[-1].tag == tag, f'Invalid HTML nesting at </{tag}>')
        self.stack.pop()

    def handle_data(self, data):
        self.stack[-1].children.append(data)


html = (ROOT / 'index.html').read_text()
doc = Document(html).root
check(len(doc.all('main')) == 1, 'Expected one shared main, not duplicate desktop/mobile documents')
ids = [n.attrs['id'] for n in doc.all() if 'id' in n.attrs]
check(len(ids) == len(set(ids)), 'Duplicate HTML ids')
check(any(n.attrs.get('name') == 'viewport' for n in doc.all('meta')), 'Missing responsive viewport')
navs = doc.all('nav')
check(len(navs) == 1, 'Expected one section navigation; obsolete top plaque must be removed')
expected_nav = [('#commercial', 'Commercial Projects & Collections'), ('#fashion-weeks', 'Fashion weeks runways/shows/backstages'), ('#editorials', 'Editorials & Publications'), ('#about-contact', 'About & Contact')]
check([(n.attrs.get('href'), n.text) for n in navs[0].all('a')] == expected_nav, 'Section navigation text/order/anchors changed')
check(all(href[1:] in ids for href, _ in expected_nav), 'Broken section anchor')
check(len(doc.all(cls='publication-marquee')) == 2, 'Expected exactly two publication bands')
check(not any(n.attrs.get('class', '') in {'site-nav', 'mobile-nav', 'mobile-section-index'} for n in doc.all()), 'Obsolete navigation plaque remains')
required = ['ELENA BELOUSOVA', 'Portfolio', 'Fashion Weeks', 'Commercial Projects & Collections', 'Editorials & Publications', 'Vogue, Glamour, L’officiel', 'Latest Projects', 'Here you can check out my latest commercial projects.', 'LET’S CREATE SOMETHING ICONIC.', 'Elena Belousova is a European fashion photographer working between Barcelona and Paris. Her images move between editorial storytelling and commercial campaigns — built on soft light, sculptural composition and a calm, self-assured femininity.']
for text in required:
    check(text in doc.text, f'Missing required copy: {text}')
contacts = doc.all(cls='contact-item')
check([c.text for c in contacts] == ['Based in Barcelona | Paris', 'Phone +34 608 41 89 33', 'Instagram @whiteusova', 'Email elenawhiteusova@gmail.com'], 'Contact content/order changed')
check(contacts[1].attrs.get('href') == 'tel:+34608418933', 'Phone not clickable')
check(contacts[2].tag == 'a' and contacts[2].attrs.get('href', '').startswith('https://www.instagram.com/whiteusova'), 'Instagram not clickable')
check(contacts[3].attrs.get('href') == 'mailto:elenawhiteusova@gmail.com', 'Email not clickable')
portrait = doc.all(cls='about-portrait')
check(len(portrait) == 1 and portrait[0].attrs.get('aria-label') == 'Portrait placeholder' and not portrait[0].all('img'), 'Portrait placeholder changed')
for sheet in ['shell.css', 'gallery.css']:
    css = (ROOT / sheet).read_text()
    check('@media (max-width: 700px)' in css and 'prefers-reduced-motion' in css, f'{sheet}: missing mobile/reduced-motion rules')
check([s.attrs.get('src', '').split('?')[0] for s in doc.all('script')] == ['gallery-data.js', 'image-loader.js', 'app.js'], 'Data and image loader must load before app')

manifest = json.loads((ROOT / 'source-manifest.json').read_text())
match = re.fullmatch(r'\s*window\.PORTFOLIO_DATA\s*=\s*(\{.*\})\s*;?\s*', (ROOT / 'gallery-data.js').read_text(), re.S)
check(match, 'gallery-data.js must be an auditable JSON assignment')
data = json.loads(match[1])
expected = [('comp-m6ext3o8', 14, 'fashion'), ('comp-m1rp6m5r', 14, 'commercial'), ('comp-m71lau44', 16, 'commercial'), ('comp-m5npdged', 15, 'commercial'), ('comp-micz738a', 23, 'commercial'), ('comp-m71s2exl', 11, 'commercial'), ('comp-m0140w6e', 5, 'commercial'), ('comp-m0q9sda7', 6, 'commercial'), ('comp-m0q9qvvx', 4, 'editorials'), ('comp-m71s045z', 6, 'editorials'), ('comp-m0mfxpea', 5, 'editorials'), ('comp-m0mg284t', 4, 'editorials'), ('comp-m1rq3518', 14, 'editorials')]
galleries = data['rows'] + data['layouts']
check([(g['id'], g['total']) for g in manifest['galleries']] == [(i, n) for i, n, _ in expected], 'Independent source manifest gallery coverage/count/order changed')
check([g['id'] for g in galleries] == [i for i, _, _ in expected], 'All 13 galleries must appear once in source order')
for actual, source, (gid, count, section) in zip(galleries, manifest['galleries'], expected):
    check(actual.get('section', 'editorials') == section, f'{gid}: incorrect section')
    check(len(actual['items']) == len(source['items']) == count, f'{gid}: incorrect photo count')
    check([p['id'] for p in actual['items']] == [p['id'] for p in source['items']], f'{gid}: photo IDs/order differ from source')
    check(len(set(p['id'] for p in actual['items'])) == count, f'{gid}: duplicate photos/loop copies')
    for photo, original in zip(actual['items'], source['items']):
        for key in original:
            check(photo.get(key) == original[key], f'{gid}/{photo["id"]}: source field {key} changed')
check(len(data['latest']) == len(manifest['latest']) == 11, 'Latest must contain 11 projects')
check([p['id'] for p in data['latest']] == [p['id'] for p in manifest['latest']], 'Latest order differs from source')
for photo, source in zip(data['latest'], manifest['latest']):
    check(all(photo.get(k) == v for k, v in source.items()), f'Latest {source["id"]}: source metadata/link changed')

photos = [manifest['hero']] + [p for g in manifest['galleries'] for p in g['items']] + manifest['latest']
missing = []
checked = set()
for photo in photos:
    src = photo['src']
    path = (ROOT / src).resolve()
    check(path.is_relative_to(ROOT) and not re.match(r'\w+://', src), f'Nonlocal asset {src}')
    if photo.get('available') is False:
        missing.append(photo)
        check(any(photo['mediaUrl'] in error for error in manifest['assetErrors']), f'Missing source asset lacks recorded error: {src}')
        continue
    check(path.is_file() and path.stat().st_size > 0, f'Missing/empty asset: {src}')
    if path in checked:
        continue
    with Image.open(path) as image:
        check(image.size == (photo['downloadedWidth'], photo['downloadedHeight']), f'Actual image dimensions differ: {src}')
        image.load()  # Decode pixels; an HTTP error body or truncated file must fail.
    check(path.stat().st_size == photo['bytes'], f'Asset bytes differ from manifest: {src}')
    checked.add(path)
for node in doc.all('img') + doc.all('script') + doc.all('link'):
    src = node.attrs.get('src') or node.attrs.get('href')
    if src and not src.startswith(('http:', 'https:', '#')):
        check((ROOT / src.split('?')[0]).is_file(), f'HTML references missing local file: {src}')
check(len(manifest['assetErrors']) == len({p['mediaUrl'] for p in missing}), 'Asset error list and unavailable items disagree')
print(f'PASS: one main; navigation, copy, contacts, 2 bands; 13 galleries / {sum(n for _, n, _ in expected)} source-ordered photos; Latest 11; {len(checked)} unique local images decoded.')
if missing:
    for photo in missing:
        print(f'WARNING: source asset unavailable: {photo["id"]} / {photo["mediaUrl"]}')
    for error in manifest['assetErrors']:
        print(f'WARNING: {error}')
    print('PASS applies to structure/data consistency only; photography assets are INCOMPLETE.')
else:
    print('PASS: all source photography assets available locally.')
print('Browser viewport, interaction, finite rendered gallery counts and visual fidelity require separate browser checks.')
