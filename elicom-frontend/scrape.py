import urllib.request
import re
import os

urls = {
    'our-impact': 'https://www.sheingroup.com/our-impact/',
    'about-us': 'https://www.sheingroup.com/about-us/',
    'our-business': 'https://www.sheingroup.com/our-business/',
    'newsroom': 'https://www.sheingroup.com/newsroom/',
    'careers': 'https://www.sheingroup.com/careers/'
}

output_dir = r"d:\GitHub Project NDI\elicom-backend\elicom-backend\elicom-frontend\src\assets\corporate"
os.makedirs(output_dir, exist_ok=True)

# We want to replace text in Text Nodes but avoid breaking HTML tags and URLs, 
# but simply doing a naive string replace is fine if we are careful, because "shein" 
# inside class names or hrefs MIGHT break styles if Shein's CSS relies on them.
# BUT wait, the user said "replace shein -> World Cart Us".
# If we replace "shein" in URLs or classes, the stylesheets from Shein CDN will 404!
# So we must ONLY replace "Shein" "SHEIN" and "shein" when they are text content, 
# or we can do case-sensitive replace ONLY for Title Case and ALL CAPS, 
# because CSS classes and URLs are usually lowercase 'shein'.
# To be safer, let's only replace 'Shein' -> 'World Cart Us', 'SHEIN' -> 'WORLD CART US'.
# If there are lowercase 'shein' in text, maybe we manually replace cautiously or use regex 
# that only matches outside of HTML tags.

def replace_text_outside_tags(html, old, new):
    # This regex splits by tags and only applies replacement to the text outside tags
    parts = re.split(r'(<[^>]+>)', html)
    for i in range(0, len(parts), 2):
        parts[i] = parts[i].replace(old, new)
    return "".join(parts)

# Request headers to simulate a normal browser
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

inject_script = """
<script>
  // Intercept clicks on links and post message to parent Angular app
  document.addEventListener('click', function(e) {
    let target = e.target.closest('a');
    if (target && target.href) {
      let url = new URL(target.href);
      if (url.origin === 'https://www.sheingroup.com' || url.origin === window.location.origin) {
         let path = url.pathname.replace(/\/$/, ''); // remove trailing slash
         path = path.substring(path.lastIndexOf('/') + 1); // get last segment
         let validPages = ['about-us', 'our-business', 'our-impact', 'newsroom', 'careers'];
         if (validPages.includes(path)) {
             e.preventDefault();
             window.parent.postMessage({ type: 'NAVIGATE_CORPORATE', path: path }, '*');
         }
      }
    }
  });
</script>
"""

for page_name, url in urls.items():
    print(f"Fetching {url}...")
    req = urllib.request.Request(url, headers=headers)
    try:
        response = urllib.request.urlopen(req)
        html = response.read().decode('utf-8')
        
        # Strip all script tags to disable React/Vue hydration and analytics
        html = re.sub(r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>', '', html, flags=re.IGNORECASE)
        
        # Add base tag if not present
        if '<base ' not in html:
            html = html.replace('<head>', '<head>\n<base href="https://www.sheingroup.com/">\n')
            
        # Replace occurrences safely outside HTML tags
        html = replace_text_outside_tags(html, 'SHEIN', 'WORLD CART US')
        html = replace_text_outside_tags(html, 'Shein', 'World Cart Us')
        html = replace_text_outside_tags(html, 'shein', 'world cart us')
        html = replace_text_outside_tags(html, 'YOUR_OLD_COMPANY_NAME', 'World Cart Us') # extra fallback
        
        # Inject our communication script before </body>
        if '</body>' in html:
            html = html.replace('</body>', inject_script + '</body>')
        else:
            html += inject_script
            
        # Save file
        out_path = os.path.join(output_dir, f"{page_name}.html")
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"Saved {out_path}")
    except Exception as e:
        print(f"Failed {url}: {e}")
