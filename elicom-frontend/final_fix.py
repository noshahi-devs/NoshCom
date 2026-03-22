import re
import glob

files = glob.glob('src/assets/corporate/*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        html = f.read()

    # Hide hovering tooltips: convert href on anchors to data-href
    # Matches <a ... href="..." ...>
    html = re.sub(
        r'<a(?=\s|)([^>]*?)\bhref=([\'"])(.*?)\2([^>]*)>',
        r'<a\1data-href=\2\3\2 style="cursor: pointer;"\4>',
        html,
        flags=re.IGNORECASE
    )

    # Note: the above removed href from all <a>, so hovering won't show the link target
    
    # Fix the overlapping screen reader text
    # e.g. <span style="...">World Cart Us</span><span class="screen-reader-text">WORLD CART US</span>
    html = re.sub(
        r'(<span style="font-size: 32px[^>]+>World Cart Us</span>)\s*<span class="screen-reader-text">.*?</span>',
        r'\1',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )

    # Finally, adapt the click interceptor script to rely on dataset.href
    js_fix = r"""
  // Intercept clicks on links and post message to parent Angular app
  document.addEventListener('click', function(e) {
    let target = e.target.closest('a');
    if (target) {
      let hx = target.getAttribute('data-href') || target.getAttribute('href');
      if (hx && hx.startsWith('http')) {
          try {
              let url = new URL(hx);
              let path = url.pathname.replace(/\/$/, ''); // remove trailing slash
              path = path.substring(path.lastIndexOf('/') + 1); // get last segment
              let validPages = ['about-us', 'our-business', 'our-impact', 'newsroom', 'careers'];
              
              if (validPages.includes(path)) {
                  e.preventDefault();
                  window.parent.postMessage({ type: 'NAVIGATE_CORPORATE', path: path }, '*');
                  return;
              }
          } catch(err) {}
      }
      e.preventDefault(); // Block everything else!
    }
  });
"""
    # Replace the old interceptor
    html = re.sub(r'// Intercept clicks on links.*?(?=\s*</script>|</body>)', js_fix, html, flags=re.DOTALL)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'Applied final fix to {file}')
