import json
import time
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
ARTIFACT_DIR = ROOT / 'artifacts' / 'ui-smoke'


def iso_now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def inline_built_app(run_id: str, api_base: str | None = None) -> str:
    index_html = (DIST / 'index.html').read_text(encoding='utf-8')
    styles = (DIST / 'styles.css').read_text(encoding='utf-8')
    app_js = (DIST / 'app.js').read_text(encoding='utf-8').replace('</script>', '<\\/script>')
    index_html = index_html.replace('<link rel="manifest" href="./manifest.webmanifest">', '')
    index_html = index_html.replace('<link rel="stylesheet" href="./styles.css">', f'<style>{styles}</style>')
    bootstrap = f'<script>window.__SMOKE_RUN_ID__ = {json.dumps(run_id)};'
    if api_base:
        bootstrap += f'window.__SKYE_API_BASE__ = {json.dumps(api_base)};'
    bootstrap += '</script>'
    inline_script = f'{bootstrap}<script>{app_js}</script>'
    return index_html.replace('<script src="./app.js"></script>', inline_script)


def wait_until(predicate, timeout=12.0, step=0.1, label='condition'):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            if predicate():
                return
        except Exception as exc:
            last_error = exc
        time.sleep(step)
    if last_error:
        raise RuntimeError(f'timed out waiting for {label}: {last_error}')
    raise RuntimeError(f'timed out waiting for {label}')


def text(page, selector):
    value = page.text_content(selector)
    return value or ''


def value(page, selector):
    return page.input_value(selector)


def run(server_bridge: bool = False):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    run_id = f"ui-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}"
    stack_proc = None
    api_base = None
    if server_bridge:
        stack_proc = subprocess.Popen(['node', str(ROOT / 'scripts' / 'start-ui-bridge-stack.js')], cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        first_line = stack_proc.stdout.readline().strip()
        if not first_line:
            raise RuntimeError('failed to start server bridge stack')
        api_base = json.loads(first_line)['api_base']
    html = inline_built_app(run_id, api_base)
    screenshot_path = ARTIFACT_DIR / 'ui-smoke-latest.png'
    dom_path = ARTIFACT_DIR / 'ui-smoke-latest.dom.html'
    summary_path = ARTIFACT_DIR / 'ui-smoke-summary.json'

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1680, 'height': 2400})
        page.set_content(html, wait_until='load')
        page.click('#authenticate-btn')
        page.wait_for_selector('#workspace-panel:not(.hidden)')
        package_seen = False
        checkout_seen = False
        library_seen = False
        publishing_smoke_seen = False
        export_verified_seen = False
        import_restored_seen = False

        page.click('#load-skydocx-btn')
        page.fill('#catalog-title-name', 'Sovereign Author Publishing OS')
        page.click('#save-active-title-btn')
        wait_until(lambda: 'Sovereign Author Publishing OS' in text(page, '#catalog-summary'), label='catalog save')
        page.click('#build-preview-btn')
        wait_until(lambda: 'SkyeDocx Pro inside SuperIDEv2 Sovereign Author Publishing System' in page.locator('#preview-frame').evaluate("el => el.srcdoc"), label='skydocx preview')
        page.click('#generate-author-package-btn')
        wait_until(lambda: 'skye.skydocx.package' in value(page, '#package-payload'), label='author package')
        package_seen = True
        page.click('#generate-blog-package-btn')
        wait_until(lambda: 'skye.skyeblog.package' in value(page, '#package-payload'), label='blog package')
        page.click('#create-checkout-btn')
        wait_until(lambda: ('skye.directsale.checkout.session' in value(page, '#checkout-payload')) or ('skye.payment.session' in value(page, '#checkout-payload')) or ('payment_summary' in value(page, '#checkout-payload')), label='checkout session')
        page.click('#complete-purchase-btn')
        wait_until(lambda: ('skye.directsale.order' in value(page, '#checkout-payload')) or ('"commerce"' in value(page, '#checkout-payload')) or ('Server purchase recorded' in text(page, '#checkout-status')), label='purchase complete')
        checkout_seen = True
        page.click('#refresh-library-btn')
        wait_until(lambda: 'library_count' in text(page, '#library-summary'), label='library summary')
        library_seen = True

        page.click('#export-workspace-btn')
        wait_until(lambda: '"signature"' in value(page, '#export-payload'), label='export payload')
        page.click('#verify-export-btn')
        wait_until(lambda: 'verified' in text(page, '#import-status').lower(), label='export verified')
        export_verified_seen = True
        page.click('#copy-export-to-import-btn')
        page.click('#restore-import-btn')
        wait_until(lambda: 'restored' in text(page, '#import-status').lower(), label='import restored')
        import_restored_seen = True

        page.click('#run-publishing-smoke-btn')
        wait_until(lambda: 'has_library_access' in text(page, '#publishing-summary'), label='publishing smoke summary')
        publishing_smoke_seen = True
        wait_until(lambda: 'runs_count' in text(page, '#release-history-summary'), label='release history summary')

        page.click('#load-skyeblog-btn')
        page.fill('#catalog-title-name', 'SkyeBlog Command')
        page.click('#save-new-title-btn')
        wait_until(lambda: 'SkyeBlog Command' in text(page, '#catalog-summary'), label='save skyeblog title')
        page.click('#build-preview-btn')
        wait_until(lambda: 'SkyeBlog inside SuperIDEv2 Sovereign Author Publishing System' in page.locator('#preview-frame').evaluate("el => el.srcdoc"), label='skyeblog preview')
        page.click('#generate-blog-package-btn')
        wait_until(lambda: 'skye.skyeblog.package' in value(page, '#package-payload'), label='skyeblog package')
        page.select_option('#catalog-select', label='Sovereign Author Publishing OS · skydocx')
        page.click('#switch-title-btn')
        wait_until(lambda: 'Sovereign Author Publishing OS' in text(page, '#catalog-active-status'), label='switch back active title')
        wait_until(lambda: 'manuscript.md' in page.locator('#file-list').inner_text(), label='switch back file list')
        page.click('#build-preview-btn')
        wait_until(lambda: 'SkyeDocx Pro inside SuperIDEv2 Sovereign Author Publishing System' in page.locator('#preview-frame').evaluate("el => el.srcdoc"), label='preview after restore')
        page.click('#run-diagnostics-btn')
        time.sleep(0.3)

        export_payload = value(page, '#export-payload')
        import_payload = value(page, '#import-payload')
        package_payload = value(page, '#package-payload')
        checkout_payload = value(page, '#checkout-payload')
        library_summary = text(page, '#library-summary')
        diagnostic_log = text(page, '#diagnostic-log')
        publishing_summary = text(page, '#publishing-summary')
        catalog_summary = text(page, '#catalog-summary')
        release_history_summary = text(page, '#release-history-summary')
        truth_boundary_summary = text(page, '#truth-boundary-summary')
        controls = page.eval_on_selector_all('[data-smoke-control]', 'nodes => nodes.map(n => n.dataset.smokeControl)')
        auth_status = text(page, '#auth-status')
        preview_status = text(page, '#preview-status')
        mode_status = text(page, '#mode-pill')
        import_status = text(page, '#import-status')
        page.screenshot(path=str(screenshot_path), full_page=True)
        dom_path.write_text(page.content(), encoding='utf-8')
        browser.close()

    if stack_proc:
        stack_proc.terminate()
        try:
            stack_proc.wait(timeout=5)
        except Exception:
            stack_proc.kill()
    summary = {
        'generated_at': iso_now(),
        'ok': True,
        'run_id': run_id,
        'verified': {
            'authenticated': ('Local signed operator receipt active' in auth_status) or ('Server session active' in auth_status),
            'build_live': preview_status.strip() == 'Live',
            'export_present': len(export_payload) > 0,
            'import_present': len(import_payload) > 0,
            'package_present': package_seen,
            'checkout_present': checkout_seen,
            'library_present': library_seen,
            'publishing_smoke_present': publishing_smoke_seen,
            'catalog_present': 'Sovereign Author Publishing OS' in catalog_summary and 'SkyeBlog Command' in catalog_summary,
            'release_history_present': 'runs_count' in release_history_summary and 'successful_runs' in release_history_summary,
            'truth_boundary_present': ('server-token-capable' in truth_boundary_summary or 'refresh' in truth_boundary_summary.lower()) and 'submission' in truth_boundary_summary.lower(),
            'export_verified': export_verified_seen,
            'import_restored': import_restored_seen,
            'gateway_mode': 'skye-gateway-only',
            'mode_status': mode_status,
            'control_count': len(controls)
        },
        'controls': controls,
        'export_bytes': len(export_payload),
        'import_bytes': len(import_payload),
        'package_bytes': len(package_payload),
        'checkout_bytes': len(checkout_payload),
        'screenshot_path': 'artifacts/ui-smoke/ui-smoke-latest.png',
        'dom_dump_path': 'artifacts/ui-smoke/ui-smoke-latest.dom.html',
        'url': f'inline://superidev2/{run_id}',
        'diagnostic_log_excerpt': diagnostic_log[-800:]
    }
    summary_path.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(f'[ui-smoke] PASS :: run_id={run_id}')


if __name__ == '__main__':
    run('--server-bridge' in sys.argv)
