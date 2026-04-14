#!/usr/bin/env python3
"""
Test 1: Element Discovery
Discovers and catalogs all interactive elements on the Smart CRM application.
"""

from playwright.sync_api import sync_playwright
import json
import os

def main():
    output_dir = '/workspaces/enhancedpipelinedeals/output'
    os.makedirs(output_dir, exist_ok=True)
    
    results = {
        "test_name": "Element Discovery",
        "url": "http://localhost:5173",
        "elements": {}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        print("🔍 Starting Element Discovery Test...")
        print("=" * 60)
        
        # Navigate and wait for network idle
        page.goto('http://localhost:5176')
        page.wait_for_load_state('networkidle')
        print("✅ Page loaded successfully")
        
        # Take initial screenshot
        page.screenshot(path=f'{output_dir}/01_initial_state.png', full_page=True)
        print("📸 Captured initial state screenshot")
        
        # Discover buttons
        buttons = page.locator('button').all()
        button_data = []
        print(f"\n🎯 Found {len(buttons)} buttons:")
        for i, button in enumerate(buttons):
            try:
                text = button.inner_text().strip() if button.is_visible() else "[hidden]"
                button_type = button.get_attribute('type') or 'button'
                disabled = button.is_disabled() if hasattr(button, 'is_disabled') else False
                button_data.append({
                    "index": i,
                    "text": text[:50] if text else "[no text]",
                    "type": button_type,
                    "disabled": disabled,
                    "visible": button.is_visible()
                })
                status = "✓" if button.is_visible() else "○"
                print(f"  [{status}] [{i}] {text[:40] if text else '[no text]'}")
            except Exception as e:
                print(f"  [!] Error reading button {i}: {str(e)[:50]}")
        results["elements"]["buttons"] = button_data
        
        # Discover links
        links = page.locator('a[href]').all()
        link_data = []
        print(f"\n🔗 Found {len(links)} links:")
        for i, link in enumerate(links[:10]):  # Limit to first 10
            try:
                text = link.inner_text().strip()
                href = link.get_attribute('href')
                link_data.append({
                    "index": i,
                    "text": text[:50] if text else "[no text]",
                    "href": href[:100] if href else "[no href]"
                })
                print(f"  [{i}] {text[:35] if text else '[no text]'} -> {href[:40] if href else '[no href]'}")
            except Exception as e:
                print(f"  [!] Error reading link {i}: {str(e)[:50]}")
        results["elements"]["links"] = link_data
        
        # Discover input fields
        inputs = page.locator('input, textarea, select').all()
        input_data = []
        print(f"\n📝 Found {len(inputs)} input fields:")
        for i, input_elem in enumerate(inputs):
            try:
                tag_name = input_elem.evaluate('el => el.tagName.toLowerCase()')
                input_type = input_elem.get_attribute('type') or 'text'
                name = input_elem.get_attribute('name') or input_elem.get_attribute('id') or "[unnamed]"
                placeholder = input_elem.get_attribute('placeholder') or "[no placeholder]"
                input_data.append({
                    "index": i,
                    "tag": tag_name,
                    "type": input_type,
                    "name": name,
                    "placeholder": placeholder[:50] if placeholder else "[none]"
                })
                print(f"  [{i}] {name} ({tag_name}/{input_type})")
            except Exception as e:
                print(f"  [!] Error reading input {i}: {str(e)[:50]}")
        results["elements"]["inputs"] = input_data
        
        # Discover headings
        headings = page.locator('h1, h2, h3').all()
        heading_data = []
        print(f"\n📋 Found {len(headings)} headings:")
        for i, heading in enumerate(headings[:5]):
            try:
                tag = heading.evaluate('el => el.tagName.toLowerCase()')
                text = heading.inner_text().strip()
                heading_data.append({
                    "index": i,
                    "level": tag,
                    "text": text[:100] if text else "[no text]"
                })
                print(f"  [{tag.upper()}] {text[:60] if text else '[no text]'}")
            except Exception as e:
                print(f"  [!] Error reading heading {i}: {str(e)[:50]}")
        results["elements"]["headings"] = heading_data
        
        # Get page title
        title = page.title()
        results["page_title"] = title
        print(f"\n📄 Page Title: {title}")
        
        # Get page metrics
        metrics = page.evaluate('''() => {
            return {
                url: window.location.href,
                width: window.innerWidth,
                height: window.innerHeight,
                userAgent: navigator.userAgent
            }
        }''')
        results["metrics"] = metrics
        
        # Take final screenshot
        page.screenshot(path=f'{output_dir}/02_element_discovery_complete.png', full_page=True)
        print("\n📸 Captured final screenshot")
        
        browser.close()
    
    # Save results to JSON
    with open(f'{output_dir}/test_01_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\n" + "=" * 60)
    print("✅ Element Discovery Test Complete!")
    print(f"📁 Results saved to: {output_dir}/test_01_results.json")
    print(f"🖼️ Screenshots saved to: {output_dir}/")
    
    return results

if __name__ == "__main__":
    main()
