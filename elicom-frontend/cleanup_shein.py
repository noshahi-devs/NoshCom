import re
import glob

files = glob.glob('src/assets/corporate/*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # The scrape.py already injected the 1st version of the JS script. 
    # Let's replace it with the advanced version that completely blocks 
    # all non-corporate navigation.
    
    script_fix = """
  // Intercept clicks on links and post message to parent Angular app
  document.addEventListener('click', function(e) {
    let target = e.target.closest('a');
    if (target && target.href) {
      let url = new URL(target.href);
      let path = url.pathname.replace(/\/$/, ''); // remove trailing slash
      path = path.substring(path.lastIndexOf('/') + 1); // get last segment
      let validPages = ['about-us', 'our-business', 'our-impact', 'newsroom', 'careers'];
      
      if (validPages.includes(path)) {
          e.preventDefault();
          window.parent.postMessage({ type: 'NAVIGATE_CORPORATE', path: path }, '*');
      } else {
          // Block ALL other links to prevent leaking to Shein!
          e.preventDefault();
      }
    }
  });
"""
    # Replace the old script with the new one
    content = re.sub(r'// Intercept clicks on links.*?\}\s*\}\s*\n\s*\}\s*\);\s*', script_fix, content, flags=re.DOTALL)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Injected strict link blocking in {file}')
