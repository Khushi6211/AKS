#!/usr/bin/env python3
"""
Helper script to update HTML files with config.js integration
Replaces hardcoded Replit URLs with centralized configuration
"""

import os
import re

# HTML files to update
HTML_FILES = [
    'index.html',
    'login.html',
    'profile.html',
    'order-history.html',
    'thank-you.html',
    'admin.html'
]

# Config script tag to add
CONFIG_SCRIPT = '    <script src="config.js"></script>\n'

def update_html_file(filename):
    """Update a single HTML file"""
    if not os.path.exists(filename):
        print(f"⚠️  File not found: {filename}")
        return False
    
    print(f"\n📝 Processing {filename}...")
    
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    modified = False
    
    # 1. Add config.js script tag if not present
    if 'config.js' not in content:
        print(f"  ✅ Adding config.js script tag...")
        # Find </head> and add script before it
        content = content.replace('</head>', CONFIG_SCRIPT + '</head>')
        modified = True
    else:
        print(f"  ℹ️  config.js already included")
    
    # 2. Replace hardcoded backend URLs
    # Pattern to match: const backendBaseUrl = 'https://...repl.co';
    pattern = r"const backendBaseUrl\s*=\s*['\"]https://[^'\"]+repl[^'\"]*['\"];"
    replacement = "const backendBaseUrl = window.APP_CONFIG.BACKEND_URL;"
    
    if re.search(pattern, content):
        print(f"  ✅ Replacing hardcoded backend URL...")
        content = re.sub(pattern, replacement, content)
        modified = True
    else:
        print(f"  ℹ️  No hardcoded backend URL found (may already be updated)")
    
    # 3. Save if modified
    if modified:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ {filename} updated successfully!")
        return True
    else:
        print(f"  ℹ️  No changes needed for {filename}")
        return False

def main():
    """Main function"""
    print("=" * 60)
    print("🔧 HTML Files Updater for Arun Karyana Store")
    print("=" * 60)
    print("\nThis script will:")
    print("  1. Add config.js script tag to each HTML file")
    print("  2. Replace hardcoded Replit URLs with centralized config")
    print()
    
    input("Press Enter to continue...")
    print()
    
    updated_files = []
    skipped_files = []
    
    for filename in HTML_FILES:
        if update_html_file(filename):
            updated_files.append(filename)
        else:
            skipped_files.append(filename)
    
    print("\n" + "=" * 60)
    print("📊 Summary")
    print("=" * 60)
    print(f"✅ Updated: {len(updated_files)} files")
    for f in updated_files:
        print(f"   - {f}")
    
    print(f"\nℹ️  Skipped: {len(skipped_files)} files (no changes needed)")
    for f in skipped_files:
        print(f"   - {f}")
    
    print("\n" + "=" * 60)
    print("🎯 Next Steps")
    print("=" * 60)
    print("1. Review the changes in each file")
    print("2. Test locally if possible")
    print("3. Commit and push to GitHub:")
    print("   git add *.html")
    print("   git commit -m \"feat: Integrate centralized config for backend URL\"")
    print("   git push")
    print("4. Deploy to Netlify")
    print()
    print("✨ Done! Your HTML files are now using centralized configuration.")
    print()

if __name__ == "__main__":
    main()
