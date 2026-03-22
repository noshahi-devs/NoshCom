import re

# Read the fully scrubbed and fixed HTML page
with open('src/assets/corporate/our-impact.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract everything between <body> and </body>
body_match = re.search(r'<body[^>]*>(.*)</body>', html, re.IGNORECASE | re.DOTALL)

if body_match:
    body_html = body_match.group(1)
    
    # We should remove the injected JS interceptor if it exists
    body_html = re.sub(r'<script>\s*// Intercept clicks.*?window\.parent\.postMessage.*?</script>', '', body_html, flags=re.IGNORECASE | re.DOTALL)
    
    # Custom header logo (header-worldcart-logo.png)
    # Finding the header logo wrapper
    body_html = re.sub(
        r'<a class="js-header-logo[^>]*>.*?</a>',
        r'<a class="js-header-logo header__logo header__logo--always-show"><img src="/assets/images/header-worldcart-logo.png" alt="World Cart Us" style="max-height:40px;"></a>',
        body_html,
        flags=re.IGNORECASE | re.DOTALL
    )

    with open('src/app/pages/corporate/our-impact/our-impact.component.html', 'w', encoding='utf-8') as f:
        f.write(body_html)
    
    print('Successfully transplanted body HTML to Angular template.')
else:
    print('Failed to find body tag.')
