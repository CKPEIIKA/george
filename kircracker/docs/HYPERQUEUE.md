# HyperQueue workflow adapter

`tools/hq_workflow.py` runs application commands with explicit task dependencies,
resource requests, task status files and completion gates. It uses the Python
standard library and the `hq` command-line client. HyperQueue is optional.

The adapter targets HyperQueue 0.27.0. Install the official binary for the target
architecture and verify its release digest before use. See the upstream
[installation instructions](https://it4innovations.github.io/hyperqueue/stable/installation/).

## Start a bounded pool

For example, reserve two logical execution slots and an 8 GiB memory scheduling
budget for this queue:

```sh
hq server start --host 127.0.0.1 --journal "$PWD/queue.journal"
hq worker start --cpus 2 --detect-resources none \
  --resource 'memMiB=sum(8192)' --on-server-lost finish-running
```

Run the server and worker in separate persistent sessions. Preserve the server directory
and journal. When using a custom server directory, pass `--server-dir` to every
command or set `HQ_SERVER_DIR`.

CPU and memory resource declarations are scheduling budgets. They are not a
physical memory limit. Size each task request from its observed peak and expected
growth, with headroom. When HyperQueue owns admission, avoid separate hardcoded RSS
thresholds or address-space limits that can stop a progressing task despite free RAM.
Algorithm workspace parameters remain application settings; they are not an extra
scheduler. Reserve room for the OS and every process outside the queue. A partially migrated
workflow must use a pool smaller than the host's total capacity.

## Local plan

Keep machine paths and live process identities in a local, ignored JSON file.
A minimal plan has the following form:

```json
{
  "name": "checkpoint-workflow",
  "state_dir": "/data/work/queue-tasks",
  "minimum_available_bytes": 0,
  "disk_path": "/data/work",
  "minimum_disk_free_bytes": 10737418240,
  "tasks": {
    "compute": {
      "id": 0,
      "cpus": 2,
      "memory_mib": 8192,
      "seconds": 7200,
      "command": ["/path/to/driver", "--resume", "--workers", "2"]
    },
    "verify": {
      "id": 1,
      "deps": [0],
      "cpus": 1,
      "memory_mib": 1024,
      "command": ["/path/to/independent-verifier", "/data/work"]
    }
  }
}
```

Create the state directory before submission, then generate and submit the DAG:

```sh
mkdir -p /data/work/queue-tasks
python3 tools/hq_workflow.py jobfile local-plan.json > workflow.toml
hq job submit-file workflow.toml
hq job list
hq task list 1
```

One task holds one lock in the plan's state directory. Use only one owning
workflow per application workspace. Do not independently start another writer
while the queue owns it.

### Checkpoint boundary migration

The `wait_process` task accepts an identity returned by the adapter's `identity`
function: PID, Linux start ticks and command digest. It waits for that exact
process to disappear or change identity. This is a handoff mechanism, not process
adoption: existing arithmetic remains outside HyperQueue until it ends.

Before handing off, disable the previous launcher's *future* dispatch while
allowing its current numerical children to finish. Submit the replacement DAG
successfully before retiring that launcher. A failed queue submission must leave
the old launcher able to continue.

For compatible degree drivers, a `completion_gate` task checks
`requested_degree` and `all_requested_blocks_complete` in a progress JSON file.
It must follow computation and precede the independent verifier. An incomplete
checkpoint set fails the task, so higher-degree dependencies remain blocked.
The numerical driver itself must validate checkpoint signatures and integrity.

### Status and failure

Each task writes its own JSON status plus queue stdout/stderr files. It can also
update an application status file through `app_status_file`; use `app_stage`,
`degree` and `certificate` for a degree-based application.

- Queue completion means command completion and any configured checkpoint gate.
- Mathematical exactness comes from the application's independent certificate.
- Modular dimensions do not become rational dimensions because the queue task
  succeeded.
- Timeout, an explicitly enabled available-RAM guard, or insufficient disk fails the task. The
  command's process group is terminated; already atomic checkpoints remain.
- Crash restart is disabled (`never-restart`). Retry only after understanding the
  failure and confirming that no previous writer still owns the workspace.

For applications that return a distinct code after saving an unfinished checkpoint,
set `checkpoint_exit_codes`, for example `[75]`. The adapter then records
`CHECKPOINTED_YIELD`, rather than `APPLICATION_FAILED`. The nonzero exit code is
preserved: dependent completion gates and verifiers must not run as though the
mathematical calculation finished. A workflow coordinator can inspect the saved
checkpoint and explicitly submit a continuation.

## Fair continuation and measurable progress

An application window should release its queue allocation after saving. An
unbounded loop of windows inside one task prevents other queued calculations
from being admitted, even when each inner window has a time limit. Submit a new
task for the next window and record its predecessor checkpoint.

Check progress at the same granularity that can be restored. If only completed
degrees are saved, repeated timeouts within one degree can discard the same work
repeatedly. Add a checkpoint inside the degree, or justify a longer uninterrupted
window; do not automatically retry an unchanged failed window. Persist completed
search cursors as well as arithmetic rows so resuming does not repeat exhausted
context enumeration.

Keep separate records for:

- Process activity: live identity, CPU time, current phase and heartbeat.
- Saved work: block, row, source cursor and checkpoint generation.
- Proof progress: newly replayed independent witnesses, accepted relations,
  closed components and verified bound changes.
- Remaining dependency: the missing coordinate map, relation family, exact
  reconstruction, or independent replay.

An exhausted finite candidate family is not a completed proof. A growing pivot
bank is not a percentage of completion. A successful storage check does not
establish a new mathematical result. Status must also be reconciled with process
termination, so a killed worker cannot remain labelled `DISCOVERY` indefinitely.

HyperQueue journals retain queue state; they do not save a solver's RAM. Resuming
an application still requires its own committed checkpoints. Do not delete those
checkpoints when cleaning queue logs.

Task `priority` controls dispatch order. `stop_grace_seconds` must allow the
application to finish an atomic checkpoint (the default is 15 seconds). Set
`minimum_available_bytes` to zero when the queue is the sole admission authority;
this disables the adapter's optional RAM guard. Scheduling reservations do not
enforce actual process RSS: inspect usage and revise requests at checkpoint boundaries.

For nonnumeric process-identity watchers, `memory_mib: null` omits the memory
resource request; reserve infrastructure headroom for these small control
processes. Numerical tasks must declare their memory request. Fractional CPU
requests can keep watchers from reserving an arithmetic core.
