import re
import glob

files = glob.glob('src/assets/corporate/*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        html = f.read()

    new_img = '''<img id="wc-footer-logo" alt="World Cart Us" style="max-height: 60px; margin-bottom: 20px;">
<script>document.getElementById('wc-footer-logo').src = window.location.origin + '/assets/images/world-card-logo.png';</script>'''
    
    html = re.sub(
        r'<img src="/assets/images/world-card-logo\.png"[^>]*>',
        new_img,
        html,
        flags=re.IGNORECASE
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Fixed footer logo in {file}')
