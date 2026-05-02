import asyncio
import base64
import json
import os
import re
from pathlib import Path
from typing import Dict, List

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
PROJECT_DOCS = ROOT / 'PROJECT_DOCS'
SCREENSHOT_DIR = PROJECT_DOCS / 'SMOKE_SCREENSHOTS'
TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='


def read_text(*parts: str) -> str:
    return ROOT.joinpath(*parts).read_text(encoding='utf-8')


def load_html(*parts: str) -> str:
    html = read_text(*parts)
    html = re.sub(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<link[^>]+rel=["\']manifest["\'][^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<script\s+src=["\'][^"\']+["\']\s*></script>', '', html, flags=re.IGNORECASE)
    html = html.replace('src="assets/icon-192.png"', f'src="{TRANSPARENT_GIF}"')
    html = html.replace('src="icons/icon-192.png"', f'src="{TRANSPARENT_GIF}"')
    return html


def b64(text: str) -> str:
    return base64.b64encode(text.encode('utf-8')).decode('ascii')


def build_contents_listing(example_root: Path) -> Dict[str, List[dict]]:
    listing: Dict[str, List[dict]] = {}
    for current, dirs, files in os.walk(example_root):
        current_path = Path(current)
        rel_dir = current_path.relative_to(example_root).as_posix()
        rel_dir = '' if rel_dir == '.' else rel_dir
        items = []
        for dirname in sorted(dirs):
            path = f"{rel_dir}/{dirname}".strip('/')
            items.append({'type': 'dir', 'path': path, 'name': dirname})
        for filename in sorted(files):
            path = f"{rel_dir}/{filename}".strip('/')
            items.append({'type': 'file', 'path': path, 'name': filename, 'size': (example_root / path).stat().st_size})
        listing[rel_dir] = items
    return listing


def build_mock_fetch_routes() -> Dict[str, dict]:
    api_base = 'https://api.github.test'
    owner = 'acme'
    repo = 'route-lab'
    healthy_root = ROOT / 'examples' / 'healthy-static-site'
    broken_root = ROOT / 'examples' / 'broken-ui'
    healthy_listing = build_contents_listing(healthy_root)
    healthy_files = {
        path.relative_to(healthy_root).as_posix(): path.read_text(encoding='utf-8')
        for path in healthy_root.rglob('*') if path.is_file()
    }
    broken_files = {
        path.relative_to(broken_root).as_posix(): path.read_text(encoding='utf-8')
        for path in broken_root.rglob('*') if path.is_file()
    }

    routes: Dict[str, dict] = {}

    def add_json(url: str, payload):
        routes[url] = {
            'status': 200,
            'headers': {'content-type': 'application/json'},
            'body': json.dumps(payload)
        }

    routes['assets/proof-fixture.json'] = {
        'status': 200,
        'headers': {'content-type': 'application/json'},
        'body': read_text('shared', 'proof-fixture.json')
    }
    routes['assets/sample-report.json'] = {
        'status': 200,
        'headers': {'content-type': 'application/json'},
        'body': read_text('shared', 'sample-report.json')
    }

    for rel_dir, items in healthy_listing.items():
        endpoint = f'{api_base}/repos/{owner}/{repo}/contents'
        if rel_dir:
            endpoint += f'/{rel_dir}'
        endpoint += '?ref=main'
        add_json(endpoint, items)

    for rel_path, text in healthy_files.items():
        endpoint = f'{api_base}/repos/{owner}/{repo}/contents/{rel_path}?ref=main'
        add_json(endpoint, {
            'type': 'file',
            'path': rel_path,
            'encoding': 'base64',
            'content': b64(text)
        })

    pr_number = '17'
    pr_head = 'pr-head-17'
    add_json(f'{api_base}/repos/{owner}/{repo}/pulls/{pr_number}', {
        'number': int(pr_number),
        'head': {'sha': pr_head, 'ref': 'feature/pr-17'}
    })
    pr_files = [{'filename': rel_path, 'status': 'modified'} for rel_path in sorted(broken_files.keys())]
    add_json(f'{api_base}/repos/{owner}/{repo}/pulls/{pr_number}/files?per_page=100&page=1', pr_files)
    add_json(f'{api_base}/repos/{owner}/{repo}/pulls/{pr_number}/files?per_page=100&page=2', [])
    for rel_path, text in broken_files.items():
        endpoint = f'{api_base}/repos/{owner}/{repo}/contents/{rel_path}?ref={pr_head}'
        add_json(endpoint, {
            'type': 'file',
            'path': rel_path,
            'encoding': 'base64',
            'content': b64(text)
        })
    return routes


async def build_page(browser, html: str, css: str, scripts: List[str], mock_fetch_routes: Dict[str, dict]):
    context = await browser.new_context(viewport={'width': 1440, 'height': 1240}, accept_downloads=True)
    page = await context.new_page()
    routes_json = json.dumps(mock_fetch_routes)
    init_script = f"""(() => {{
      const routes = {routes_json};
      window.__deadRouteDetectorFetch = async function(input, init) {{
        const key = typeof input === 'string' ? input : (input && input.url) || '';
        if (Object.prototype.hasOwnProperty.call(routes, key)) {{
          const mock = routes[key];
          return new Response(mock.body, {{ status: mock.status || 200, headers: mock.headers || {{}} }});
        }}
        return fetch(input, init);
      }};
    }})();"""
    await page.set_content(html)
    await page.add_script_tag(content=init_script)
    await page.add_style_tag(content=css)
    for script in scripts:
        await page.add_script_tag(content=script)
    return context, page


async def assert_visible_in_viewport(page, selector: str, label: str):
    locator = page.locator(selector)
    await locator.scroll_into_view_if_needed()
    await locator.wait_for(state='visible')
    box = await locator.bounding_box()
    if not box or box['width'] <= 0 or box['height'] <= 0:
        raise AssertionError(f'{label} is not visibly rendered.')
    viewport = page.viewport_size
    if box['x'] < 0 or box['x'] + box['width'] > viewport['width']:
        raise AssertionError(f'{label} is clipped horizontally outside the viewport.')
    if box['y'] < 0 or box['y'] + box['height'] > viewport['height']:
        raise AssertionError(f'{label} is clipped vertically outside the viewport after scrolling into view.')


async def expect_button_state(page, selector: str, disabled: bool):
    locator = page.locator(selector)
    actual = await locator.is_disabled()
    if actual != disabled:
        raise AssertionError(f'{selector} disabled state mismatch. expected={disabled} actual={actual}')


async def assert_static_page_contains(browser, html: str, css: str, expected_text: str):
    context, page = await build_page(browser, html, css, [], {})
    try:
        body = await page.locator('body').text_content()
        if expected_text not in body:
            raise AssertionError('Static page did not render expected text.')
    finally:
        await context.close()


async def run_webapp_smoke(browser, mock_routes: Dict[str, dict]):
    html = load_html('webapp', 'dead-route-detector-skyevsx', 'scan.html')
    css = read_text('webapp', 'dead-route-detector-skyevsx', 'styles.css')
    scripts = [
        read_text('webapp', 'dead-route-detector-skyevsx', 'scanner-core.js'),
        read_text('webapp', 'dead-route-detector-skyevsx', 'report-tools.js'),
        read_text('webapp', 'dead-route-detector-skyevsx', 'app.js')
    ]
    context, page = await build_page(browser, html, css, scripts, mock_routes)
    try:
        for static_page in ['index.html', 'install.html', 'privacy.html']:
            await assert_static_page_contains(browser, load_html('webapp', 'dead-route-detector-skyevsx', static_page), css, 'Dead Route Detector - SkyeVSX')

        visible_controls = [
            ('#runProofFixture', 'Proof fixture button'),
            ('label[for="workspaceInput"]', 'Workspace folder label'),
            ('#runWorkspaceScan', 'Workspace scan button'),
            ('#loadSampleReport', 'Sample report button'),
            ('label[for="baselineInput"]', 'Baseline import label'),
            ('#pinBaseline', 'Pin baseline button'),
            ('#compareBaseline', 'Compare baseline button'),
            ('#exportReport', 'Export current report button'),
            ('#exportReportMarkdown', 'Export current markdown button'),
            ('#exportReportSarif', 'Export current sarif button'),
            ('#exportDiffJson', 'Export diff json button'),
            ('#exportDiffMarkdown', 'Export diff markdown button'),
            ('#statusText', 'Status text'),
            ('#currentSource', 'Current source panel')
        ]
        for selector, label in visible_controls:
            await assert_visible_in_viewport(page, selector, label)

        for selector in ['#pinBaseline', '#compareBaseline', '#exportReport', '#exportReportMarkdown', '#exportReportSarif', '#exportDiffJson', '#exportDiffMarkdown']:
            await expect_button_state(page, selector, True)

        await page.click('#loadSampleReport')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('Included sample report')")
        await page.screenshot(path=str(SCREENSHOT_DIR / 'webapp-scan-initial.png'), full_page=True)

        await page.locator('#workspaceInput').set_input_files(str(ROOT / 'examples' / 'healthy-static-site'))
        await page.click('#runWorkspaceScan')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('Selected workspace folder')")
        metric_values = await page.locator('.metric strong').all_text_contents()
        if metric_values[:4] != ['0', '0', '0', '0']:
            raise AssertionError(f'Healthy workspace scan metrics are wrong: {metric_values[:4]}')
        await page.screenshot(path=str(SCREENSHOT_DIR / 'webapp-scan-after-folder-scan.png'), full_page=True)

        await page.click('#pinBaseline')
        await page.wait_for_function("() => document.getElementById('baselineSource').textContent.includes('Selected workspace folder')")
        await page.screenshot(path=str(SCREENSHOT_DIR / 'webapp-scan-after-baseline-pin.png'), full_page=True)

        async with page.expect_download() as report_json_info:
            await page.click('#exportReport')
        report_json = await report_json_info.value
        report_json_payload = json.loads(Path(await report_json.path()).read_text(encoding='utf-8'))
        if report_json_payload['summary']['deadRouteReferences'] != 0:
            raise AssertionError('Healthy exported report JSON is incorrect.')

        async with page.expect_download() as report_md_info:
            await page.click('#exportReportMarkdown')
        report_md = await report_md_info.value
        report_md_text = Path(await report_md.path()).read_text(encoding='utf-8')
        if '# Dead Route Detector Report' not in report_md_text or 'Dead route references: 0' not in report_md_text:
            raise AssertionError('Healthy exported report markdown is incorrect.')

        async with page.expect_download() as report_sarif_info:
            await page.click('#exportReportSarif')
        report_sarif = await report_sarif_info.value
        report_sarif_payload = json.loads(Path(await report_sarif.path()).read_text(encoding='utf-8'))
        if report_sarif_payload['runs'][0]['tool']['driver']['name'] != 'Dead Route Detector - SkyeVSX':
            raise AssertionError('Healthy exported SARIF is incorrect.')

        await page.locator('#baselineInput').set_input_files(await report_json.path())
        await page.wait_for_function("() => document.getElementById('baselineSource').textContent.includes('Imported baseline report')")

        await page.click('#runProofFixture')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('Included proof fixture scan')")
        metric_values = await page.locator('.metric strong').all_text_contents()
        if metric_values[:4] != ['4', '0', '2', '2']:
            raise AssertionError(f'Proof fixture metrics are wrong: {metric_values[:4]}')
        report_text = await page.locator('#reportHost').text_content()
        if '/ghost' not in report_text or 'href-placeholder' not in report_text or 'src/App.tsx' not in report_text:
            raise AssertionError('Proof fixture scan did not render the expected detailed findings.')
        await page.screenshot(path=str(SCREENSHOT_DIR / 'webapp-scan-after-proof-fixture.png'), full_page=True)

        await page.click('#compareBaseline')
        await page.wait_for_function("() => document.getElementById('diffStatus').textContent.includes('Regression diff ready')")
        diff_text = await page.locator('#diffHost').text_content()
        if 'Added issues' not in diff_text or '/ghost' not in diff_text:
            raise AssertionError('Webapp regression diff did not render expected added issues.')
        await page.screenshot(path=str(SCREENSHOT_DIR / 'webapp-scan-after-compare.png'), full_page=True)

        async with page.expect_download() as diff_json_info:
            await page.click('#exportDiffJson')
        diff_json = await diff_json_info.value
        diff_json_payload = json.loads(Path(await diff_json.path()).read_text(encoding='utf-8'))
        if diff_json_payload['addedIssueCount'] < 7:
            raise AssertionError('Exported webapp diff json payload is incorrect.')

        async with page.expect_download() as diff_md_info:
            await page.click('#exportDiffMarkdown')
        diff_md = await diff_md_info.value
        diff_markdown = Path(await diff_md.path()).read_text(encoding='utf-8')
        if 'Dead Route Detector Regression Diff' not in diff_markdown or '/ghost' not in diff_markdown:
            raise AssertionError('Exported webapp diff markdown is incorrect.')

        smoke_state = json.loads(await page.locator('#smokeState').text_content())
        return {
            'status': 'pass',
            'renderedRuntime': True,
            'buttonsVerified': [label for _, label in visible_controls],
            'stepsVerified': [
                'loadSampleReport',
                'setDirectory',
                'runWorkspaceScan',
                'pinBaseline',
                'exportReportJson',
                'exportReportMarkdown',
                'exportReportSarif',
                'importBaselineJson',
                'runProofFixture',
                'compareBaseline',
                'exportDiffJson',
                'exportDiffMarkdown'
            ],
            'downloadedFile': report_json.suggested_filename,
            'downloadSummary': smoke_state['summary'],
            'diffSummary': {
                'addedIssueCount': diff_json_payload['addedIssueCount'],
                'resolvedIssueCount': diff_json_payload['resolvedIssueCount']
            },
            'screenshots': [
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-initial.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-after-folder-scan.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-after-baseline-pin.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-after-proof-fixture.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-after-compare.png'
            ]
        }
    finally:
        await context.close()


async def run_github_smoke(browser, mock_routes: Dict[str, dict]):
    html = load_html('github', 'dead-route-detector-skyevsx', 'index.html')
    css = read_text('github', 'dead-route-detector-skyevsx', 'styles.css')
    scripts = [
        read_text('github', 'dead-route-detector-skyevsx', 'scanner-core.js'),
        read_text('github', 'dead-route-detector-skyevsx', 'report-tools.js'),
        read_text('github', 'dead-route-detector-skyevsx', 'app.js')
    ]
    context, page = await build_page(browser, html, css, scripts, mock_routes)
    try:
        for static_page in ['index.html', 'install.html']:
            await assert_static_page_contains(browser, load_html('github', 'dead-route-detector-skyevsx', static_page), css, 'Dead Route Detector - SkyeVSX')

        visible_controls = [
            ('#runProofFixture', 'Proof fixture button'),
            ('#loadSampleReport', 'Sample report button'),
            ('label[for="baselineInput"]', 'Baseline import label'),
            ('#pinBaseline', 'Pin baseline button'),
            ('#compareBaseline', 'Compare baseline button'),
            ('#exportReport', 'Export current report button'),
            ('#exportReportMarkdown', 'Export current markdown button'),
            ('#exportReportSarif', 'Export current sarif button'),
            ('#exportReviewComment', 'Export review comment button'),
            ('#exportDiffJson', 'Export diff json button'),
            ('#exportDiffMarkdown', 'Export diff markdown button'),
            ('#scanGithubTarget', 'Scan github target button'),
            ('#githubTarget', 'GitHub target field'),
            ('#githubRef', 'GitHub ref field'),
            ('#githubApiBase', 'GitHub API base field'),
            ('#githubToken', 'GitHub token field')
        ]
        for selector, label in visible_controls:
            await assert_visible_in_viewport(page, selector, label)

        for selector in ['#pinBaseline', '#compareBaseline', '#exportReport', '#exportReportMarkdown', '#exportReportSarif', '#exportReviewComment', '#exportDiffJson', '#exportDiffMarkdown']:
            await expect_button_state(page, selector, True)

        await page.click('#runProofFixture')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('Included proof fixture scan')")
        await page.click('#loadSampleReport')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('Included sample report')")

        await page.fill('#githubTarget', 'https://github.com/acme/route-lab/tree/main')
        await page.fill('#githubApiBase', 'https://api.github.test')
        await page.click('#scanGithubTarget')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('GitHub repository scan')")
        report_text = await page.locator('#reportHost').text_content()
        if 'No findings in this section.' not in report_text:
            raise AssertionError('GitHub repository scan did not render the healthy report.')
        await page.screenshot(path=str(SCREENSHOT_DIR / 'github-wrapper-repo-scan.png'), full_page=True)

        await page.click('#pinBaseline')
        await page.wait_for_function("() => document.getElementById('baselineSource').textContent.includes('GitHub repository scan')")
        await page.screenshot(path=str(SCREENSHOT_DIR / 'github-wrapper-repo-baseline.png'), full_page=True)

        async with page.expect_download() as repo_json_info:
            await page.click('#exportReport')
        repo_json = await repo_json_info.value
        repo_json_payload = json.loads(Path(await repo_json.path()).read_text(encoding='utf-8'))
        if repo_json_payload['summary']['deadRouteReferences'] != 0:
            raise AssertionError('GitHub repository report json is incorrect.')

        async with page.expect_download() as repo_md_info:
            await page.click('#exportReportMarkdown')
        repo_md = await repo_md_info.value
        repo_md_text = Path(await repo_md.path()).read_text(encoding='utf-8')
        if 'Dead route references: 0' not in repo_md_text:
            raise AssertionError('GitHub repository report markdown is incorrect.')

        async with page.expect_download() as repo_sarif_info:
            await page.click('#exportReportSarif')
        repo_sarif = await repo_sarif_info.value
        repo_sarif_payload = json.loads(Path(await repo_sarif.path()).read_text(encoding='utf-8'))
        if repo_sarif_payload['runs'][0]['tool']['driver']['name'] != 'Dead Route Detector - SkyeVSX':
            raise AssertionError('GitHub repository report SARIF is incorrect.')

        await page.locator('#baselineInput').set_input_files(await repo_json.path())
        await page.wait_for_function("() => document.getElementById('baselineSource').textContent.includes('Imported baseline report')")

        await page.fill('#githubTarget', 'https://github.com/acme/route-lab/pull/17')
        await page.click('#scanGithubTarget')
        await page.wait_for_function("() => document.getElementById('currentSource').textContent.includes('GitHub pull request scan')")
        pr_text = await page.locator('#reportHost').text_content()
        if '/ghost' not in pr_text:
            raise AssertionError('GitHub pull request scan did not render expected proof findings.')
        await page.screenshot(path=str(SCREENSHOT_DIR / 'github-wrapper-pr-scan.png'), full_page=True)

        await page.click('#compareBaseline')
        await page.wait_for_function("() => document.getElementById('diffStatus').textContent.includes('Regression diff ready')")
        await page.screenshot(path=str(SCREENSHOT_DIR / 'github-wrapper-pr-compare.png'), full_page=True)

        async with page.expect_download() as diff_json_info:
            await page.click('#exportDiffJson')
        diff_json = await diff_json_info.value
        diff_json_payload = json.loads(Path(await diff_json.path()).read_text(encoding='utf-8'))
        if diff_json_payload['addedIssueCount'] < 7:
            raise AssertionError('GitHub diff json export is incorrect.')

        async with page.expect_download() as diff_md_info:
            await page.click('#exportDiffMarkdown')
        diff_md = await diff_md_info.value
        diff_md_text = Path(await diff_md.path()).read_text(encoding='utf-8')
        if 'Regression Diff' not in diff_md_text and 'Regression diff' not in diff_md_text:
            raise AssertionError('GitHub diff markdown export is incorrect.')

        async with page.expect_download() as review_info:
            await page.click('#exportReviewComment')
        review_md = await review_info.value
        review_text = Path(await review_md.path()).read_text(encoding='utf-8')
        if 'acme/route-lab #17' not in review_text or '/ghost' not in review_text:
            raise AssertionError('GitHub review comment export is incorrect.')

        smoke_state = json.loads(await page.locator('#smokeState').text_content())
        return {
            'status': 'pass',
            'renderedRuntime': True,
            'buttonsVerified': [label for _, label in visible_controls],
            'stepsVerified': [
                'runProofFixture',
                'loadSampleReport',
                'scanGithubRepo',
                'pinBaseline',
                'exportReportJson',
                'exportReportMarkdown',
                'exportReportSarif',
                'importBaselineJson',
                'scanGithubPullRequest',
                'compareBaseline',
                'exportDiffJson',
                'exportDiffMarkdown',
                'exportReviewComment'
            ],
            'downloadedFile': review_md.suggested_filename,
            'downloadSummary': smoke_state['summary'],
            'diffSummary': {
                'addedIssueCount': diff_json_payload['addedIssueCount'],
                'resolvedIssueCount': diff_json_payload['resolvedIssueCount']
            },
            'screenshots': [
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/github-wrapper-repo-scan.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/github-wrapper-repo-baseline.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/github-wrapper-pr-scan.png',
                'PROJECT_DOCS/SMOKE_SCREENSHOTS/github-wrapper-pr-compare.png'
            ]
        }
    finally:
        await context.close()


async def main():
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
    mock_routes = build_mock_fetch_routes()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
        try:
            webapp = await run_webapp_smoke(browser, mock_routes)
            github = await run_github_smoke(browser, mock_routes)
        finally:
            await browser.close()

    result = {
        'engine': 'chromium-playwright-inline-runtime',
        'status': 'pass',
        'webapp': webapp,
        'github': github
    }
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
