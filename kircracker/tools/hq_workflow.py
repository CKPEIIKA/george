#!/usr/bin/env python3
"""Run checkpoint-aware application tasks under HyperQueue (standard library only).

Queue success means the command and its declared completion gate succeeded.
Mathematical certification remains the responsibility of the application verifier.
Host paths, process identities and resource budgets belong in a local JSON plan.
"""
from __future__ import annotations
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def read(path):
    return json.loads(Path(path).read_text())


def atomic(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + f'.{os.getpid()}.partial')
    tmp.write_text(json.dumps(value, indent=2) + '\n')
    tmp.replace(path)


def identity(pid):
    try:
        p = Path('/proc') / str(pid)
        stat = (p / 'stat').read_text().rsplit(')', 1)[1].split()
        if stat[0] == 'Z':
            return None
        return {'pid': pid, 'startTicks': int(stat[19]),
                'commandSHA256': hashlib.sha256((p / 'cmdline').read_bytes()).hexdigest()}
    except (OSError, ValueError, IndexError):
        return None


def run_task(config_path, name):
    config = read(config_path)
    task = config['tasks'][name]
    state_dir = Path(config['state_dir'])
    state_dir.mkdir(parents=True, exist_ok=True)
    state = {'name': name, 'stage': 'STARTING', 'pid': os.getpid(),
             'started': time.time(), 'hqJob': os.environ.get('HQ_JOB_ID'),
             'hqTask': os.environ.get('HQ_TASK_ID'), 'mathematicalClaim': False}
    stopped = False

    def on_signal(_sig, _frame):
        nonlocal stopped
        stopped = True

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    def save(stage, worker=None):
        state.update(stage=stage, workerPID=worker, unix=time.time())
        atomic(state_dir / (name + '.json'), state)
        if task.get('app_status_file'):
            p = Path(task['app_status_file'])
            app = read(p) if p.exists() else {}
            app.update(stage=stage, workerPID=worker, hqJob=state['hqJob'],
                       hqTask=name, updatedUnix=time.time(), manager='HyperQueue')
            if 'degree' in task:
                app['degree'] = task['degree']
            if stage == 'FINISHED' and task.get('certificate'):
                app['latestCertificate'] = read(task['certificate'])
                app['completedThrough'] = task['degree']
            atomic(p, app)

    with (state_dir / (name + '.lock')).open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        save('STARTING')
        if task.get('wait_process'):
            expected = task['wait_process']
            save('WAITING_FOR_EXISTING_PROCESS', expected['pid'])
            while identity(expected['pid']) == expected:
                if stopped:
                    save('INTERRUPTED')
                    return 130
                time.sleep(1)
            save('FINISHED')
            return 0
        if task.get('completion_gate'):
            gate = task['completion_gate']
            value = read(gate['path'])
            if value.get('requested_degree') != gate['degree'] or not value.get('all_requested_blocks_complete'):
                save('INCOMPLETE_APPLICATION_CHECKPOINTS')
                return 75
            save('FINISHED')
            return 0
        env = os.environ.copy()
        env.update(OMP_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', MKL_NUM_THREADS='1')
        env.update(task.get('env', {}))
        process = subprocess.Popen(task['command'], cwd=task.get('cwd'), env=env,
                                   stdin=subprocess.DEVNULL, start_new_session=True)
        begin = time.monotonic()
        save(task.get('app_stage', 'RUNNING'), process.pid)
        reason = None
        while process.poll() is None:
            available = next(int(x.split()[1]) * 1024 for x in Path('/proc/meminfo').read_text().splitlines()
                             if x.startswith('MemAvailable:'))
            if stopped:
                reason = 'INTERRUPTED'
            elif task.get('seconds') and time.monotonic() - begin > task['seconds']:
                reason = 'TIME_LIMIT'
            elif available < config.get('minimum_available_bytes', 0):
                reason = 'AVAILABLE_MEMORY_LIMIT'
            elif config.get('disk_path'):
                import shutil
                if shutil.disk_usage(config['disk_path']).free < config.get('minimum_disk_free_bytes', 0):
                    reason = 'DISK_FREE_LIMIT'
            if reason:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=task.get('stop_grace_seconds', 15))
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
                break
            time.sleep(1)
        state['returnCode'] = process.returncode
        # An application may finish a scheduling quantum with a saved, unfinished
        # checkpoint. Keep this distinct from both success and a crashed worker.
        # Do not translate it to success: completion/verifier dependencies must
        # stay blocked until a new task is explicitly admitted.
        yielded = process.returncode in task.get('checkpoint_exit_codes', [])
        save(reason or ('CHECKPOINTED_YIELD' if yielded else
                        'FINISHED' if process.returncode == 0 else 'APPLICATION_FAILED'))
        return 75 if reason else process.returncode


def jobfile(config_path):
    config = read(config_path)
    lines = ['name = ' + json.dumps(config['name']), 'max_fails = 1']
    for name, task in config['tasks'].items():
        lines += ['', '[[task]]', f'id = {task["id"]}',
                  'command = ' + json.dumps([sys.executable, str(Path(__file__).resolve()),
                                             'run', str(Path(config_path).resolve()), name]),
                  'stdout = ' + json.dumps(str(Path(config['state_dir']) / (name + '.stdout'))),
                  'stderr = ' + json.dumps(str(Path(config['state_dir']) / (name + '.stderr'))),
                  'crash_limit = \"never-restart\"']
        if 'priority' in task:
            lines.append('priority = ' + str(task['priority']))
        if task.get('deps'):
            lines.append('deps = ' + json.dumps(task['deps']))
        extra = (', ' + config['generation_resource'] + ' = 1'
                 if config.get('generation_resource') else '')
        for request in task.get('resource_variants', [task]):
            memory = (', memMiB = ' + str(request['memory_mib'])
                      if request.get('memory_mib') is not None else '')
            lines += ['[[task.request]]', 'resources = { cpus = ' + str(request['cpus']) +
                      memory + extra + ' }']
    print('\n'.join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    p = sub.add_parser('run')
    p.add_argument('config', type=Path)
    p.add_argument('task')
    p = sub.add_parser('jobfile')
    p.add_argument('config', type=Path)
    args = parser.parse_args()
    if args.action == 'jobfile':
        jobfile(args.config)
        return 0
    try:
        return run_task(args.config, args.task)
    except Exception as exc:
        print(f'{type(exc).__name__}: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
