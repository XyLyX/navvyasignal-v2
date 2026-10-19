"""Explicit, dated one-off recovery. No desk reruns and no public messaging."""
import datetime as dt
import json
import os
from pathlib import Path
from pipeline import editorial_formats as formats
from pipeline import regional_release as release


def request(value, now=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    if value.get('action') != 'recover-editorial-formats' or value.get('policy') != release.POLICY['version']:
        raise ValueError('Recovery request is not explicitly authorized')
    created = dt.datetime.fromisoformat(value['requested_at'].replace('Z','+00:00'))
    if not 0 <= (now-created).total_seconds() < 86400:
        raise ValueError('Recovery request is stale or future-dated')
    edition = value['edition_date']
    if dt.date.fromisoformat(edition).isoformat() != edition or edition > now.astimezone(release.TZ).date().isoformat():
        raise ValueError('Invalid recovery edition')
    return edition


def run(value, run_id):
    edition = request(value)
    if os.environ.get('DRY_RUN','true').lower() == 'true':
        print('DRY RUN: no research, writes, builds or sends')
        return
    result = formats.run(edition)
    # One explicit exceptional build also publishes the code/scheduler/freshness correction.
    release.run(edition, manual_key='editorial-recovery-'+run_id, force_build=True)
    print('EDITORIAL RECOVERY RESULT: '+json.dumps(result), flush=True)
    if any(status in {'held','failed','no_inputs'} for status in result.values()):
        raise RuntimeError('Partial recovery: held or unavailable formats remain private')


if __name__ == '__main__':
    run(json.loads(Path('ops/editorial-recovery-request.json').read_text()), os.environ['GITHUB_RUN_ID'])
