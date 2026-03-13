#!/usr/bin/env python3
"""
Trello Board JSON -> DGD Dashboard CRM Import
Parses Trello export with Crmble plugin data and sends contacts
to the CRM API in batches. Handles 17MB+ files locally.

Usage: python trello_import.py <trello_export.json>
"""

import json
import re
import sys
import urllib.request
import urllib.parse
import http.cookiejar

API_BASE = "https://dgd.digital/dashboard/api"
LOGIN_USER = "daguirre"
LOGIN_PASS = "Dklf-dfmdf-7df9j"

# Crmble field ID -> human readable mapping (from board pluginData)
CRMBLE_FIELD_MAP = {
    'firstName': 'firstName',
    'lastName': 'lastName',
    'phone': 'phone',
    'email': 'email',
    'company': 'company',
    'jobTitle': 'jobTitle',
    '_90b3': 'street',
    '_9520': 'house_number',
    '_9e4e': 'zip',
    '_bafd': 'city',
    '_ab85': 'state',
    '_af5b': 'website',
    '_b8a5': 'business_type',
}

# Trello list name keywords -> CRM pipeline stages
STAGE_MAPPING = {
    'lead':         ['lead', 'leads', 'neue leads', 'new', 'neu', 'eingang', 'backlog', 'zukunft', 'adyoucate'],
    'kontakt':      ['anrufen', 'wiedervorlage', 'wv', 'setting', 'kontakt', 'kontaktiert', 'vor-ort'],
    'registriert':  ['registriert'],
    'verifiziert':  ['verifiziert'],
    'geprueft':     ['geprueft', 'geprüft', 'mustergutachten'],
    'aktiviert':    ['aktiviert'],
    'plan_b':       ['plan b'],
    'reaktivieren': ['reaktivieren'],
    'verloren':     ['verloren', 'lost', 'ungeeignet', 'abgelehnt', 'kein interesse'],
}

GA_PATTERN = re.compile(r'(\d+)\s*GAs?', re.IGNORECASE)
EMAIL_PATTERN = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')
PHONE_PATTERN = re.compile(r'(?:\+?\d[\d\s\/-]{6,}|\d{3,5}[\s\/-]\d{3,})')


def api_session():
    """Create authenticated session"""
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    login_data = json.dumps({"username": LOGIN_USER, "password": LOGIN_PASS}).encode()
    req = urllib.request.Request(f"{API_BASE}/auth/login", data=login_data,
                                 headers={"Content-Type": "application/json"})
    resp = opener.open(req)
    result = json.loads(resp.read())
    if not result.get('success'):
        print(f"Login failed: {result}")
        sys.exit(1)
    print(f"Logged in as {result['user']['display_name']}")
    return opener


def api_create_contact(opener, contact_data):
    """Create a single CRM contact"""
    data = json.dumps(contact_data).encode('utf-8')
    req = urllib.request.Request(f"{API_BASE}/crm/contacts", data=data,
                                 headers={"Content-Type": "application/json"})
    try:
        resp = opener.open(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        return {"success": False, "error": f"HTTP {e.code}: {body[:200]}"}


def extract_crmble_fields(card):
    """Extract structured contact data from Crmble pluginData"""
    fields = {}
    for pd in card.get('pluginData', []):
        val = pd.get('value', '')
        if isinstance(val, str) and 'CRMBLE_CARD_CONTACT' in val:
            try:
                parsed = json.loads(val)
                contact = parsed.get('CRMBLE_CARD_CONTACT', {})
                for f in contact.get('crmbleFieldsValues', []):
                    fid = f.get('id', '')
                    raw = f.get('value')
                    if isinstance(raw, bool):
                        fval = ''
                    else:
                        fval = str(raw or '').strip()
                    if fval and fid in CRMBLE_FIELD_MAP:
                        fields[CRMBLE_FIELD_MAP[fid]] = fval
            except json.JSONDecodeError:
                pass
            break
    return fields


def determine_stage(list_name):
    """Map Trello list name to CRM pipeline stage"""
    lower = list_name.lower()
    for stage, keywords in STAGE_MAPPING.items():
        for kw in keywords:
            if kw.lower() in lower:
                return stage
    return 'lead'


def extract_ga_count(list_name):
    """Extract GA count from list name like '5 GA', '10 GAs'"""
    m = GA_PATTERN.search(list_name)
    return int(m.group(1)) if m else 0


def build_contact(card, list_map, member_map):
    """Build CRM contact dict from Trello card"""
    name = (card.get('name') or '').strip()
    if not name or name == '---':
        return None

    crmble = extract_crmble_fields(card)
    desc = card.get('desc', '')

    # Contact fields: Crmble priority, fallback to description parsing
    email = crmble.get('email', '')
    phone = crmble.get('phone', '')
    org = crmble.get('company', '')
    job_title = crmble.get('jobTitle', '')
    street = crmble.get('street', '')
    house_nr = crmble.get('house_number', '')
    if house_nr:
        street = f"{street} {house_nr}".strip()
    zip_code = crmble.get('zip', '')
    city = crmble.get('city', '')
    state = crmble.get('state', '')
    website = crmble.get('website', '')
    business_type = crmble.get('business_type', '')

    # Fallback parsing from description
    if not email:
        m = EMAIL_PATTERN.search(desc)
        if m:
            email = m.group(0)
    if not phone:
        m = PHONE_PATTERN.search(desc)
        if m:
            phone = m.group(0).strip()
    if not org:
        m = re.search(r'(?:firma|unternehmen|company|org)[:\s]+(.+)', desc, re.IGNORECASE)
        if m:
            org = m.group(1).strip()

    # Pipeline stage from list name
    list_name = list_map.get(card.get('idList', ''), '')
    stage = determine_stage(list_name)
    ga_count = extract_ga_count(list_name)
    if ga_count > 0 and stage == 'lead':
        stage = 'aktiviert'

    # Labels -> tags
    tags = [l['name'] for l in card.get('labels', []) if l.get('name')]
    if list_name:
        tags.append(f'trello:{list_name}')

    # Assignee
    assigned = ''
    member_ids = card.get('idMembers', [])
    if member_ids:
        assigned = member_map.get(member_ids[0], '')

    # Follow-up from due date
    followup = None
    if card.get('due'):
        followup = card['due'][:10]

    return {
        'name': name,
        'email': email,
        'phone': phone,
        'organization': org,
        'job_title': job_title,
        'business_type': business_type,
        'website': website,
        'street': street,
        'zip': zip_code,
        'city': city,
        'state': state,
        'pipeline_stage': stage,
        'ga_count': ga_count,
        'assigned_to': assigned,
        'next_followup': followup,
        'notes': desc,
        'tags': json.dumps(tags),
        'source': 'trello',
        'trello_card_id': card.get('id', ''),
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python trello_import.py <trello_export.json>")
        sys.exit(1)

    json_path = sys.argv[1]
    print(f"Loading {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        board = json.load(f)

    print(f"Board: {board.get('name', '?')}")

    # Build lookups
    list_map = {l['id']: l['name'] for l in board.get('lists', []) if not l.get('closed', False)}
    # Also include closed lists for cards that reference them
    for l in board.get('lists', []):
        if l['id'] not in list_map:
            list_map[l['id']] = l.get('name', '')

    member_map = {m['id']: m.get('fullName', m.get('username', '')) for m in board.get('members', [])}

    # Filter open cards
    cards = [c for c in board.get('cards', []) if not c.get('closed', False)]
    print(f"Open cards to import: {len(cards)}")

    # Login
    opener = api_session()

    # Import
    imported = 0
    skipped = 0
    errors = 0

    for i, card in enumerate(cards):
        contact = build_contact(card, list_map, member_map)
        if not contact:
            skipped += 1
            continue

        result = api_create_contact(opener, contact)
        if result.get('success'):
            imported += 1
        elif 'UNIQUE constraint' in str(result.get('error', '')) or 'already' in str(result.get('error', '')).lower():
            skipped += 1
        else:
            errors += 1
            if errors <= 5:
                print(f"  Error on '{contact['name']}': {result.get('error', result.get('message', '?'))}")

        if (i + 1) % 100 == 0:
            print(f"  Progress: {i+1}/{len(cards)} (imported: {imported}, skipped: {skipped}, errors: {errors})")

    print(f"\nDone!")
    print(f"  Imported: {imported}")
    print(f"  Skipped:  {skipped}")
    print(f"  Errors:   {errors}")
    print(f"  Total:    {len(cards)}")


if __name__ == '__main__':
    main()
