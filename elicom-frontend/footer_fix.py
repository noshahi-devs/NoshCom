import re
import glob

files = glob.glob('src/assets/corporate/*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        html = f.read()

    # 1. Fix footer logo (replace the whole footer__logo anchor block)
    html = re.sub(
        r'<a[^>]*class="footer__logo"[^>]*>.*?</a>',
        r'<a class="footer__logo"><img src="/assets/images/world-card-logo.png" alt="World Cart Us" style="max-height: 60px; margin-bottom: 20px;"></a>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )

    # 2. Fix copyright
    html = re.sub(
        r'&copy;\s*\d{4}.*?WORLD CART US',
        r'©2015-2030 World Cart Us All Rights Reserved',
        html,
        flags=re.IGNORECASE
    )
    # Also catch other variations if any
    html = re.sub(
        r'©\s*\d{4}.*?WORLD CART US',
        r'©2015-2030 World Cart Us All Rights Reserved',
        html,
        flags=re.IGNORECASE
    )

    # 3. Fix Careers URL so the interceptor catches it
    html = re.sub(
        r'data-href="https://careers\.shein\.com/?([^"]*)"',
        r'data-href="https://www.sheingroup.com/careers/"',
        html,
        flags=re.IGNORECASE
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Applied footer & careers fix to {file}')
