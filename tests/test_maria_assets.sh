#!/bin/bash
# ============================================
#  Maria Widget v2.0 - Asset & Integration Tests
#  Tests static files, CSS/JS deployment, and content integrity
#
#  Usage:
#    bash tests/test_maria_assets.sh                     # Test gegen dgd.digital
#    bash tests/test_maria_assets.sh http://localhost:8085 # Test gegen lokalen Server
# ============================================

set -u

BASE_URL="${1:-https://dgd.digital}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ---- Test Helpers ----
assert() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if [ "$actual" = "$expected" ]; then
        echo -e "  ${GREEN}PASS${NC} $name"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $name (expected: $expected, got: $actual)"
        FAIL=$((FAIL + 1))
    fi
}

assert_contains() {
    local name="$1"
    local needle="$2"
    local haystack="$3"
    TOTAL=$((TOTAL + 1))
    if echo "$haystack" | grep -q "$needle"; then
        echo -e "  ${GREEN}PASS${NC} $name"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $name (expected to contain: '$needle')"
        FAIL=$((FAIL + 1))
    fi
}

assert_not_contains() {
    local name="$1"
    local needle="$2"
    local haystack="$3"
    TOTAL=$((TOTAL + 1))
    if echo "$haystack" | grep -q "$needle"; then
        echo -e "  ${RED}FAIL${NC} $name (should NOT contain: '$needle')"
        FAIL=$((FAIL + 1))
    else
        echo -e "  ${GREEN}PASS${NC} $name"
        PASS=$((PASS + 1))
    fi
}

assert_gt() {
    local name="$1"
    local min="$2"
    local actual="$3"
    TOTAL=$((TOTAL + 1))
    if [ "$actual" -gt "$min" ] 2>/dev/null; then
        echo -e "  ${GREEN}PASS${NC} $name (value: $actual)"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}FAIL${NC} $name (expected > $min, got: $actual)"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "========================================"
echo " Maria Widget v2.0 - Asset Tests"
echo " Server: $BASE_URL"
echo "========================================"
echo ""

# ============================================
#  1. JavaScript File - Deployment Check
# ============================================
echo -e "${YELLOW}[1] portal-cortex.js deployment${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/js/portal-cortex.js")
assert "JS file loads (HTTP 200)" "200" "$HTTP"

JS_CONTENT=$(curl -s "$BASE_URL/js/portal-cortex.js")

assert_contains "JS is v2.0" "v2.0" "$JS_CONTENT"
assert_contains "JS has MariaChatWidget" "MariaChatWidget" "$JS_CONTENT"
assert_contains "JS has showWelcomeScreen" "showWelcomeScreen" "$JS_CONTENT"
assert_contains "JS has FALLBACK_RESPONSES" "FALLBACK_RESPONSES" "$JS_CONTENT"
assert_contains "JS has CONTEXT_ACTIONS" "CONTEXT_ACTIONS" "$JS_CONTENT"
assert_contains "JS has CORTEX_URL config" "CORTEX_URL" "$JS_CONTENT"
assert_contains "JS has cortex.dgd.digital URL" "cortex.dgd.digital" "$JS_CONTENT"
assert_contains "JS has open() method" "open: function" "$JS_CONTENT"
assert_contains "JS has close() method" "close: function" "$JS_CONTENT"
assert_contains "JS has destroy() method" "destroy: function" "$JS_CONTENT"
assert_contains "JS has isOnline() method" "isOnline: function" "$JS_CONTENT"

JS_SIZE=${#JS_CONTENT}
assert_gt "JS file size > 10000 bytes" 10000 "$JS_SIZE"

echo ""

# ============================================
#  2. CSS Files - Deployment Check
# ============================================
echo -e "${YELLOW}[2] CSS files deployment${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/css/portal-cortex.css")
assert "portal-cortex.css loads (HTTP 200)" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/css/maria-welcome.css")
assert "maria-welcome.css loads (HTTP 200)" "200" "$HTTP"

CSS_CORTEX=$(curl -s "$BASE_URL/css/portal-cortex.css")
CSS_WELCOME=$(curl -s "$BASE_URL/css/maria-welcome.css")

assert_contains "CSS has .maria-fab" ".maria-fab" "$CSS_CORTEX"
assert_contains "CSS has .maria-chat" ".maria-chat" "$CSS_CORTEX"
assert_contains "CSS has .maria-action-btn" ".maria-action-btn" "$CSS_CORTEX"
assert_contains "CSS has .maria-fab__avatar" ".maria-fab__avatar" "$CSS_CORTEX"
assert_contains "CSS has .maria-fab__label" ".maria-fab__label" "$CSS_CORTEX"
assert_contains "CSS has .maria-chat__subtitle" ".maria-chat__subtitle" "$CSS_CORTEX"

assert_contains "Welcome CSS has .maria-welcome-overlay" ".maria-welcome-overlay" "$CSS_WELCOME"
assert_contains "Welcome CSS has .maria-welcome__avatar" ".maria-welcome__avatar" "$CSS_WELCOME"
assert_contains "Welcome CSS has .maria-welcome__btn--chat" ".maria-welcome__btn--chat" "$CSS_WELCOME"
assert_contains "Welcome CSS has .maria-welcome__btn--skip" ".maria-welcome__btn--skip" "$CSS_WELCOME"
assert_contains "Welcome CSS has .maria-welcome__feature" ".maria-welcome__feature" "$CSS_WELCOME"
assert_contains "Welcome CSS has animation keyframes" "@keyframes" "$CSS_WELCOME"
assert_contains "Welcome CSS has reduced-motion media query" "prefers-reduced-motion" "$CSS_WELCOME"

echo ""

# ============================================
#  3. index.html - Integration Check
# ============================================
echo -e "${YELLOW}[3] index.html integration${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
assert "Index page loads (HTTP 200)" "200" "$HTTP"

HTML=$(curl -s "$BASE_URL/")

assert_contains "HTML loads portal-cortex.css" "portal-cortex.css" "$HTML"
assert_contains "HTML loads maria-welcome.css" "maria-welcome.css" "$HTML"
assert_contains "HTML loads portal-cortex.js" "portal-cortex.js" "$HTML"
assert_contains "HTML has cache-busting for CSS (v=)" "portal-cortex.css?v=" "$HTML"
assert_contains "HTML has cache-busting for welcome CSS" "maria-welcome.css?v=" "$HTML"
assert_contains "HTML has cache-busting for JS" "portal-cortex.js?v=" "$HTML"

echo ""

# ============================================
#  4. Fallback Responses - Content Check
# ============================================
echo -e "${YELLOW}[4] Fallback responses content${NC}"

assert_contains "Has 'schaden' keyword" "schaden" "$JS_CONTENT"
assert_contains "Has 'gutachter' keyword" "gutachter" "$JS_CONTENT"
assert_contains "Has 'status' keyword" "status" "$JS_CONTENT"
assert_contains "Has 'kosten' keyword" "kosten" "$JS_CONTENT"
assert_contains "Has 'partner' keyword" "partner" "$JS_CONTENT"
assert_contains "Has 'rente' keyword" "rente" "$JS_CONTENT"
assert_contains "Has 'kontakt' keyword" "kontakt" "$JS_CONTENT"
assert_contains "Has 'hallo' keyword" "hallo" "$JS_CONTENT"
assert_contains "Has 'danke' keyword" "danke" "$JS_CONTENT"
assert_contains "Has phone number in fallback" "800 009 5000" "$JS_CONTENT"
assert_contains "Has email in fallback" "service@deutscher-gutachter-dienst.de" "$JS_CONTENT"
assert_contains "Has FALLBACK_DEFAULT" "FALLBACK_DEFAULT" "$JS_CONTENT"

echo ""

# ============================================
#  5. Context Actions - Page Routes
# ============================================
echo -e "${YELLOW}[5] Contextual actions configuration${NC}"

assert_contains "Has landing actions" "'landing'" "$JS_CONTENT"
assert_contains "Has report-form actions" "'report-form'" "$JS_CONTENT"
assert_contains "Has wizard actions" "'wizard'" "$JS_CONTENT"
assert_contains "Has status-check actions" "'status-check'" "$JS_CONTENT"
assert_contains "Has partner actions" "'partner'" "$JS_CONTENT"
assert_contains "Has rente actions" "'rente'" "$JS_CONTENT"

# Route mapping
assert_contains "Maps #melden to report-form" "#melden.*report-form" "$JS_CONTENT"
assert_contains "Maps #gutachter to wizard" "#gutachter.*wizard" "$JS_CONTENT"
assert_contains "Maps #status to status-check" "#status.*status-check" "$JS_CONTENT"
assert_contains "Maps #partner to partner" "#partner.*partner" "$JS_CONTENT"
assert_contains "Maps #rente to rente" "#rente.*rente" "$JS_CONTENT"

echo ""

# ============================================
#  6. Security Check
# ============================================
echo -e "${YELLOW}[6] Security checks${NC}"

assert_not_contains "No API keys in JS" "sk-" "$JS_CONTENT"
assert_not_contains "No tokens in JS" "Bearer " "$JS_CONTENT"
assert_not_contains "No passwords in JS" "password.*=" "$JS_CONTENT"
assert_contains "Uses kundenservice role" "kundenservice" "$JS_CONTENT"
assert_contains "SSE streaming via /api/chat/stream" "/api/chat/stream" "$JS_CONTENT"

echo ""

# ============================================
#  7. Welcome Screen - localStorage Logic
# ============================================
echo -e "${YELLOW}[7] Welcome screen logic${NC}"

assert_contains "Uses maria-welcomed localStorage key" "maria-welcomed" "$JS_CONTENT"
assert_contains "Creates overlay with correct ID" "maria-welcome-overlay" "$JS_CONTENT"
assert_contains "Dismisses with animation class" "maria-welcome-overlay--closing" "$JS_CONTENT"
assert_contains "Has welcome chat button ID" "maria-welcome-chat" "$JS_CONTENT"
assert_contains "Has welcome skip button ID" "maria-welcome-skip" "$JS_CONTENT"
assert_contains "Uses maria-chat-history sessionStorage key" "maria-chat-history" "$JS_CONTENT"

echo ""

# ============================================
#  8. Asset Integrity - Images
# ============================================
echo -e "${YELLOW}[8] Asset integrity${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/img/dgd-falcon.png")
assert "Falcon avatar image loads (HTTP 200)" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/css/theme.css")
assert "theme.css loads (HTTP 200)" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/js/app.js")
assert "app.js loads (HTTP 200)" "200" "$HTTP"

echo ""

# ============================================
#  SUMMARY
# ============================================
echo "========================================"
if [ $FAIL -eq 0 ]; then
    echo -e " ${GREEN}ALL $TOTAL TESTS PASSED${NC}"
else
    echo -e " ${RED}$FAIL FAILED${NC} / $TOTAL total ($PASS passed)"
fi
echo "========================================"
echo ""

exit $FAIL
