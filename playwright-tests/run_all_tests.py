#!/usr/bin/env python3
"""
Comprehensive Test Suite Runner
Executes all webapp testing scripts and generates a consolidated report.
"""

import subprocess
import sys
import json
import os
from datetime import datetime

def run_test(test_name, test_file, needs_server=False):
    """Run a single test and return results."""
    print(f"\n{'='*60}")
    print(f"Running: {test_name}")
    print('='*60)
    
    test_path = f'/workspaces/enhancedpipelinedeals/playwright-tests/{test_file}'
    
    if needs_server:
        # Use with_server.py to manage the dev server
        cmd = [
            'python', '/home/codespace/.kilocode/skills/webapp-testing/scripts/with_server.py',
            '--server', 'npm run dev',
            '--port', '5173',
            '--timeout', '60',
            '--', 'python', test_path
        ]
    else:
        # Run directly (for static tests)
        cmd = ['python', test_path]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120
        )
        
        print(result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        return {
            "name": test_name,
            "status": "passed" if result.returncode == 0 else "failed",
            "returncode": result.returncode,
            "output": result.stdout,
            "errors": result.stderr if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        print(f"❌ {test_name} timed out!")
        return {
            "name": test_name,
            "status": "timeout",
            "error": "Test exceeded 120 second timeout"
        }
    except Exception as e:
        print(f"❌ {test_name} error: {e}")
        return {
            "name": test_name,
            "status": "error",
            "error": str(e)
        }

def main():
    output_dir = '/workspaces/enhancedpipelinedeals/output'
    os.makedirs(output_dir, exist_ok=True)
    
    print("\n" + "🚀"*30)
    print("   SMART CRM WEBAPP TESTING SUITE")
    print("   Comprehensive Playwright Automation")
    print("🚀"*30 + "\n")
    
    start_time = datetime.now()
    
    # Define all tests
    tests = [
        ("Static HTML Verification", "test_04_static_html.py", False),
        ("Element Discovery", "test_01_element_discovery.py", True),
        ("UI Interaction & Navigation", "test_02_ui_interaction.py", True),
        ("Console Logging", "test_03_console_logging.py", True),
    ]
    
    results = []
    
    # Run each test
    for test_name, test_file, needs_server in tests:
        result = run_test(test_name, test_file, needs_server)
        results.append(result)
    
    # Generate consolidated report
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    report = {
        "test_suite": "Smart CRM Webapp Testing",
        "timestamp": start_time.isoformat(),
        "duration_seconds": duration,
        "results": results,
        "summary": {
            "total": len(results),
            "passed": sum(1 for r in results if r["status"] == "passed"),
            "failed": sum(1 for r in results if r["status"] == "failed"),
            "timeout": sum(1 for r in results if r["status"] == "timeout"),
            "error": sum(1 for r in results if r["status"] == "error")
        },
        "output_files": {
            "screenshots": f"{output_dir}/*.png",
            "json_results": f"{output_dir}/*.json",
            "console_logs": f"{output_dir}/*.log"
        }
    }
    
    # Save report
    with open(f'{output_dir}/comprehensive_test_report.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    # Print summary
    print("\n" + "="*60)
    print("📊 COMPREHENSIVE TEST REPORT")
    print("="*60)
    print(f"\n⏱️  Duration: {duration:.2f} seconds")
    print(f"\n📋 Test Results:")
    for r in results:
        icon = "✅" if r["status"] == "passed" else "❌"
        print(f"   {icon} {r['name']}: {r['status'].upper()}")
    
    s = report["summary"]
    print(f"\n📈 Summary:")
    print(f"   ✅ Passed:   {s['passed']}/{s['total']}")
    print(f"   ❌ Failed:   {s['failed']}/{s['total']}")
    print(f"   ⏱️  Timeout:  {s['timeout']}/{s['total']}")
    print(f"   💥 Error:    {s['error']}/{s['total']}")
    
    print(f"\n📁 Output Files:")
    print(f"   - {output_dir}/comprehensive_test_report.json")
    print(f"   - Screenshots: {output_dir}/*.png")
    print(f"   - Test Results: {output_dir}/test_0*_results.json")
    
    # List all output files
    print("\n📂 Generated Files:")
    for f in sorted(os.listdir(output_dir)):
        file_path = os.path.join(output_dir, f)
        size = os.path.getsize(file_path)
        print(f"   - {f} ({size:,} bytes)")
    
    print("\n" + "="*60)
    
    # Return exit code based on results
    if s["failed"] > 0 or s["timeout"] > 0 or s["error"] > 0:
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
