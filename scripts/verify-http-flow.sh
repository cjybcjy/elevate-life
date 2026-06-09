#!/bin/bash
# Verify the full HTTP flow: login → dashboard → management
# This tests that pages render correctly with actual auth

set -e
BASE="http://localhost:3000"

echo "=== HTTP Flow Test ==="
echo ""

# Step 1: Get CSRF token from login page
echo "[1] Getting CSRF token..."
CSRF=$(curl -s -c /tmp/nextjs-cookies.txt "$BASE/api/auth/csrf" 2>/dev/null | grep -o '"csrfToken":"[^"]*"' | cut -d'"' -f4)
echo "    CSRF: ${CSRF:0:10}..."

# Step 2: Login via credentials
echo "[2] Logging in..."
HTTP_CODE=$(curl -s -c /tmp/nextjs-cookies.txt -b /tmp/nextjs-cookies.txt \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "csrfToken=$CSRF&username=demo&password=demo123" \
  -o /dev/null -w "%{http_code}" -D /tmp/login-headers.txt)

echo "    HTTP: $HTTP_CODE"

# Extract session cookie
SESSION_TOKEN=$(grep "authjs.session-token" /tmp/nextjs-cookies.txt | awk '{print $NF}')
echo "    Session token: ${SESSION_TOKEN:0:10}..."

# Step 3: Check management page (should show liabilities if data exists)
echo "[3] Checking liabilities management page..."
HTTP_CODE=$(curl -s -b /tmp/nextjs-cookies.txt -o /tmp/mgmt-liabilities.html -w "%{http_code}" "$BASE/management/liabilities")
echo "    HTTP: $HTTP_CODE"

# Check if the page contains liability data
if grep -q "房贷" /tmp/mgmt-liabilities.html; then
  echo "    PASS: Page contains existing liability '房贷'"
  echo "    Liability data is rendering correctly!"
elif grep -q "暂无负债" /tmp/mgmt-liabilities.html; then
  echo "    WARN: Page shows '暂无负债' - no liabilities found"
  echo "    Checking if page rendered at all..."
  head -5 /tmp/mgmt-liabilities.html
else
  echo "    UNKNOWN: Page doesn't contain expected content"
  echo "    First 200 chars:"
  head -c 200 /tmp/mgmt-liabilities.html
fi

# Step 4: Check dashboard page
echo "[4] Checking dashboard page..."
HTTP_CODE=$(curl -s -b /tmp/nextjs-cookies.txt -o /tmp/dashboard.html -w "%{http_code}" "$BASE/")
echo "    HTTP: $HTTP_CODE"

if grep -q "负债总览" /tmp/dashboard.html; then
  echo "    PASS: Dashboard contains '负债总览' section"
else
  echo "    FAIL: Dashboard doesn't contain expected section"
  echo "    First 200 chars:"
  head -c 200 /tmp/dashboard.html
fi

echo ""
echo "=== HTTP Flow Test Complete ==="
