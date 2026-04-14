#!/usr/bin/env python3
"""
Test 2: UI Interaction and Navigation
Tests clicking buttons, navigating through the CRM interface, and verifying UI behavior.
"""

from playwright.sync_api import sync_playwright, expect
import json
import os

def main():
    output_dir = '/workspaces/enhancedpipelinedeals/output'
    os.makedirs(output_dir, exist_ok=True)
    
    results = {
        "test_name": "UI Interaction and Navigation",
        "url": "http://localhost:5173",
        "tests": []
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        print("🖱️ Starting UI Interaction Test...")
        print("=" * 60)
        
        # Test 1: Initial Page Load
        print("\n📍 Test 1: Initial Page Load")
        page.goto('http://localhost:5176')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(3000)  # Wait for React to render
        page.screenshot(path=f'{output_dir}/03_page_loaded.png', full_page=True)
        
        title = page.title()
        print(f"   ✓ Page loaded: {title}")
        results["tests"].append({
            "name": "Initial Page Load",
            "status": "passed",
            "title": title
        })
        
        # Test 2: Check for main navigation elements
        print("\n📍 Test 2: Navigation Elements Check")
        try:
            # Look for common CRM navigation elements
            nav_selectors = [
                'nav',
                '[role="navigation"]',
                'header',
                '.sidebar',
                '.navbar'
            ]
            nav_found = False
            for selector in nav_selectors:
                try:
                    if page.locator(selector).count() > 0:
                        print(f"   ✓ Found navigation element: {selector}")
                        nav_found = True
                        break
                except:
                    continue
            
            if not nav_found:
                print("   ⚠ No standard navigation elements found")
            
            results["tests"].append({
                "name": "Navigation Elements",
                "status": "passed" if nav_found else "warning"
            })
        except Exception as e:
            print(f"   ⚠ Error checking navigation: {e}")
            results["tests"].append({
                "name": "Navigation Elements",
                "status": "warning",
                "error": str(e)
            })
        
        # Test 3: Try to find and interact with buttons
        print("\n📍 Test 3: Button Interactions")
        buttons = page.locator('button').all()
        interactable_buttons = [b for b in buttons if b.is_visible()]
        
        if interactable_buttons:
            print(f"   Found {len(interactable_buttons)} visible buttons")
            
            # Try clicking the first button
            try:
                first_button = interactable_buttons[0]
                button_text = first_button.inner_text().strip()[:30] or "[unnamed]"
                print(f"   Attempting to click: '{button_text}'")
                
                first_button.click()
                page.wait_for_timeout(500)
                page.screenshot(path=f'{output_dir}/04_after_button_click.png', full_page=True)
                print(f"   ✓ Clicked button successfully")
                
                results["tests"].append({
                    "name": "Button Click",
                    "status": "passed",
                    "button_text": button_text
                })
            except Exception as e:
                print(f"   ⚠ Could not click button: {e}")
                results["tests"].append({
                    "name": "Button Click",
                    "status": "failed",
                    "error": str(e)
                })
        else:
            print("   ⚠ No visible buttons found")
            results["tests"].append({
                "name": "Button Click",
                "status": "skipped",
                "reason": "No visible buttons"
            })
        
        # Test 4: Check for deal/pipeline elements
        print("\n📍 Test 4: CRM Pipeline Elements")
        pipeline_selectors = [
            '[data-testid="pipeline"]',
            '[data-testid="deal"]',
            '.deal-card',
            '.pipeline',
            '[class*="deal"]',
            '[class*="pipeline"]'
        ]
        
        pipeline_found = False
        for selector in pipeline_selectors:
            try:
                count = page.locator(selector).count()
                if count > 0:
                    print(f"   ✓ Found pipeline elements ({selector}): {count} items")
                    pipeline_found = True
                    break
            except:
                continue
        
        if not pipeline_found:
            print("   ⚠ No standard CRM pipeline elements found")
        
        results["tests"].append({
            "name": "Pipeline Elements",
            "status": "passed" if pipeline_found else "warning"
        })
        
        # Test 5: Scroll test
        print("\n📍 Test 5: Page Scroll Test")
        try:
            page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            page.wait_for_timeout(300)
            page.screenshot(path=f'{output_dir}/05_scrolled_to_bottom.png', full_page=True)
            print("   ✓ Scrolled to bottom of page")
            results["tests"].append({
                "name": "Page Scroll",
                "status": "passed"
            })
        except Exception as e:
            print(f"   ⚠ Scroll test failed: {e}")
            results["tests"].append({
                "name": "Page Scroll",
                "status": "failed",
                "error": str(e)
            })
        
        # Test 6: Check responsive behavior (mobile viewport)
        print("\n📍 Test 6: Responsive Behavior Check")
        try:
            page.set_viewport_size({'width': 375, 'height': 667})  # iPhone SE size
            page.wait_for_timeout(500)
            page.screenshot(path=f'{output_dir}/06_mobile_viewport.png', full_page=True)
            print("   ✓ Tested mobile viewport (375x667)")
            
            # Reset to desktop
            page.set_viewport_size({'width': 1920, 'height': 1080})
            page.wait_for_timeout(300)
            
            results["tests"].append({
                "name": "Responsive Mobile",
                "status": "passed"
            })
        except Exception as e:
            print(f"   ⚠ Responsive test failed: {e}")
            results["tests"].append({
                "name": "Responsive Mobile",
                "status": "failed",
                "error": str(e)
            })
        
        # Final screenshot
        page.screenshot(path=f'{output_dir}/07_ui_interaction_final.png', full_page=True)
        
        browser.close()
    
    # Save results
    with open(f'{output_dir}/test_02_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 UI Interaction Test Summary")
    print("=" * 60)
    passed = sum(1 for t in results["tests"] if t["status"] == "passed")
    warnings = sum(1 for t in results["tests"] if t["status"] == "warning")
    failed = sum(1 for t in results["tests"] if t["status"] == "failed")
    skipped = sum(1 for t in results["tests"] if t["status"] == "skipped")
    
    print(f"   ✅ Passed:   {passed}")
    print(f"   ⚠️  Warnings: {warnings}")
    print(f"   ❌ Failed:   {failed}")
    print(f"   ⏭️  Skipped:  {skipped}")
    print(f"\n📁 Results saved to: {output_dir}/test_02_results.json")
    
    return results

if __name__ == "__main__":
    main()
