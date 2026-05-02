from playwright.sync_api import sync_playwright
import time
import os

OUTPUT_DIR = os.path.join(os.getcwd(), 'pages_output')
os.makedirs(OUTPUT_DIR, exist_ok=True)

console_logs = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    def on_console(msg):
        text = f"[{msg.type}] {msg.text}"
        console_logs.append(text)
        print(text)

    page.on('console', on_console)

    url = 'http://localhost:5000/Pages/PageHub.html'
    print('Navigating to', url)
    page.goto(url, wait_until='networkidle')

    # Give inline scripts a moment to initialize
    time.sleep(0.5)

    # If refresh button exists, click it
    try:
        if page.query_selector('#refreshPagesBtn'):
            print('Found #refreshPagesBtn — clicking')
            page.click('#refreshPagesBtn')
            # wait for potential reload actions
            time.sleep(1)
        else:
            print('No #refreshPagesBtn found — running DOMContentLoaded handlers may have already run')
    except Exception as e:
        print('Error clicking refresh button:', e)

    # Wait a moment for any console output
    time.sleep(0.5)

    rendered = page.content()
    out_html = os.path.join(OUTPUT_DIR, 'PageHub_rendered.html')
    with open(out_html, 'w', encoding='utf-8') as f:
        f.write(rendered)
    print('Saved rendered DOM to', out_html)

    out_log = os.path.join(OUTPUT_DIR, 'PageHub_console.log')
    with open(out_log, 'w', encoding='utf-8') as f:
        f.write('\n'.join(console_logs))
    print('Saved console logs to', out_log)

    browser.close()
print('Done')
