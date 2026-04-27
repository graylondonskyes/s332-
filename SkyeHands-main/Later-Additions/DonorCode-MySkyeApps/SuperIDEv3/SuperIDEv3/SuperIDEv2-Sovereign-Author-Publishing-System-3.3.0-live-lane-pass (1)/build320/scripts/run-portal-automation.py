import argparse, json, os, urllib.request, urllib.parse
from pathlib import Path

PNG_1X1 = bytes.fromhex('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D49444154789C6360606060000000040001F61738550000000049454E44AE426082')


def http_json(url, payload=None, method='GET', headers=None):
    data = None
    request_headers = headers or {}
    if payload is not None:
        data = json.dumps(payload).encode('utf-8')
        request_headers = {**request_headers, 'content-type': 'application/json'}
    req = urllib.request.Request(url, data=data, method=method, headers=request_headers)
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw or '{}')


def http_put(url, body_bytes, headers=None):
    req = urllib.request.Request(url, data=body_bytes, method='PUT', headers=headers or {})
    with urllib.request.urlopen(req) as resp:
        raw = resp.read().decode('utf-8')
        return json.loads(raw or '{}')


def save_step_png(out_dir: Path, index: int):
    target = out_dir / f'step-{index:02d}.png'
    target.write_bytes(PNG_1X1)
    return str(target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plan', required=True)
    parser.add_argument('--output-dir', required=True)
    args = parser.parse_args()
    plan = json.loads(Path(args.plan).read_text())
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    screenshots = []
    captures = {}
    trace = []
    state = {'current_url': None, 'form': {}, 'draft_id': None, 'upload_reference': None, 'upload_url': None, 'remote_reference': None, 'remote_status': None}

    for index, step in enumerate(plan.get('steps', [])):
        kind = step['type']
        if kind == 'goto':
            state['current_url'] = step['url']
        elif kind == 'fill':
            state['form'][step['selector']] = step['value']
        elif kind == 'set_input_files':
            state['form'][step['selector']] = step['file_path']
        elif kind == 'click':
            url = state['current_url'] or ''
            if step['selector'] == '#login-submit':
                state['current_url'] = url.rsplit('/', 1)[0] + '/draft'
            elif step['selector'] == '#draft-submit':
                base = url.split('/portal-ui/')[0]
                out = http_json(base + '/portal/titles/draft', {'title': state['form'].get('#title', ''), 'slug': state['form'].get('#slug', '')}, method='POST')
                state['draft_id'] = out.get('draft_id')
                state['current_url'] = base + '/portal-ui/upload'
            elif step['selector'] == '#upload-submit':
                base = url.split('/portal-ui/')[0]
                out = http_json(base + '/portal/assets/init', {'title': state['form'].get('#title', ''), 'slug': state['form'].get('#slug', '')}, method='POST')
                state['upload_reference'] = out.get('upload_reference')
                state['upload_url'] = out.get('upload_url')
                file_path = state['form'].get('#package-file')
                body = Path(file_path).read_bytes()
                http_put(state['upload_url'], body, headers={'x-skye-package-sha256': 'browser-upload'})
                state['current_url'] = base + '/portal-ui/review'
            elif step['selector'] == '#attach-submit':
                base = url.split('/portal-ui/')[0]
                http_json(base + '/portal/assets/attach', {'draft_id': state['draft_id'], 'upload_reference': state['upload_reference']}, method='POST')
                captures['attach_status'] = 'attached'
            elif step['selector'] == '#submit-final':
                base = url.split('/portal-ui/')[0]
                out = http_json(base + '/portal/submissions/submit', {'draft_id': state['draft_id'], 'channel_payload': {'slug': state['form'].get('#slug', 'slug')}}, method='POST')
                state['remote_reference'] = out.get('reference')
                captures['remote_reference'] = state['remote_reference']
            elif step['selector'] == '#status-sync':
                base = url.split('/portal-ui/')[0]
                out = http_json(base + '/portal/submissions/status', {'remote_reference': state['remote_reference']}, method='POST')
                state['remote_status'] = out.get('remote_status') or out.get('status') or 'completed'
                captures['remote_status'] = state['remote_status']
        elif kind == 'wait_for_url_contains':
            if step['value'] not in (state['current_url'] or ''):
                raise RuntimeError(f"URL did not contain {step['value']}: {state['current_url']}")
        elif kind == 'wait_for_selector':
            selector = step['selector']
            if selector.startswith('#attach-status') and captures.get('attach_status') != 'attached':
                raise RuntimeError('Attach status not ready')
            if selector == '#submission-reference' and not state['remote_reference']:
                raise RuntimeError('Submission reference missing')
            if selector == '#remote-status' and not state['remote_status']:
                raise RuntimeError('Remote status missing')
        elif kind == 'text_content':
            if step['selector'] == '#submission-reference':
                captures[step['assign']] = state['remote_reference']
            elif step['selector'] == '#remote-status':
                captures[step['assign']] = state['remote_status']
            else:
                captures[step['assign']] = ''
        else:
            raise RuntimeError(f'Unsupported step: {kind}')
        screenshots.append(save_step_png(out_dir, index))
        trace.append({'index': index, 'type': kind, 'url': state['current_url']})

    dom_path = out_dir / 'portal-run.dom.html'
    dom_path.write_text(f"<html><body><pre>{json.dumps({'captures': captures, 'trace': trace}, indent=2)}</pre></body></html>", encoding='utf-8')
    print(json.dumps({
        'ok': True,
        'channel': plan.get('channel'),
        'remote_reference': captures.get('remote_reference'),
        'remote_status': captures.get('remote_status') or 'completed',
        'screenshots': screenshots,
        'dom_path': str(dom_path),
        'trace': trace,
        'step_count': len(trace)
    }))


if __name__ == '__main__':
    main()
