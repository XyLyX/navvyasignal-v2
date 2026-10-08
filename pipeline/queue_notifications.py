"""Private alerts to the account actually connected to Whapi; never a newsletter."""
import os
import re
import requests


def connected_account():
    token = os.environ.get('WHAPI_TOKEN', '').strip()
    if not token:
        raise RuntimeError('WHAPI_TOKEN is missing')
    headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
    response = requests.get('https://gate.whapi.cloud/health',
                            headers=headers, params={'wakeup': 'false'}, timeout=25)
    if response.status_code != 200:
        raise RuntimeError('Whapi account lookup failed: HTTP ' + str(response.status_code))
    health = response.json()
    connection = health.get('status', {}).get('text', '')
    if connection in ('ERROR', 'SYNC_ERROR', 'QR', 'NOT_INIT', 'INIT', 'LAUNCH'):
        raise RuntimeError('Whapi connection is not ready: ' + connection)
    user = health.get('user', {})
    number = str(user.get('phone') or user.get('id') or '').split('@')[0]
    number = number.removeprefix('+')
    if not re.fullmatch(r'[0-9]{7,15}', number):
        raise RuntimeError('Whapi did not identify its connected account number')
    return number + '@s.whatsapp.net', headers


def send_self_alert(body, account=None):
    recipient, headers = account or connected_account()
    response = requests.post('https://gate.whapi.cloud/messages/text',
                             headers=headers, json={'to': recipient, 'body': body}, timeout=25)
    if response.status_code not in (200, 201):
        raise RuntimeError('Whapi alert rejected: HTTP ' + str(response.status_code))
    data = response.json()
    if data.get('sent') is not True:
        raise RuntimeError('Whapi did not confirm accepting the alert')
    message = data.get('message', {})
    return message.get('id') or data.get('id') or ''


def notify_private_draft(page_id, entry, notes, headers, dry_run=False):
    """Persist a send claim first: ambiguous send failures cannot spam duplicates."""
    if dry_run or '\nV2_QUEUE_ALERT:' in notes:
        return False
    account = connected_account()  # Missing credentials must not create a send claim.
    url = 'https://api.notion.com/v1/pages/' + page_id
    current = requests.get(url, headers=headers, timeout=30)
    if current.status_code != 200:
        raise RuntimeError('Queue alert page read failed')
    page = current.json()
    props = page.get('properties', {})
    fresh = ''.join(x.get('plain_text', x.get('text', {}).get('content', ''))
                    for x in props.get('Internal Note', {}).get('rich_text', []))
    if (page.get('archived') or page.get('in_trash')
            or props.get('Ready to Post', {}).get('checkbox') is not False
            or not fresh.startswith('V2_UNVERIFIED_SIGNAL:') or '\nV2_QUEUE_ALERT:' in fresh):
        return False
    def save(note):
        chunks = [{'text': {'content': note[i:i+1900]}} for i in range(0, len(note), 1900)]
        result = requests.patch(url, headers=headers,
            json={'properties': {'Internal Note': {'rich_text': chunks}}}, timeout=30)
        if result.status_code != 200:
            raise RuntimeError('Queue alert state write failed')
    save(fresh + '\nV2_QUEUE_ALERT:pending')
    body = ('NavvyaSignal — manual review needed\n' + entry.get('title', 'Untitled')[:300]
            + '\nDesk: ' + entry.get('desk', 'Unconfirmed')
            + '\nReason: ' + fresh.split('\n', 2)[-1][:500]
            + '\nReview: https://navvyasignal.com/unverified-signals?id=' + page_id)
    message_id = send_self_alert(body, account)
    # Re-read so a concurrent manual resolution is never overwritten.
    latest = requests.get(url, headers=headers, timeout=30)
    if latest.status_code == 200:
        latest_note = ''.join(x.get('plain_text', x.get('text', {}).get('content', ''))
            for x in latest.json().get('properties', {}).get('Internal Note', {}).get('rich_text', []))
        if '\nV2_QUEUE_ALERT:pending' in latest_note:
            save(latest_note.replace('\nV2_QUEUE_ALERT:pending', '\nV2_QUEUE_ALERT:accepted'))
    print('Private queue alert accepted by Whapi' + ('; message ID recorded' if message_id else ''))
    return True
