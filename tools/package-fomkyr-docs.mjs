// Render the subproject README as a lightweight standalone manual page.
import fs from 'node:fs';

const escape = value => value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const sourceURL = new URL('https://github.com/CKPEIIKA/george/blob/main/fomkyr/');
function inline(text) {
  const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/);
  return tokens.map(token => {
    if (token.startsWith('`')) return '<code>' + escape(token.slice(1,-1)) + '</code>';
    if (token.startsWith('**')) return '<strong>' + escape(token.slice(2,-2)) + '</strong>';
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
    if (link) return '<a href="' + escape(new URL(link[2],sourceURL).href) + '">' + escape(link[1]) + '</a>';
    return escape(token);
  }).join('');
}
const lines = fs.readFileSync('fomkyr/README.md','utf8').split('\n'), blocks=[];
for (let i=0;i<lines.length;) {
  if (!lines[i].trim()) {i++;continue;}
  if (lines[i].startsWith('```')) {
    const code=[];i++;
    while (i<lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
    if (i===lines.length) throw new Error('Unclosed manual code block');
    blocks.push('<pre><code>' + escape(code.join('\n')) + '</code></pre>');i++;continue;
  }
  const heading=/^(#{1,3}) (.+)$/.exec(lines[i]);
  if (heading) {
    const n=heading[1].length;
    blocks.push(`<h${n} id="${heading[2].toLowerCase().replace(/[^a-z0-9]+/g,'-')}">${inline(heading[2])}</h${n}>`);i++;continue;
  }
  if (lines[i].startsWith('|')) {
    const rows=[];
    while (i<lines.length && lines[i].startsWith('|')) rows.push(lines[i++].split('|').slice(1,-1).map(c=>c.trim()));
    if (!rows[1]?.every(cell=>/^:?-+:?$/.test(cell))) throw new Error('Invalid manual table header');
    const row=(cells,tag)=>'<tr>'+cells.map(cell=>`<${tag}>${inline(cell)}</${tag}>`).join('')+'</tr>';
    blocks.push('<div class="table-scroll"><table><thead>'+row(rows[0],'th')+'</thead><tbody>'+rows.slice(2).map(c=>row(c,'td')).join('')+'</tbody></table></div>');continue;
  }
  const paragraph=[];
  while (i<lines.length && lines[i].trim() && !/^(?:#{1,3} |```|\|)/.test(lines[i])) paragraph.push(lines[i++]);
  blocks.push('<p>'+inline(paragraph.join(' '))+'</p>');
}
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fomkyr — manual</title><meta name="description" content="Fomkyr: exact homogeneous noncommutative Gröbner bases. Capabilities, settings, output, source and build reference.">
<style>
:root{color-scheme:light dark;--ink:#17222e;--paper:#fafaf7;--edge:#d8dedc;--link:#185e78}
@media(prefers-color-scheme:dark){:root{--ink:#dae2eb;--paper:#111c28;--edge:#354353;--link:#93cbdc}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:17px/1.65 Georgia,serif}
main{max-width:940px;margin:auto;padding:28px 26px 64px}nav{font:14px/1.5 system-ui,sans-serif;border-bottom:1px solid var(--edge);padding-bottom:14px;margin-bottom:24px}
a{color:var(--link)}h2{font:600 19px/1.4 ui-monospace,monospace;letter-spacing:.06em;margin:35px 0 12px}
p{margin:12px 0}code{font:14px/1.6 ui-monospace,monospace;overflow-wrap:anywhere}pre{padding:16px;border:1px solid var(--edge);overflow:auto}pre code{white-space:pre;overflow-wrap:normal}
.table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font:14px/1.55 system-ui,sans-serif}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--edge);padding:10px}th{font-weight:600}
@media(max-width:600px){main{padding:18px 16px 40px}body{font-size:16px}th,td{padding:7px}pre code{font-size:12px}}
</style></head><body><main><nav><a href="../#compute">George</a> · <a href="../#guide-fomkyr">User guide</a> · <a href="${sourceURL.href}README.md">Source README</a></nav>
${blocks.join('\n')}
</main></body></html>\n`;
fs.mkdirSync('web/fomkyr',{recursive:true});
fs.writeFileSync('web/fomkyr/index.html',html);
console.log('Packaged Fomkyr manual from fomkyr/README.md.');
