import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ.get('SKYE_TEST_SERVER_PORT', '8787'))
ORIGIN = f'http://127.0.0.1:{PORT}'


def wait_for_health(url: str, timeout: float = 20.0) -> None:
    started = time.time()
    while time.time() - started < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError(f'Health check never passed for {url}')


def read_text_url(url: str, method: str = 'GET', headers: dict | None = None, body: str | None = None) -> tuple[int, dict, str]:
    request = urllib.request.Request(url, method=method.upper())
    for key, value in (headers or {}).items():
        request.add_header(str(key), str(value))
    if body is not None:
        data = body.encode('utf-8')
        request.data = data
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = response.read().decode('utf-8')
        return response.status, dict(response.headers.items()), payload


def wait_for_json_result(page, selector: str, path: str, timeout: float = 20.0):
    started = time.time()
    while time.time() - started < timeout:
        payload = page.eval_on_selector(selector, "el => el.textContent || ''")
        if payload.strip():
            try:
                parsed = json.loads(payload)
            except Exception:
                parsed = None
            if parsed is not None:
                current = parsed
                for part in path.split('.'):
                    if isinstance(current, dict):
                        current = current.get(part)
                    else:
                        current = None
                        break
                if current is not None:
                    return parsed, current
        time.sleep(0.15)
    raise RuntimeError(f'Timed out waiting for {selector} -> {path}')


def assert_control_within_viewport(page, selector: str, padding: int = 12) -> None:
    page.locator(selector).scroll_into_view_if_needed()
    box = page.locator(selector).bounding_box()
    if not box:
        raise AssertionError(f'Expected visible bounding box for {selector}')
    viewport = page.viewport_size or {'width': 1440, 'height': 2200}
    if box['x'] < 0 or box['y'] < 0:
        raise AssertionError(f'{selector} is outside the viewport origin.')
    if box['x'] + box['width'] > viewport['width'] - padding:
        raise AssertionError(f'{selector} extends beyond the right viewport margin.')
    if box['width'] <= 0 or box['height'] <= 0:
        raise AssertionError(f'{selector} is not rendered with clickable dimensions.')


def main() -> int:
    env = os.environ.copy()
    env['SKYE_TEST_SERVER_PORT'] = str(PORT)
    proc = subprocess.Popen(
        ['node', '--experimental-strip-types', 'scripts/helpers/run-test-server.mjs'],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
    )
    try:
        wait_for_health(f'{ORIGIN}/v1/health')
        _, _, app_html = read_text_url(f'{ORIGIN}/app')

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
            page = browser.new_page(viewport={'width': 1440, 'height': 2200})

            def py_fetch_bridge(url, init=None):
                init = init or {}
                target = url if str(url).startswith(('http://', 'https://')) else f'{ORIGIN}{url}'
                status, headers, body = read_text_url(
                    target,
                    method=init.get('method', 'GET'),
                    headers=init.get('headers') or {},
                    body=init.get('body'),
                )
                return {'status': status, 'headers': headers, 'body': body, 'url': target}

            page.expose_function('pyFetchBridge', py_fetch_bridge)
            page.set_content(app_html, wait_until='domcontentloaded')
            page.evaluate("""() => {
                const bridgeFetch = async (input, init = {}) => {
                    const url = typeof input === 'string' ? input : input.url;
                    const requestHeaders = {};
                    if (typeof Request !== 'undefined' && input instanceof Request) {
                        input.headers.forEach((value, key) => { requestHeaders[key] = value; });
                    }
                    new Headers(init.headers || {}).forEach((value, key) => { requestHeaders[key] = value; });
                    const method = init.method || ((typeof Request !== 'undefined' && input instanceof Request) ? input.method : 'GET');
                    const body = typeof init.body === 'string' ? init.body : (init.body == null ? null : String(init.body));
                    return window.pyFetchBridge(url, { method, headers: requestHeaders, body }).then((result) => new Response(result.body, { status: result.status, headers: result.headers }));
                };
                window.fetch = bridgeFetch;
                globalThis.fetch = bridgeFetch;
            }""")

            required_controls = ['load-purpose','load-walkthroughs','run-truth-validator','run-readiness','list-readiness-runs','load-claim-catalog','export-contract-pack','load-strategy-scorecard','load-release-gate','load-release-drift','export-release-pack','load-strategy-actions','export-strategy-pack','load-target-summary','list-target-probes','run-target-probe','export-target-pack','load-cutover-summary','list-cutover-runs','run-cutover','export-cutover-pack','load-rollback-summary','list-rollback-runs','run-rollback','export-rollback-pack','load-proof-matrix','load-walkthrough-run','load-report-summary','generate-report-site','export-report-site','create-workspace','create-project','run-audit','run-research','run-brief','run-draft','run-article-enrich','export-article-enrich','run-article-review','list-article-reviews','export-article-review','run-article-remediate','list-article-remediations','export-article-remediate','run-publish-payload','run-publish-execute','run-replay','export-bundle','import-bundle','clone-bundle']
            controls_present = page.evaluate(
                """(ids) => ids.every((id) => !!document.getElementById(id))""",
                required_controls
            )
            if not controls_present:
                raise AssertionError('Expected operator controls to exist in the real browser DOM.')

            for control_id in required_controls:
                assert_control_within_viewport(page, f'#{control_id}')

            visible_sections = page.eval_on_selector_all('section h2', 'nodes => nodes.map((node) => node.textContent || "")')
            if len(visible_sections) < 6:
                raise AssertionError('Expected visible operator sections in browser DOM.')

            page.fill('#org-id', 'browser_org_real')
            page.fill('#workspace-name', 'Browser Real Workspace')
            page.fill('#workspace-brand', 'Skye GEO Engine')
            page.fill('#workspace-niche', 'AI search growth')
            page.click('#create-workspace')
            workspace_payload, workspace = wait_for_json_result(page, '#workspace-result', 'workspace')

            page.fill('#project-name', 'Browser Real Project')
            page.fill('#project-url', f'{ORIGIN}/fixtures/source')
            page.fill('#project-audience', 'operators')
            page.click('#create-project')
            _, project = wait_for_json_result(page, '#project-result', 'project')

            page.fill('#audit-url', f'{ORIGIN}/fixtures/source')
            page.click('#run-audit')
            _, audit = wait_for_json_result(page, '#audit-result', 'auditRun')

            page.fill('#research-urls', f'{ORIGIN}/fixtures/source')
            page.fill('#research-texts', 'Real browser smoke validates the shipped operator surface.')
            page.click('#run-research')
            research_payload, _ = wait_for_json_result(page, '#research-result', 'inserted')
            source_ids = [item['id'] for item in (research_payload.get('inserted') or []) + (research_payload.get('deduped') or []) if item.get('id')]
            if not source_ids:
                raise AssertionError('Research flow returned zero source ids in real browser smoke.')

            page.fill('#brief-source-ids', ', '.join(source_ids))
            page.click('#run-brief')
            _, brief = wait_for_json_result(page, '#brief-result', 'brief')

            page.click('#run-draft')
            _, article = wait_for_json_result(page, '#brief-result', 'article')

            page.click('#run-article-enrich')
            _, enrichment_pack = wait_for_json_result(page, '#enrich-result', 'enrichmentPack')
            if len(enrichment_pack.get('internalLinks') or []) < 3:
                raise AssertionError('Expected article enrichment to generate multiple internal links.')

            page.click('#export-article-enrich')
            enrichment_export_payload, _ = wait_for_json_result(page, '#enrich-result', 'enrichmentPackHtml')
            if len(enrichment_export_payload.get('enrichmentPackHtml') or '') < 500:
                raise AssertionError('Expected article enrichment export html payload.')

            page.click('#run-article-review')
            _, article_review = wait_for_json_result(page, '#review-result', 'articleReview')
            if article_review.get('overallScore', 0) < 1:
                raise AssertionError('Expected article review to return a non-zero score.')
            if article_review.get('publishReadiness', {}).get('gate') not in {'ready', 'conditional', 'blocked'}:
                raise AssertionError('Expected article review publish gate to be explicit.')

            page.click('#export-article-review')
            review_export_payload, _ = wait_for_json_result(page, '#review-result', 'articleReviewHtml')
            if len(review_export_payload.get('articleReviewHtml') or '') < 500:
                raise AssertionError('Expected article review export html payload.')

            page.click('#run-article-remediate')
            _, article_remediation = wait_for_json_result(page, '#remediate-result', 'articleRemediation')
            if article_remediation.get('predictedReview', {}).get('overallScore', 0) < article_review.get('overallScore', 0):
                raise AssertionError('Expected remediation candidate to improve or preserve the review score.')
            if article_remediation.get('predictedReview', {}).get('publishReadiness', {}).get('gate') not in {'ready', 'conditional', 'blocked'}:
                raise AssertionError('Expected remediation candidate to return an explicit publish gate.')

            page.click('#export-article-remediate')
            remediation_export_payload, _ = wait_for_json_result(page, '#remediate-result', 'articleRemediationHtml')
            if len(remediation_export_payload.get('articleRemediationHtml') or '') < 500:
                raise AssertionError('Expected article remediation export html payload.')

            page.select_option('#publish-platform', 'generic-api')
            page.fill('#publish-target-url', f'{ORIGIN}/publisher.local/content/publish')
            page.click('#run-publish-payload')
            _, publish_prepared = wait_for_json_result(page, '#publish-result', 'publishRun')
            if publish_prepared.get('status') != 'prepared':
                raise AssertionError('Expected prepared publish state before execute.')

            page.click('#run-publish-execute')
            publish_payload, publish_run = wait_for_json_result(page, '#publish-result', 'publishRun')
            if publish_run.get('status') != 'success':
                raise AssertionError('Expected success publish state after execute.')

            page.fill('#bundle-workspace-name', 'Browser Real Import Workspace')
            page.click('#export-bundle')
            bundle_payload, bundle = wait_for_json_result(page, '#bundle-result', 'bundle')
            if not bundle.get('history', {}).get('workspace', {}).get('id'):
                raise AssertionError('Bundle export missing history workspace id in real browser smoke.')

            page.click('#import-bundle')
            imported_payload, imported_workspace = wait_for_json_result(page, '#bundle-result', 'workspace')
            if imported_workspace.get('id') == workspace.get('id'):
                raise AssertionError('Import did not create a new workspace id.')

            page.click('#clone-bundle')
            clone_started = time.time()
            cloned_workspace = None
            while time.time() - clone_started < 20:
                payload_text = page.eval_on_selector('#bundle-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    item = parsed.get('workspace')
                    if item and item.get('id') not in {workspace.get('id'), imported_workspace.get('id')}:
                        cloned_workspace = item
                        break
                time.sleep(0.15)
            if not cloned_workspace:
                raise AssertionError('Clone did not create a third workspace id.')

            page.click('#load-purpose')
            purpose_payload, purpose = wait_for_json_result(page, '#truth-result', 'purpose')

            page.click('#load-walkthroughs')
            walkthrough_payload, walkthroughs = wait_for_json_result(page, '#truth-result', 'walkthroughs')

            page.select_option('#provider-contract-platform', 'generic-api')
            page.fill('#provider-contract-target', f'{ORIGIN}/publisher.local/content/publish')
            page.click('#load-runtime-contracts')
            _, runtime_contracts = wait_for_json_result(page, '#truth-result', 'runtime')
            if (runtime_contracts.get('summary') or {}).get('blockedControls', 1) != 0:
                raise AssertionError('Expected zero blocked controls in runtime contracts.')

            page.click('#validate-provider-contract')
            _, provider_contract = wait_for_json_result(page, '#truth-result', 'validation')
            if provider_contract.get('executionTruth') not in {'local-proof-only', 'remote-target-ready', 'remote-proof-observed'}:
                raise AssertionError('Expected provider contract truth to reflect a proveable target.')

            page.click('#run-truth-validator')
            truth_payload, truth_validation = wait_for_json_result(page, '#truth-result', 'validation')
            if truth_validation.get('issues'):
                raise AssertionError(f"Expected no truth issues, got {truth_validation.get('issues')}")

            page.click('#run-readiness')
            _, readiness_run = wait_for_json_result(page, '#readiness-result', 'readinessRun')
            if (readiness_run.get('summary') or {}).get('modules', 0) < 1:
                raise AssertionError('Expected readiness run to include modules.')

            readiness_started = time.time()
            page.click('#list-readiness-runs')
            readiness_items = None
            while time.time() - readiness_started < 20:
                payload_text = page.eval_on_selector('#readiness-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('items')
                    if isinstance(items, list) and items and items[0].get('exportType') == 'readiness_run':
                        readiness_items = items
                        break
                time.sleep(0.15)
            if not readiness_items:
                raise AssertionError('Expected persisted readiness runs.')

            page.click('#load-claim-catalog')
            claim_started = time.time()
            claim_items = None
            while time.time() - claim_started < 20:
                payload_text = page.eval_on_selector('#readiness-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('items')
                    if isinstance(items, list) and items and items[0].get('moduleId'):
                        claim_items = items
                        break
                time.sleep(0.15)
            if not claim_items:
                raise AssertionError('Expected claim catalog items.')

            page.click('#load-claim-evidence')
            _, claim_evidence = wait_for_json_result(page, '#readiness-result', 'summary')
            if claim_evidence.get('claims', 0) < 1:
                raise AssertionError('Expected claim evidence graph summary to include claims.')

            page.click('#export-contract-pack')
            contract_payload, contract_pack = wait_for_json_result(page, '#readiness-result', 'contractPack')
            if len(contract_pack.get('claimCatalog') or []) < 1:
                raise AssertionError('Expected contract pack claim catalog entries.')

            page.click('#load-strategy-scorecard')
            _, strategy_scorecard = wait_for_json_result(page, '#strategy-result', 'scorecard')
            if (strategy_scorecard.get('summary') or {}).get('overallScore', 0) < 1:
                raise AssertionError('Expected strategy scorecard overall score.')

            page.click('#load-strategy-actions')
            strategy_started = time.time()
            strategy_actions = None
            while time.time() - strategy_started < 20:
                payload_text = page.eval_on_selector('#strategy-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('actions')
                    if isinstance(items, list) and items:
                        strategy_actions = items
                        break
                time.sleep(0.15)
            if not strategy_actions:
                raise AssertionError('Expected strategy action items.')

            page.click('#export-strategy-pack')
            strategy_export_payload, strategy_pack = wait_for_json_result(page, '#strategy-result', 'strategyPack')
            if len(strategy_pack.get('actions') or []) < 1:
                raise AssertionError('Expected strategy pack actions.')

            page.click('#load-release-gate')
            _, release_gate = wait_for_json_result(page, '#release-result', 'gate')
            if release_gate.get('verdict') not in {'conditional', 'blocked', 'ship-ready'}:
                raise AssertionError('Expected release gate verdict.')

            page.click('#load-release-drift')
            _, release_drift = wait_for_json_result(page, '#release-result', 'drift')
            if (release_drift.get('summary') or {}).get('total', 0) < 1:
                raise AssertionError('Expected release drift items.')

            page.click('#load-target-summary')
            _, target_summary = wait_for_json_result(page, '#targets-result', 'summary')
            if (target_summary.get('summary') or {}).get('probes', 0) < 0:
                raise AssertionError('Expected target summary payload.')

            page.click('#run-target-probe')
            _, target_probe = wait_for_json_result(page, '#targets-result', 'targetProbe')
            if target_probe.get('status') not in {'reachable', 'blocked', 'unreachable'}:
                raise AssertionError('Expected target probe status.')

            page.click('#list-target-probes')
            target_started = time.time()
            target_items = None
            while time.time() - target_started < 20:
                payload_text = page.eval_on_selector('#targets-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('items')
                    if isinstance(items, list) and items:
                        target_items = items
                        break
                time.sleep(0.15)
            if not target_items:
                raise AssertionError('Expected target probe history.')

            page.click('#export-target-pack')
            _, target_pack = wait_for_json_result(page, '#targets-result', 'targetPack')
            if (target_pack.get('summary') or {}).get('summary', {}).get('probes', 0) < 1:
                raise AssertionError('Expected target pack to include stored probes.')

            page.click('#load-cutover-summary')
            _, cutover_summary = wait_for_json_result(page, '#cutover-result', 'summary')
            if cutover_summary.get('latestVerdict') not in {'ready', 'conditional', 'blocked', 'none'}:
                raise AssertionError('Expected cutover summary verdict.')

            page.click('#run-cutover')
            _, cutover_run = wait_for_json_result(page, '#cutover-result', 'cutoverRun')
            if cutover_run.get('verdict') not in {'ready', 'conditional', 'blocked'}:
                raise AssertionError('Expected cutover run verdict.')

            page.click('#list-cutover-runs')
            cutover_started = time.time()
            cutover_items = None
            while time.time() - cutover_started < 20:
                payload_text = page.eval_on_selector('#cutover-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('items')
                    if isinstance(items, list) and items:
                        cutover_items = items
                        break
                time.sleep(0.15)
            if not cutover_items:
                raise AssertionError('Expected cutover run history.')

            page.click('#export-cutover-pack')
            _, cutover_pack = wait_for_json_result(page, '#cutover-result', 'cutoverPack')
            if cutover_pack.get('run', {}).get('verdict') not in {'ready', 'conditional', 'blocked'}:
                raise AssertionError('Expected cutover pack verdict.')

            page.click('#load-rollback-summary')
            _, rollback_summary = wait_for_json_result(page, '#rollback-result', 'summary')
            if rollback_summary.get('runs', 0) < 0:
                raise AssertionError('Expected rollback summary payload.')

            page.click('#run-rollback')
            _, rollback_run = wait_for_json_result(page, '#rollback-result', 'rollbackRun')
            if rollback_run.get('verdict') not in {'recoverable', 'conditional', 'blocked'}:
                raise AssertionError('Expected rollback run verdict.')

            page.click('#list-rollback-runs')
            rollback_started = time.time()
            rollback_items = None
            while time.time() - rollback_started < 20:
                payload_text = page.eval_on_selector('#rollback-result', 'el => el.textContent || ""')
                if payload_text.strip():
                    parsed = json.loads(payload_text)
                    items = parsed.get('items')
                    if isinstance(items, list) and items:
                        rollback_items = items
                        break
                time.sleep(0.15)
            if not rollback_items:
                raise AssertionError('Expected rollback run history.')

            page.click('#export-rollback-pack')
            _, rollback_pack = wait_for_json_result(page, '#rollback-result', 'rollbackPack')
            if rollback_pack.get('run', {}).get('verdict') not in {'recoverable', 'conditional', 'blocked'}:
                raise AssertionError('Expected rollback pack verdict.')

            page.click('#export-release-pack')
            release_export_payload, release_pack = wait_for_json_result(page, '#release-result', 'releasePack')
            if not release_export_payload.get('exportRecord', {}).get('id'):
                raise AssertionError('Expected release pack export record.')

            page.click('#load-proof-matrix')
            _, proof_matrix = wait_for_json_result(page, '#report-result', 'matrix')
            if (proof_matrix.get('summary') or {}).get('modules', 0) < 1:
                raise AssertionError('Expected proof matrix to include modules.')

            page.click('#load-walkthrough-run')
            _, walkthrough_run = wait_for_json_result(page, '#report-result', 'walkthroughRun')
            if (walkthrough_run.get('summary') or {}).get('modules', 0) < 1:
                raise AssertionError('Expected walkthrough run to include modules.')

            page.select_option('#report-audience', 'investor')
            page.click('#load-report-summary')
            _, report_summary = wait_for_json_result(page, '#report-result', 'report')
            if report_summary.get('audience') != 'investor':
                raise AssertionError('Expected investor report summary in real browser smoke.')

            page.click('#generate-report-site')
            site_payload, site_report = wait_for_json_result(page, '#report-result', 'report')
            if len(site_payload.get('html') or '') < 500:
                raise AssertionError('Expected generated report site html payload.')

            page.click('#export-report-site')
            _, report_export = wait_for_json_result(page, '#report-result', 'exportRecord')
            if not report_export.get('id'):
                raise AssertionError('Expected stored report export record.')

            page.click('#generate-proof-site')
            proof_payload, proof_site = wait_for_json_result(page, '#report-result', 'proofSite')
            if ((proof_site.get('claimEvidence') or {}).get('summary') or {}).get('claims', 0) < 1:
                raise AssertionError('Expected proof site claim evidence summary.')

            page.click('#run-history')
            _, history = wait_for_json_result(page, '#history-result', 'history')

            browser.close()

        summary = {
            'workspaceId': workspace.get('id'),
            'projectId': project.get('id'),
            'auditRunId': audit.get('id'),
            'briefId': brief.get('id'),
            'articleId': article.get('id'),
            'enrichmentLinks': len(enrichment_pack.get('internalLinks') or []),
            'enrichmentHtmlLength': len(enrichment_export_payload.get('enrichmentPackHtml') or ''),
            'articleReviewScore': article_review.get('overallScore', 0),
            'articleReviewGate': (article_review.get('publishReadiness') or {}).get('gate'),
            'articleReviewHtmlLength': len(review_export_payload.get('articleReviewHtml') or ''),
            'publishRunId': publish_run.get('id'),
            'publishStatus': publish_run.get('status'),
            'importedWorkspaceId': imported_workspace.get('id'),
            'clonedWorkspaceId': cloned_workspace.get('id'),
            'historyProjects': len(history.get('projects') or []),
            'historyPublishRuns': len(history.get('publishRuns') or []),
            'purposeModules': purpose.get('moduleCount'),
            'walkthroughModules': len(walkthroughs or []),
            'truthIssues': len(truth_validation.get('issues') or []),
            'runtimeBlockedControls': (runtime_contracts.get('summary') or {}).get('blockedControls'),
            'providerContractTruth': provider_contract.get('executionTruth'),
            'readinessModules': (readiness_run.get('summary') or {}).get('modules'),
            'readinessExports': len(readiness_items or []),
            'claimCatalogClaims': len(claim_items or []),
            'claimEvidenceClaims': claim_evidence.get('claims'),
            'contractPackClaims': len(contract_pack.get('claimCatalog') or []),
            'strategyScorecardModules': len(strategy_scorecard.get('modules') or []),
            'strategyActions': len(strategy_actions or []),
            'strategyPackActions': len(strategy_pack.get('actions') or []),
            'rollbackSummaryRuns': rollback_summary.get('runs', 0),
            'rollbackRunVerdict': rollback_run.get('verdict'),
            'rollbackItems': len(rollback_items),
            'rollbackPackVerdict': (rollback_pack.get('run') or {}).get('verdict'),
            'releaseGateVerdict': release_gate.get('verdict'),
            'releaseDriftItems': (release_drift.get('summary') or {}).get('total'),
            'releasePackVerdict': (release_pack.get('gate') or {}).get('verdict'),
            'releasePackExportId': release_export_payload.get('exportRecord', {}).get('id'),
            'proofMatrixModules': (proof_matrix.get('summary') or {}).get('modules'),
            'walkthroughRunModules': (walkthrough_run.get('summary') or {}).get('modules'),
            'reportAudience': report_summary.get('audience'),
            'reportExportId': report_export.get('id'),
            'reportSiteLength': len(site_payload.get('html') or ''),
            'proofSiteLength': len(proof_payload.get('html') or ''),
        }
        print(json.dumps({
            'ok': True,
            'smoke': 'real-browser-ui',
            'controlsPresent': controls_present,
            'visibleSections': visible_sections,
            'summary': summary,
        }, indent=2))
        return 0
    finally:
        try:
            proc.send_signal(signal.SIGTERM)
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        stderr = ''
        if proc.stderr:
            try:
                stderr = proc.stderr.read()
            except Exception:
                stderr = ''
        if proc.returncode not in (0, -15) and stderr.strip():
            print(stderr, file=sys.stderr)


if __name__ == '__main__':
    raise SystemExit(main())
