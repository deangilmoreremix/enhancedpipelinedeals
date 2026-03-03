#!/usr/bin/env python3
"""
Test 3: Console Logging
Captures all browser console output (logs, warnings, errors) during page interaction.
"""

from playwright.sync_api import sync_playwright
import json
import os
from datetime import datetime

def main():
    output_dir = '/workspaces/enhancedpipelinedeals/output'
    os.makedirs(output_dir, exist_ok=True)
    
    console_logs = []
    errors = []
    warnings = []
    
    results = {
        "test_name": "Console Logging",
        "url": "http://localhost:5173",
        "start_time": datetime.now().isoformat(),
        "logs": [],
        "summary": {}
    }
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        
        print("📝 Starting Console Logging Test...")
        print("=" * 60)
        
        # Set up console log capture
        def handle_console_message(msg):
            log_entry = {
                "type": msg.type,
                "text": msg.text,
                "location": msg.location if hasattr(msg, 'location') else None,
                "time": datetime.now().isoformat()
            }
            console_logs.append(log_entry)
            
            # Categorize
            if msg.type == 'error':
                errors.append(log_entry)
                print(f"   🔴 ERROR: {msg.text[:80]}")
            elif msg.type == 'warning':
                warnings.append(log_entry)
                print(f"   🟡 WARNING: {msg.text[:80]}")
            else:
                print(f"   🟢 [{msg.type.upper()}] {msg.text[:80]}")
        
        page.on("console", handle_console_message)
        
        # Set up page error capture
        def handle_page_error(error):
            error_entry = {
                "type": "page_error",
                "message": str(error),
                "time": datetime.now().isoformat()
            }
            errors.append(error_entry)
            print(f"   💥 PAGE ERROR: {str(error)[:80]}")
        
        page.on("pageerror", handle_page_error)
        
        # Test 1: Initial Load
        print("\n📍 Test 1: Capturing console during initial load")
        page.goto('http://localhost:5176')
        page.wait_for_load_state('networkidle')
        page.wait_for_timeout(3000)  # Wait for React to render
        page.screenshot(path=f'{output_dir}/08_console_load.png', full_page=True)
        print("   ✓ Page loaded, console captured")
        
        # Test 2: Wait and capture any background logs
        print("\n📍 Test 2: Waiting for background processes")
        page.wait_for_timeout(2000)
        page.screenshot(path=f'{output_dir}/09_console_after_wait.png', full_page=True)
        print("   ✓ Waited 2 seconds for background logs")
        
        # Test 3: Interact with page (clicks trigger more logs)
        print("\n📍 Test 3: Capturing logs during interaction")
        buttons = page.locator('button').all()
        for i, button in enumerate(buttons[:3]):  # Click first 3 buttons
            if button.is_visible():
                try:
                    text = button.inner_text().strip()[:30] or "[unnamed]"
                    print(f"   Clicking button: '{text}'")
                    button.click()
                    page.wait_for_timeout(500)
                except Exception as e:
                    print(f"   Could not click button {i}: {e}")
        
        page.screenshot(path=f'{output_dir}/10_console_after_interaction.png', full_page=True)
        print("   ✓ Interaction complete")
        
        # Test 4: Check for React-specific logs
        print("\n📍 Test 4: Analyzing log patterns")
        react_errors = [log for log in errors if 'react' in log.get('text', '').lower()]
        console_errors = [log for log in console_logs if log['type'] == 'error']
        console_warnings = [log for log in console_logs if log['type'] == 'warning']
        
        print(f"   Total console entries: {len(console_logs)}")
        print(f"   Errors: {len(console_errors)}")
        print(f"   Warnings: {len(console_warnings)}")
        print(f"   React-specific errors: {len(react_errors)}")
        
        browser.close()
    
    # Compile results
    results["logs"] = console_logs
    results["end_time"] = datetime.now().isoformat()
    results["summary"] = {
        "total_logs": len(console_logs),
        "total_errors": len(console_errors),
        "total_warnings": len(console_warnings),
        "react_errors": len(react_errors),
        "has_critical_errors": len(console_errors) > 0
    }
    
    # Save results to JSON
    with open(f'{output_dir}/test_03_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    # Save console log as text file
    with open(f'{output_dir}/console_output.log', 'w') as f:
        for log in console_logs:
            f.write(f"[{log['time']}] [{log['type'].upper()}] {log['text']}\n")
    
    # Save errors separately
    if console_errors:
        with open(f'{output_dir}/console_errors.log', 'w') as f:
            for log in console_errors:
                f.write(f"[{log['time']}] {log['text']}\n")
    
    print("\n" + "=" * 60)
    print("📊 Console Logging Test Complete!")
    print("=" * 60)
    print(f"   Total logs captured: {len(console_logs)}")
    print(f"   Errors: {len(console_errors)}")
    print(f"   Warnings: {len(console_warnings)}")
    print(f"\n📁 Results:")
    print(f"   - {output_dir}/test_03_results.json")
    print(f"   - {output_dir}/console_output.log")
    if console_errors:
        print(f"   - {output_dir}/console_errors.log")
    
    return results

if __name__ == "__main__":
    main()
