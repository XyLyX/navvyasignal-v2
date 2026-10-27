"""Bounded delayed Claude review of private queue drafts; no new desk research."""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import requests
try:
    from pipeline import main as editor
    from pipeline.queue_notifications import notify_private_draft, send_self_alert, connected_account
except ImportError:
    import main as editor
    from queue_notifications import notify_private_draft, send_self_alert, connected_account

PREFIX = 'V2_QUEUE_RECHECK:'
MAX_ATTEMPTS = 2
INTERVAL = dt.timedelta(hours=1)
UTC = dt.timezone.utc


def text(page, prop):
    value = page.get('properties', {}).get(prop, {})
    return ''.join(p.get('plain_text', p.get('text', {}).get('content', ''))
                   for p in value.get('title', value.get('rich_text', [])))


def private(page):
    return (not page.get('archived') and not page.get('in_trash')
            and page.get('properties', {}).get('Ready to Post', {}).get('checkbox') is False
            and text(page, 'Internal Note').startswith('V2_UNVERIFIED_SIGNAL:'))


def draft(page):
    desk = (page.get('properties', {}).get('Category', {}).get('select') or {}).get('name', '')
    return {'title': text(page, 'Name'), 'body_markdown': text(page, 'Signal Brief'),
            'sources_text': text(page, 'Text 1'), 'desk': desk,
            'desk_ambiguous': desk not in editor.DESKS, 'action': 'update', 'existing_id': page['id']}


def fingerprint(entry):
    return hashlib.sha256(json.dumps([entry.get(k) for k in
        ('title', 'body_markdown', 'sources_text', 'desk')], ensure_ascii=False).encode()).hexdigest()


def state(page, entry):
    for line in text(page, 'Internal Note').splitlines():
        if line.startswith(PREFIX):
            try:
                saved = json.loads(line[len(PREFIX):])
            except ValueError:
                raise RuntimeError('Queue retry state malformed; refusing an unbounded retry')
            if saved.get('fingerprint') == fingerprint(entry):
                return saved
    return {'fingerprint': fingerprint(entry), 'attempts': 0, 'last_attempt': page['created_time']}


def due(saved, now):
    attempts = saved.get('attempts')
    if not isinstance(attempts, int) or not 0 <= attempts < MAX_ATTEMPTS:
        return False
    try:
        last = dt.datetime.fromisoformat(saved['last_attempt'].replace('Z', '+00:00'))
    except (ValueError, KeyError, TypeError):
        return False
    return now - last >= INTERVAL


def note_with_state(note, saved):
    lines = [line for line in note.splitlines() if not line.startswith(PREFIX)]
    return '\n'.join(lines) + '\n' + PREFIX + json.dumps(saved, separators=(',', ':'))


def notion(path, method='GET', body=None):
    response = requests.request(method, 'https://api.notion.com/v1' + path,
        headers=editor.NOTION_HEADERS, json=body, timeout=30)
    if response.status_code not in (200, 201):
        raise RuntimeError('Queue Notion request failed: HTTP ' + str(response.status_code))
    return response.json()


def write_note(page, note, extra=None):
    current = notion('/pages/' + page['id'])
    if not private(current) or current.get('last_edited_time') != page.get('last_edited_time'):
        raise RuntimeError('Draft changed during review; leaving current saved state untouched')
    chunks = editor._rich_text_chunks(note)
    return notion('/pages/' + page['id'], 'PATCH',
        {'properties': dict({'Internal Note': {'rich_text': chunks}}, **(extra or {}))})


def list_queue():
    pages, cursor = [], None
    while True:
        query = {'page_size': 100, 'filter': {'and': [
            {'property': 'Ready to Post', 'checkbox': {'equals': False}},
            {'property': 'Internal Note', 'rich_text': {'starts_with': 'V2_UNVERIFIED_SIGNAL:'}}]},
            'sorts': [{'timestamp': 'created_time', 'direction': 'ascending'}]}
        if cursor: query['start_cursor'] = cursor
        data = notion('/databases/' + editor.NOTION_DATABASE_ID + '/query', 'POST', query)
        pages.extend(data.get('results', []))
        if not data.get('has_more'): return pages
        cursor = data.get('next_cursor')
        if not cursor: raise RuntimeError('Queue pagination incomplete')


def run(limit=3):
    """Notify only. Held stories require the user's manual review through Claude."""
    totals = {'queued':0,'reviewed':0,'approved':0,'discarded':0,'held':0,'errors':0,'alert_errors':0}
    pages=list_queue();totals['queued']=len(pages)
    for page in pages:
        if not private(page) or editor.DRY_RUN: continue
        try:
            notify_private_draft(page['id'],draft(page),text(page,'Internal Note'),editor.NOTION_HEADERS)
        except Exception as error:
            totals['alert_errors']+=1
            print('Private alert failed: '+type(error).__name__)
    print('QUEUE RESULT: '+json.dumps(totals,sort_keys=True))
    if totals['alert_errors']: raise RuntimeError('Private notification failed; no automatic approval attempted')
    return totals


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--test-alert', action='store_true')
    parser.add_argument('--verify-page', default='')
    parser.add_argument('--check-message', default='')
    args = parser.parse_args()
    if not editor.NOTION_API_KEY or not editor.NOTION_DATABASE_ID:
        raise SystemExit('Notion queue credentials missing')
    if args.test_alert and not editor.DRY_RUN:
        account = connected_account()
        print('Whapi connected account verified; recipient is its own number')
        message_id = send_self_alert('NavvyaSignal private queue alerts are connected. New unverified signals will include the headline, reason and private review link.', account)
        print('Test alert accepted; message ID: ' + message_id)
    if args.check_message:
        if not re.fullmatch(r'[A-Za-z0-9_-]{10,100}', args.check_message):
            raise SystemExit('Invalid alert message ID')
        _, headers = connected_account()
        health = requests.get('https://gate.whapi.cloud/health', headers=headers,
                              params={'wakeup': 'false'}, timeout=25)
        if health.status_code == 200:
            print('WHAPI CONNECTION STATE: ' + str(health.json().get('status', {}).get('text', 'not exposed')))
        response = requests.get('https://gate.whapi.cloud/messages/' + args.check_message,
                                headers=headers, timeout=25)
        if response.status_code != 200:
            raise SystemExit('Alert status check failed: HTTP ' + str(response.status_code))
        message = response.json()
        print('WHAPI ALERT STATUS: ' + str(message.get('status', 'not exposed')))
        print('WHAPI ALERT EXISTS: ' + str(message.get('id') == args.check_message))
    if args.verify_page and not editor.DRY_RUN:
        if not re.fullmatch(r'[a-f0-9-]{32,36}', args.verify_page):
            raise SystemExit('Invalid verification page ID')
        page = notion('/pages/' + args.verify_page)
        parent = page.get('parent', {})
        parent_id = parent.get('database_id') or parent.get('data_source_id') or ''
        if parent_id.replace('-', '') != editor.NOTION_DATABASE_ID.replace('-', ''):
            raise SystemExit('Verification target is outside Signal Feed')
        entry = draft(page)
        if not private(page):
            raise SystemExit('Page is not a private unverified draft')
        passed = entry['desk_ambiguous'] is False and editor.has_direct_source_url(entry)
        print('DETERMINISTIC CHECK: ' + json.dumps({
            'passed': passed,
            'note': 'This is not independent fact verification or publication approval.'
        }))

    run()
