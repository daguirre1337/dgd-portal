#!/bin/bash
# ============================================
#  DGD Portal - API Integration Tests
#  Testet alle Endpoints gegen den Live-Server
#
#  Usage:
#    bash tests/test_api.sh                     # Test gegen dgd.digital
#    bash tests/test_api.sh http://localhost:8000 # Test gegen lokalen Server
# ============================================

set -u

BASE_URL="${1:-https://dgd.digital}"
API="$BASE_URL/api/dgd"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---- Test Helper ----
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
echo " DGD Portal - API Tests"
echo " Server: $BASE_URL"
echo "========================================"
echo ""

# ============================================
#  1. GET /api/dgd/partners - Alle Partner
# ============================================
echo -e "${YELLOW}[1] GET /api/dgd/partners${NC}"

RESP=$(curl -s "$API/partners")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners")

assert "HTTP 200" "200" "$HTTP"

PARTNER_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
assert_gt "Partner count > 0" 0 "$PARTNER_COUNT"

FIRST_NAME=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['partners'][0]['name'])" 2>/dev/null)
assert_contains "First partner has name" "." "$FIRST_NAME"

HAS_LAT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'lat' in d['partners'][0] else 'no')" 2>/dev/null)
assert "Partners have lat field" "yes" "$HAS_LAT"

HAS_LNG=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'lng' in d['partners'][0] else 'no')" 2>/dev/null)
assert "Partners have lng field" "yes" "$HAS_LNG"

echo ""

# ============================================
#  2. GET /api/dgd/partners?specialty=kfz
# ============================================
echo -e "${YELLOW}[2] GET /api/dgd/partners?specialty=kfz${NC}"

RESP=$(curl -s "$API/partners?specialty=kfz")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners?specialty=kfz")

assert "HTTP 200" "200" "$HTTP"

KFZ_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
assert_gt "Kfz partners > 0" 0 "$KFZ_COUNT"

ALL_KFZ=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if all(p['specialty']=='kfz' for p in d['partners']) else 'no')" 2>/dev/null)
assert "All results are kfz" "yes" "$ALL_KFZ"

echo ""

# ============================================
#  3. GET /api/dgd/partners/nearby - Berlin
# ============================================
echo -e "${YELLOW}[3] GET /api/dgd/partners/nearby (Berlin)${NC}"

RESP=$(curl -s "$API/partners/nearby?lat=52.52&lng=13.40&radius_km=50")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/nearby?lat=52.52&lng=13.40&radius_km=50")

assert "HTTP 200" "200" "$HTTP"

NEARBY_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
assert_gt "Nearby Berlin > 0" 0 "$NEARBY_COUNT"

HAS_DISTANCE=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'distance_km' in d['partners'][0] else 'no')" 2>/dev/null)
assert "Results have distance_km" "yes" "$HAS_DISTANCE"

SORTED=$(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
distances = [p['distance_km'] for p in d['partners']]
print('yes' if distances == sorted(distances) else 'no')
" 2>/dev/null)
assert "Results sorted by distance" "yes" "$SORTED"

echo ""

# ============================================
#  4. GET /api/dgd/partners/nearby - Koeln 80km
# ============================================
echo -e "${YELLOW}[4] GET /api/dgd/partners/nearby (Koeln, 80km)${NC}"

RESP=$(curl -s "$API/partners/nearby?lat=50.94&lng=6.96&radius_km=80")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/nearby?lat=50.94&lng=6.96&radius_km=80")

assert "HTTP 200" "200" "$HTTP"

KOELN_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total',0))" 2>/dev/null)
assert_gt "Nearby Koeln (80km) > 1" 1 "$KOELN_COUNT"

WITHIN_RADIUS=$(echo "$RESP" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if all(p['distance_km'] <= 80 for p in d['partners']) else 'no')
" 2>/dev/null)
assert "All within 80km radius" "yes" "$WITHIN_RADIUS"

echo ""

# ============================================
#  5. GET /api/dgd/partners/nearby - Missing params
# ============================================
echo -e "${YELLOW}[5] GET /api/dgd/partners/nearby (missing params)${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/nearby")
assert "HTTP 400 without lat/lng" "400" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/nearby?lat=52.52")
assert "HTTP 400 without lng" "400" "$HTTP"

echo ""

# ============================================
#  6. GET /api/dgd/partners/{id} - Detail
# ============================================
echo -e "${YELLOW}[6] GET /api/dgd/partners/{id}${NC}"

PARTNER_ID=$(curl -s "$API/partners" | python3 -c "import sys,json; print(json.load(sys.stdin)['partners'][0]['id'])" 2>/dev/null)

RESP=$(curl -s "$API/partners/$PARTNER_ID")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/$PARTNER_ID")

assert "HTTP 200" "200" "$HTTP"

DETAIL_NAME=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['partner']['name'])" 2>/dev/null)
assert_contains "Partner detail has name" "." "$DETAIL_NAME"

echo ""

# ============================================
#  7. GET /api/dgd/partners/{id} - Not found
# ============================================
echo -e "${YELLOW}[7] GET /api/dgd/partners/nonexistent${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/partners/nonexistent-id-12345")
assert "HTTP 404 for unknown partner" "404" "$HTTP"

echo ""

# ============================================
#  8. POST /api/dgd/waitlist - Success
# ============================================
echo -e "${YELLOW}[8] POST /api/dgd/waitlist (valid)${NC}"

UNIQUE_EMAIL="test-$(date +%s)@example.de"
RESP=$(curl -s -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Runner\",\"email\":\"$UNIQUE_EMAIL\",\"phone\":\"+49 123 000\",\"specialty\":\"kfz\",\"plz\":\"10115\",\"city\":\"Berlin\"}")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Runner 2\",\"email\":\"test2-$(date +%s)@example.de\",\"phone\":\"+49 123 001\",\"specialty\":\"kfz\",\"plz\":\"10115\",\"city\":\"Berlin\"}")

assert "HTTP 200" "200" "$HTTP"

SUCCESS=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success', False))" 2>/dev/null)
assert "Response success=True" "True" "$SUCCESS"

HAS_ID=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if d.get('id') else 'no')" 2>/dev/null)
assert "Response has id" "yes" "$HAS_ID"

echo ""

# ============================================
#  9. POST /api/dgd/waitlist - Duplicate
# ============================================
echo -e "${YELLOW}[9] POST /api/dgd/waitlist (duplicate)${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Runner\",\"email\":\"$UNIQUE_EMAIL\",\"phone\":\"+49 123 000\",\"specialty\":\"kfz\",\"plz\":\"10115\",\"city\":\"Berlin\"}")

assert "HTTP 409 for duplicate" "409" "$HTTP"

echo ""

# ============================================
# 10. POST /api/dgd/waitlist - Missing fields
# ============================================
echo -e "${YELLOW}[10] POST /api/dgd/waitlist (missing fields)${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test"}')
assert "HTTP 400 for missing fields" "400" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d '{}')
assert "HTTP 400 for empty body" "400" "$HTTP"

echo ""

# ============================================
# 11. POST /api/dgd/waitlist - Invalid email
# ============================================
echo -e "${YELLOW}[11] POST /api/dgd/waitlist (invalid email)${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/waitlist" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test","email":"not-an-email","phone":"+49 1","specialty":"kfz","plz":"10115","city":"Berlin"}')
assert "HTTP 400 for invalid email" "400" "$HTTP"

echo ""

# ============================================
# 12. GET /api/dgd/geocode - Forward
# ============================================
echo -e "${YELLOW}[12] GET /api/dgd/geocode (forward)${NC}"

RESP=$(curl -s "$API/geocode?q=Berlin")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/geocode?q=Berlin")

assert "HTTP 200" "200" "$HTTP"

GEO_COUNT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))" 2>/dev/null)
assert_gt "Geocode results > 0" 0 "$GEO_COUNT"

GEO_LAT=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if float(d['results'][0]['lat']) > 52 else 'no')" 2>/dev/null)
assert "Berlin lat > 52" "yes" "$GEO_LAT"

echo ""

# ============================================
# 13. GET /api/dgd/geocode - Missing params
# ============================================
echo -e "${YELLOW}[13] GET /api/dgd/geocode (missing params)${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/geocode")
assert "HTTP 400 without query" "400" "$HTTP"

echo ""

# ============================================
# 14. 404 for unknown routes
# ============================================
echo -e "${YELLOW}[14] Unknown routes${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/nonexistent")
assert "HTTP 404 for unknown route" "404" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API/partners")
assert "HTTP 404 for unsupported method" "404" "$HTTP"

echo ""

# ============================================
# 15. Static files served
# ============================================
echo -e "${YELLOW}[15] Static files${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
assert "Index page loads (HTTP 200)" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/js/app.js")
assert "app.js loads (HTTP 200)" "200" "$HTTP"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/css/portal.css")
assert "portal.css loads (HTTP 200)" "200" "$HTTP"

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
