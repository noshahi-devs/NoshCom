import re
import glob

# The Shein logo SVG has viewBox '0 0 652.48 138.71'
svg_regex = re.compile(r'<svg[^>]*viewBox=[\"\']0 0 652\.48 138\.71[\"\'][^>]*>[\s\S]*?</svg>', re.IGNORECASE)
replacement = '<span style=\"font-size: 32px; font-weight: 900; color: #000; font-family: Verdana, sans-serif; letter-spacing: 2px; text-transform: uppercase;\">World Cart Us</span>'

files = glob.glob('src/assets/corporate/*.html')
for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the logo
    new_content, count = svg_regex.subn(replacement, content)
    
    # Also find any remaining 'shein' text (case-insensitive) just to be absolutely sure in titles/alts
    # but be very careful not to accidentally break tags like 'href'. We will just replace it outside of tags again
    
    if count > 0:
        with open(file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Replaced {count} logo instances in {file}')
    else:
        print(f'No logo instances in {file}')
