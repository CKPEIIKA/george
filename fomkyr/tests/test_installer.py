"""Installer mechanics test against minimal source-shape fixtures, NOT a full George checkout."""
from pathlib import Path
import tempfile,subprocess,json
R=Path(__file__).resolve().parents[1]
files={
 'src/backends.js':'export const BACKENDS = Object.freeze({\n});\n',
 'engine/worker.js':'onmessage = async ({data:{id, command, job, source, backend}}) => {\n  activeId = id;\n};\n',
 'src/engine.js':'class Engine { f(data) {\n      const p = this.pending.get(data.id);\n    this.worker?.terminate();\n} }\n',
 'src/bergman-syntax.js':"function validate(form,job){\n if (!integer(form.memoryMiB, 128, MAX_MEMORY_MIB)) throw Error();\n  job.timeoutMs = timeoutMilliseconds(form.timeoutMinutes);\n}\n",
 'src/app.js':'function render(job,files,res){\n  renderFiles(job, files);\n}\n',
 'index.html':'<select id="backend"></select>\n<select id="memoryMiB" aria-describedby="memoryHint"></select>\n'}
with tempfile.TemporaryDirectory() as td:
 root=Path(td);(root/'package.json').write_text('{"type":"module"}')
 for name,text in files.items():p=root/'web'/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(text)
 def run(*args):return subprocess.run(['python',str(R/'tools/install.py'),str(root),*args],capture_output=True,text=True)
 assert run('--dry-run').returncode==0
 assert all((root/'web'/name).read_text()==text for name,text in files.items())
 p=run();assert p.returncode==0,p.stderr
 snapshot={name:(root/'web'/name).read_text() for name in files}
 assert run().returncode==0
 assert all((root/'web'/name).read_text()==text for name,text in snapshot.items())
 for p in (root/'web').rglob('*.js'):
  a=subprocess.run(['node','--check',str(p)],capture_output=True,text=True);assert a.returncode==0,(str(p),a.stderr)
 assert (root/'web/engine/fomkyr/fomkyr64.wasm').is_file()
 # Unrecognized source must not result in partially changed source files.
 for name,text in files.items():(root/'web'/name).write_text(text)
 (root/'web/src/engine.js').write_text('unrecognized')
 assert run().returncode!=0
 assert (root/'web/src/backends.js').read_text()==files['src/backends.js']
(R/'results/installer-tests.json').write_text(json.dumps({'passed':True,'fixture':'minimal public-source-shaped files, not full checkout','dryRun':True,'idempotent':True,'sourceMismatchRefusal':True,'javascriptSyntax':True},indent=2))
print('Installer source-shape tests passed (not browser integration)')
