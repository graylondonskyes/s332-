import argparse
import json
import re
import zipfile
from pathlib import Path

RETAILER_RULES = {
    'apple_books': {'required': ['package-manifest.json', 'metadata.json', 'rights.json', 'validation/validation-report.json']},
    'kobo': {'required': ['package-manifest.json', 'metadata.json', 'rights.json', 'validation/validation-report.json']},
    'kdp_ebook': {'required': ['package-manifest.json', 'metadata.json', 'rights.json', 'validation/validation-report.json']},
    'kdp_print_prep': {'required': ['package-manifest.json', 'metadata.json', 'rights.json', 'validation/validation-report.json']},
}

def slugify(value: str) -> str:
    value = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return value or 'untitled'

def parse_json(files, name, fallback=None):
    fallback = fallback or {}
    try:
        return json.loads(files.get(name, '{}'))
    except Exception:
        return fallback

def build_validation_report(names, manifest, size_bytes):
    required = RETAILER_RULES[manifest['channel']]['required']
    missing = [name for name in required if name not in names]
    return {
        'schema': 'skye.retailer.validation',
        'version': '2.7.0',
        'channel': manifest['channel'],
        'required_files': required,
        'missing_files': missing,
        'package_bytes': size_bytes,
        'ok': len(missing) == 0 and size_bytes >= 900,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--output_dir', required=True)
    args = parser.parse_args()
    workspace = json.loads(Path(args.workspace).read_text())
    files = workspace.get('files', {})
    mode = workspace.get('mode', 'skydocx')
    metadata = parse_json(files, 'metadata.json')
    channel = parse_json(files, 'channel.json')
    edition = parse_json(files, 'edition.json')
    title = metadata.get('title') or channel.get('channelTitle') or 'Untitled Release'
    slug = metadata.get('slug') or channel.get('slug') or slugify(title)
    author = metadata.get('author') or channel.get('author') or 'Operator'
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    lanes = [
        ('apple-ready', 'apple_books'),
        ('kobo-ready', 'kobo'),
        ('kdp-ready-digital', 'kdp_ebook'),
        ('kdp-ready-print-prep', 'kdp_print_prep')
    ]
    created = []
    for lane_slug, channel_id in lanes:
        zip_path = out_dir / f'{slug}-{lane_slug}.zip'
        manifest = {
            'schema': 'skye.retailer.package',
            'version': '2.7.0',
            'workspace_mode': mode,
            'title': title,
            'slug': slug,
            'author': author,
            'channel': channel_id,
            'lane': lane_slug,
            'edition_number': edition.get('editionNumber') if isinstance(edition, dict) else None,
            'source_files': sorted(files.keys())
        }
        rights = {
            'schema': 'skye.retailer.rights',
            'version': '2.7.0',
            'territories': metadata.get('territories') or ['US'],
            'imprint': metadata.get('imprint') or 'SOLEnterprises',
            'author': author,
        }
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('package-manifest.json', json.dumps(manifest, indent=2) + '\n')
            zf.writestr('metadata.json', json.dumps(metadata or channel, indent=2) + '\n')
            zf.writestr('rights.json', json.dumps(rights, indent=2) + '\n')
            if 'manuscript.md' in files:
                zf.writestr('content/manuscript.md', files['manuscript.md'])
            if 'post.md' in files:
                zf.writestr('content/post.md', files['post.md'])
            if 'storefront.json' in files:
                zf.writestr('store/storefront.json', files['storefront.json'])
            if 'campaign.json' in files:
                zf.writestr('campaign/campaign.json', files['campaign.json'])
        with zipfile.ZipFile(zip_path, 'a', compression=zipfile.ZIP_DEFLATED) as zf:
            names = sorted(zf.namelist()) + ['validation/validation-report.json']
            report = build_validation_report(names, manifest, zip_path.stat().st_size)
            zf.writestr('validation/validation-report.json', json.dumps(report, indent=2) + '\n')
        created.append({'path': str(zip_path.relative_to(out_dir.parents[2])), 'channel': channel_id, 'lane': lane_slug})
    aggregate = {
        'schema': 'skye.retailer.package.aggregate',
        'version': '2.7.0',
        'mode': mode,
        'slug': slug,
        'count': len(created),
        'packages': created
    }
    (out_dir / f'{slug}-retailer-packages.json').write_text(json.dumps(aggregate, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'slug': slug, 'mode': mode, 'packages': created}))

if __name__ == '__main__':
    main()
