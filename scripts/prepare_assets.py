#!/usr/bin/env python3
"""Build local WebP assets from an original Wix HTML and warmup capture."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen
from PIL import Image, ImageOps
from lxml import html

CDN = 'https://static.wixstatic.com/media/'
SOURCE = 'https://proconceptpr.wixsite.com/elenabelousova'
HERO = '516d35_b44d57bdc9f34883b43cfd2880e0b13d~mv2.jpg'
LATEST = 'pro-gallery-comp-lx0dqhn5_r_comp-l45l1x5f_r_comp-l45kw2h61_r_comp-l61z6xb0'

def objects(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from objects(child)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', type=Path, default=Path('/tmp/elena-source-20260929'))
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    warmup = json.loads((args.capture / 'wix-warmup-data.json').read_text())
    doc = html.parse(str(args.capture / 'original.html'))
    app = warmup['appsWarmupData']['14271d6f-ba62-d045-549b-ab972ae1f70e']
    galleries = []
    for node in doc.xpath('//*[@id]'):
        component = node.get('id')
        data = app.get(component + '_galleryData')
        if data is None:
            continue
        items = []
        for entry in data['items']:
            meta = entry['metaData']
            items.append(dict(id=entry['itemId'], mediaUrl=entry['mediaUrl'],
                              src='assets/' + Path(entry['mediaUrl']).stem + '.webp',
                              width=meta['width'], height=meta['height'],
                              title=meta.get('title', ''), focalPoint=meta.get('focalPoint', [0.5, 0.5])))
        galleries.append(dict(id=component, total=len(items), items=items))
    assert [g['total'] for g in galleries] == [14,14,16,15,23,11,5,6,4,6,5,4,14], 'Captured gallery order/counts changed'
    image_meta = {}
    for obj in objects(warmup):
        src = obj.get('src', '')
        if isinstance(src, str) and src.startswith('wix:image://v1/'):
            media = src.split('/')[3]
            match = re.search(r'originWidth=(\d+)&originHeight=(\d+)', src)
            if match:
                image_meta[media] = dict(width=int(match[1]), height=int(match[2]), focalPoint=obj.get('settings', {}).get('focalPoint', [0.5, 0.5]))
    latest = []
    for node in doc.xpath(f'//*[@id="{LATEST}"]//a[@data-hook="item-link-wrapper"]'):
        img = node.xpath('.//img[@data-hook="gallery-item-image-img"]')[0]
        media = img.get('src').split('/media/')[1].split('/')[0]
        meta = image_meta[media]
        latest.append(dict(id=node.get('data-id'), src='assets/' + Path(media).stem + '.webp',
                           source=CDN + media, mediaUrl=media, title=img.get('alt', ''), href=node.get('href'), **meta))
    assert len(latest) == 11, 'Latest project count changed'
    hero_meta = image_meta.get(HERO, {})
    # data-image-info preserves original dimensions, unlike cropped SSR URLs.
    if not hero_meta:
        for node in doc.xpath('//*[@data-image-info]'):
            descriptor = json.loads(node.get('data-image-info'))
            data = descriptor.get('imageData', {})
            if data.get('uri') == HERO:
                hero_meta = dict(width=data['width'], height=data['height'])
                break
    hero = dict(source=CDN + HERO, src='assets/hero.webp', **hero_meta)
    jobs = {}
    for item in [i for g in galleries for i in g['items']] + latest:
        jobs.setdefault(item['mediaUrl'], dict(media=item['mediaUrl'], src=item['src'], edge=1400,
                                             width=item['width'], height=item['height']))
    jobs[HERO] = dict(media=HERO, src='assets/hero.webp', edge=1800, **hero_meta)
    (args.output / 'assets').mkdir(parents=True, exist_ok=True)
    def download(job):
        edge = min(job['edge'], max(job.get('width', job['edge']), job.get('height', job['edge'])))
        url = f"{CDN}{job['media']}/v1/fit/w_{edge},h_{edge},q_90/{job['media']}"
        destination = args.output / job['src']
        for attempt in range(3):
            try:
                if destination.exists():
                    with Image.open(destination) as existing:
                        existing.load()
                        return job['media'], dict(downloadedWidth=existing.width, downloadedHeight=existing.height, bytes=destination.stat().st_size, downloadUrl=url)
                with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60) as response:
                    content = response.read()
                with Image.open(BytesIO(content)) as original:
                    image = ImageOps.exif_transpose(original).convert('RGB')
                    image.thumbnail((job['edge'], job['edge']), Image.Resampling.LANCZOS)
                    image.save(destination, 'WEBP', quality=82 if job['media'] == HERO else 80, method=6)
                    return job['media'], dict(downloadedWidth=image.width, downloadedHeight=image.height, bytes=destination.stat().st_size, downloadUrl=url)
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    results, failures = {}, []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(download, job): media for media, job in jobs.items()}
        for future in as_completed(futures):
            try:
                media, result = future.result()
                results[media] = result
            except Exception as exc:
                failures.append(f'{futures[future]}: {exc}')
    for item in [i for g in galleries for i in g['items']] + latest:
        item.update(results.get(item['mediaUrl'], dict(available=False, error='CDN download failed; see assetErrors')))
        item.setdefault('available', True)
    hero.update(results[HERO])
    if 'width' not in hero:
        raise SystemExit('Hero source dimensions absent from capture; confirm before publishing manifest')
    manifest = dict(sourceUrl=SOURCE, capturedAt=datetime.fromtimestamp((args.capture / 'original.html').stat().st_mtime, timezone.utc).isoformat(), hero=hero, galleries=galleries, latest=latest, assetErrors=failures)
    (args.output / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(dict(uniqueAssets=len(results), bytes=sum(r['bytes'] for r in results.values()), galleries=[dict(id=g['id'], total=g['total']) for g in galleries], failures=failures)))
    if failures:
        raise SystemExit('Asset failures:\n' + '\n'.join(failures))

if __name__ == '__main__':
    main()
