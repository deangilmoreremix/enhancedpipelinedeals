#!/usr/bin/env python3
"""
Test 4: Static HTML Verification
Tests the built index.html file directly without a server to verify static content.
"""

from playwright.sync_api import sync_playwright
import json
import os

def main():
    output_dir = '/workspaces/enhancedpipelinedeals/output'
    os.makedirs(output_dir, exist_ok=True)
    
    # Get the path to index.html
    html_file_path = os.path.abspath('index.html')
    file_url = f'file://{html_file_path}'
    
    results = {
        "test_name": "Static HTML Verification",
        "file_path": html_file_path,
        "file_url": file_url,
        "checks": []
    }
    
    print("📄 Starting Static HTML Verification Test...")
    print("=" * 60)
    print(f"   Testing file: {html_file_path}")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        # Test 1: File Accessibility
        print("\n📍 Test 1: File Accessibility")
        if os.path.exists(html_file_path):
            print("   ✓ index.html exists")
            file_size = os.path.getsize(html_file_path)
            print(f"   ✓ File size: {file_size:,} bytes")
            results["checks"].append({
                "name": "File Existence",
                "status": "passed",
                "size": file_size
            })
        else:
            print("   ❌ index.html not found!")
            results["checks"].append({
                "name": "File Existence",
                "status": "failed"
            })
            browser.close()
            return results
        
        # Test 2: Static Content Load
        print("\n📍 Test 2: Static Content Load via file://")
        try:
            page.goto(file_url)
            # Don't wait for networkidle on file:// URLs (no network)
            page.wait_for_timeout(500)
            
            page.screenshot(path=f'{output_dir}/11_static_html.png', full_page=True)
            print("   ✓ Loaded static HTML successfully")
            results["checks"].append({
                "name": "Static Load",
                "status": "passed"
            })
        except Exception as e:
            print(f"   ❌ Failed to load static HTML: {e}")
            results["checks"].append({
                "name": "Static Load",
                "status": "failed",
                "error": str(e)
            })
        
        # Test 3: SEO Meta Tags Verification
        print("\n📍 Test 3: SEO Meta Tags Verification")
        meta_checks = []
        
        required_meta = [
            ('title', 'title'),
            ('description', 'meta[name="description"]'),
            ('viewport', 'meta[name="viewport"]'),
            ('charset', 'meta[charset]'),
        ]
        
        for name, selector in required_meta:
            try:
                if name == 'title':
                    content = page.title()
                    exists = bool(content)
                else:
                    element = page.locator(selector).first
                    exists = element.count() > 0
                    content = element.get_attribute('content') if exists else None
                
                status = "passed" if exists else "failed"
                print(f"   [{status.upper()}] {name}: {content[:50] if content else 'N/A'}")
                meta_checks.append({
                    "name": name,
                    "status": status,
                    "content": content[:100] if content else None
                })
            except Exception as e:
                print(f"   [ERROR] {name}: {e}")
                meta_checks.append({
                    "name": name,
                    "status": "error",
                    "error": str(e)
                })
        
        results["checks"].append({
            "name": "SEO Meta Tags",
            "status": "passed" if all(c["status"] == "passed" for c in meta_checks) else "warning",
            "details": meta_checks
        })
        
        # Test 4: Open Graph Tags
        print("\n📍 Test 4: Open Graph (Social Media) Tags")
        og_tags = [
            'meta[property="og:title"]',
            'meta[property="og:description"]',
            'meta[property="og:type"]',
            'meta[property="og:url"]',
            'meta[property="og:image"]'
        ]
        
        og_results = []
        for tag in og_tags:
            try:
                element = page.locator(tag).first
                if element.count() > 0:
                    content = element.get_attribute('content')
                    property_name = element.get_attribute('property')
                    print(f"   ✓ {property_name}: {content[:40] if content else 'empty'}")
                    og_results.append({"tag": tag, "found": True, "content": content[:100]})
                else:
                    print(f"   ⚠ Missing: {tag}")
                    og_results.append({"tag": tag, "found": False})
            except Exception as e:
                print(f"   ⚠ Error checking {tag}: {e}")
                og_results.append({"tag": tag, "found": False, "error": str(e)})
        
        results["checks"].append({
            "name": "Open Graph Tags",
            "status": "passed" if all(r["found"] for r in og_results) else "warning",
            "details": og_results
        })
        
        # Test 5: Check for favicon
        print("\n📍 Test 5: Favicon and Icons")
        icon_selectors = [
            'link[rel="icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="shortcut icon"]'
        ]
        
        icon_results = []
        for selector in icon_selectors:
            try:
                element = page.locator(selector).first
                found = element.count() > 0
                if found:
                    href = element.get_attribute('href')
                    print(f"   ✓ Found: {selector} -> {href}")
                    icon_results.append({"selector": selector, "found": True, "href": href})
                else:
                    print(f"   ⚠ Missing: {selector}")
                    icon_results.append({"selector": selector, "found": False})
            except Exception as e:
                print(f"   ⚠ Error: {e}")
                icon_results.append({"selector": selector, "found": False, "error": str(e)})
        
        results["checks"].append({
            "name": "Icons",
            "status": "passed" if any(r["found"] for r in icon_results) else "warning",
            "details": icon_results
        })
        
        # Test 6: Accessibility Check (Basic)
        print("\n📍 Test 6: Basic Accessibility Check")
        try:
            # Check for lang attribute
            lang = page.locator('html').first.get_attribute('lang')
            if lang:
                print(f"   ✓ HTML lang attribute: {lang}")
            else:
                print("   ⚠ Missing HTML lang attribute")
            
            # Check for h1
            h1_count = page.locator('h1').count()
            print(f"   ✓ H1 tags found: {h1_count}")
            
            # Check for images without alt
            images = page.locator('img').all()
            images_without_alt = [img for img in images if not img.get_attribute('alt')]
            print(f"   Images without alt: {len(images_without_alt)}/{len(images)}")
            
            results["checks"].append({
                "name": "Basic Accessibility",
                "status": "passed",
                "lang": lang,
                "h1_count": h1_count,
                "images_total": len(images),
                "images_missing_alt": len(images_without_alt)
            })
        except Exception as e:
            print(f"   ⚠ Accessibility check failed: {e}")
            results["checks"].append({
                "name": "Basic Accessibility",
                "status": "warning",
                "error": str(e)
            })
        
        browser.close()
    
    # Save results
    with open(f'{output_dir}/test_04_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 Static HTML Verification Complete!")
    print("=" * 60)
    
    passed = sum(1 for c in results["checks"] if c.get("status") == "passed")
    warnings = sum(1 for c in results["checks"] if c.get("status") == "warning")
    failed = sum(1 for c in results["checks"] if c.get("status") == "failed")
    
    print(f"   ✅ Passed:   {passed}")
    print(f"   ⚠️  Warnings: {warnings}")
    print(f"   ❌ Failed:   {failed}")
    print(f"\n📁 Results saved to: {output_dir}/test_04_results.json")
    
    return results

if __name__ == "__main__":
    main()
