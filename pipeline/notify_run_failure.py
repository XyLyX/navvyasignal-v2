"""Private workflow-failure alert, including failures before the main sender runs."""
import os
try:
    from pipeline.queue_notifications import send_self_alert
except ImportError:
    from queue_notifications import send_self_alert


def run():
    if os.environ.get('DRY_RUN','true').lower() == 'true':
        print('Dry run: workflow failure alert suppressed')
        return
    repository = os.environ.get('GITHUB_REPOSITORY','XyLyX/navvyasignal-v2')
    run_id = os.environ.get('GITHUB_RUN_ID','')
    if repository != 'XyLyX/navvyasignal-v2' or not run_id.isdigit():
        raise ValueError('Invalid workflow identity for private failure alert')
    send_self_alert('NavvyaSignal — workflow failed\n'
        + os.environ.get('GITHUB_WORKFLOW','Editorial pipeline')
        + '\nInspect: https://github.com/'+repository+'/actions/runs/'+run_id)
    print('Workflow failure alert accepted by connected Whapi account')


if __name__ == '__main__':
    run()
