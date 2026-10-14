// Console command catalogue: the bergman commands people type most, with
// their arguments as bergman defines them (vendor/bergman-1.001/src,
// auxil/topproc.sl), and George's console shortcuts.  Names are shown in
// lower case; bergman reads commands case-insensitively.

const g = (group, entries) => entries.map(([name, args, en, ru, ex]) => ({ group, name, args, en, ru, ex: ex ?? `(${name}${args ? ' ' + args : ''})` }));

export const GROUPS = [
  { id: 'console', en: 'Console', ru: 'Консоль' },
  { id: 'ring', en: 'Ring and order', ru: 'Кольцо и порядок' },
  { id: 'coeff', en: 'Coefficients, degrees, weights', ru: 'Коэффициенты, степени, веса' },
  { id: 'strategy', en: 'Strategy', ru: 'Стратегия' },
  { id: 'compute', en: 'Computations (input file, output files)', ru: 'Вычисления (входной файл, выходные файлы)' },
  { id: 'setup', en: 'Set-up and memory', ru: 'Настройки и память' },
];

export const COMMANDS = [
  ...g('console', [
    ['help', '[name]', 'List the commands, or explain one: (help setmaxdeg). ?setmaxdeg does the same.', 'Список команд или описание одной: (help setmaxdeg). То же самое: ?setmaxdeg.', '(help setmaxdeg)'],
    ['files', '', 'List the files of this session (George shortcut).', 'Список файлов сеанса (сокращение George).'],
    ['show', '"file"', 'Print a file of this session, e.g. a result (George shortcut).', 'Вывести файл сеанса, например результат (сокращение George).', '(show "result.gb")'],
  ]),
  ...g('ring', [
    ['noncommify', '', 'Work in the free associative (noncommutative) algebra.', 'Свободная ассоциативная (некоммутативная) алгебра.'],
    ['commify', '', 'Work in the commutative polynomial ring.', 'Коммутативное кольцо многочленов.'],
    ['getringtype', '', 'COMMUTATIVE or NONCOMMUTATIVE.', 'COMMUTATIVE или NONCOMMUTATIVE.'],
    ['degleftlexify', '', 'Noncommutative order: degree, then left lexicographic (default).', 'Некоммутативный порядок: по степени, затем левый лексикографический (по умолчанию).'],
    ['elimorder', '', 'Noncommutative elimination order.', 'Некоммутативный исключающий порядок.'],
    ['homogelimorder', '', 'Noncommutative homogeneous elimination order.', 'Некоммутативный однородный исключающий порядок.'],
    ['invelimorder', '', 'Noncommutative inverse elimination order.', 'Некоммутативный обратный исключающий порядок.'],
    ['invwelimorder', '', 'Noncommutative inverse weighted elimination order.', 'Некоммутативный обратный взвешенный исключающий порядок.'],
    ['degrevlexify', '', 'Commutative order: degree reverse lexicographic (default).', 'Коммутативный порядок: степенной обратный лексикографический (по умолчанию).'],
    ['deglexify', '', 'Commutative order: degree lexicographic.', 'Коммутативный порядок: степенной лексикографический.'],
    ['purelexify', '', 'Commutative order: pure lexicographic.', 'Коммутативный порядок: чисто лексикографический.'],
    ['matrixify', '', 'Commutative order given by (setordermatrix …).', 'Коммутативный порядок, заданный (setordermatrix …).'],
    ['setordermatrix', '((row) …)', 'The matrix of the matrix order, one list per row.', 'Матрица матричного порядка, по списку на строку.', '(setordermatrix ((1 1 1) (0 1 0) (0 0 1)))'],
  ]),
  ...g('coeff', [
    ['setmaxdeg', 'n', 'Compute up to degree n; NIL for no limit.', 'Вычислять до степени n; NIL без ограничения.', '(setmaxdeg 6)'],
    ['getmaxdeg', '', 'The current maximal degree.', 'Текущая максимальная степень.'],
    ['setmodulus', 'p', 'Coefficients modulo the prime p; 0 for the rationals.', 'Коэффициенты по модулю простого p; 0 для рациональных чисел.', '(setmodulus 5)'],
    ['getmodulus', '', 'The current characteristic (NIL for the rationals).', 'Текущая характеристика (NIL для рациональных чисел).'],
    ['setmindeg', 'n', 'Lower limit for the degrees considered; for special situations.', 'Нижняя граница степеней; для особых случаев.', '(setmindeg 2)'],
    ['setweights', 'w₁ w₂ …', 'Positive weights of the variables, in order.', 'Положительные веса переменных, по порядку.', '(setweights 1 1 2)'],
    ['clearweights', '', 'All weights back to 1.', 'Все веса снова равны 1.'],
    ['getweights', '', 'The current weights.', 'Текущие веса.'],
  ]),
  ...g('strategy', [
    ['setdegreewise', '', 'Process degree by degree (default; needs homogeneous relations).', 'Обработка по степеням (по умолчанию; нужны однородные соотношения).'],
    ['setitemwise', '', 'Process item by item, for nonhomogeneous relations.', 'Обработка по элементам, для неоднородных соотношений.'],
    ['stabilise', '', 'Leading monomials are stable (default).', 'Старшие мономы устойчивы (по умолчанию).'],
    ['destabilise', '', 'Leading monomials may change, as for nonhomogeneous relations.', 'Старшие мономы могут меняться, как у неоднородных соотношений.'],
    ['setsafelowtermshandling', '', 'Safe low terms handling, needed for linear relations.', 'Надёжная обработка младших членов, нужна для линейных соотношений.'],
    ['setquicklowtermshandling', '', 'Quick low terms handling (default).', 'Быстрая обработка младших членов (по умолчанию).'],
    ['setstrategy', 'name', 'DEFAULT, RABBIT or SAWS.', 'DEFAULT, RABBIT или SAWS.', '(setstrategy rabbit)'],
    ['setrabbit', 'start step finish', 'Degrees for the Rabbit strategy.', 'Степени для стратегии Rabbit.', '(setrabbit 2 2 8)'],
    ['setinterruptstrategy', 'name', 'ORDINARY, or MINHILBLIMITS to stop degrees at Hilbert series minima.', 'ORDINARY или MINHILBLIMITS: завершать степени по минимумам ряда Гильберта.', '(setinterruptstrategy minhilblimits)'],
    ['sethseriesminima', 'm₁ m₂ …', 'Hilbert series minima per degree: numbers, SKIPCDEG or IGNORECDEG.', 'Минимумы ряда Гильберта по степеням: числа, SKIPCDEG или IGNORECDEG.', '(sethseriesminima 1 3 3 1)'],
    ['setalgoutmode', 'mode', 'Output format: ALG, MACAULAY, PBOUT or LISP.', 'Формат вывода: ALG, MACAULAY, PBOUT или LISP.', '(setalgoutmode macaulay)'],
  ]),
  ...g('compute', [
    ['simple', '"in" "out"', 'Gröbner basis of the relations in the input file.', 'Базис Грёбнера соотношений из входного файла.', '(simple "input.bg" "out.gb")'],
    ['stagsimple', '"in" "out"', 'Gröbner basis by the staggered algorithm (SAWS), commutative.', 'Базис Грёбнера расслоением (SAWS), коммутативный случай.', '(stagsimple "input.bg" "out.gb")'],
    ['rabbit', '"in" "out"', 'Gröbner basis by the Rabbit strategy.', 'Базис Грёбнера стратегией Rabbit.', '(rabbit "input.bg" "out.gb")'],
    ['hilbert', '"in" "gb" "hs"', 'Commutative Gröbner basis and Hilbert series.', 'Коммутативный базис Грёбнера и ряд Гильберта.', '(hilbert "input.bg" "out.gb" "out.hs")'],
    ['ncpbhgroebner', '"in" "gb" "pb" "hs"', 'Gröbner basis, Poincaré–Betti and Hilbert series.', 'Базис Грёбнера, ряды Пуанкаре–Бетти и Гильберта.', '(ncpbhgroebner "input.bg" "out.gb" "out.pb" "out.hs")'],
    ['anick', '"in" "out"', 'Gröbner basis for the Anick resolution; then calculateanickresolutiontolimit.', 'Базис Грёбнера для резольвенты Аника; затем calculateanickresolutiontolimit.', '(anick "input.bg" "out.gb")'],
    ['calculateanickresolutiontolimit', 'n', 'Build the Anick resolution up to degree n.', 'Построить резольвенту Аника до степени n.', '(calculateanickresolutiontolimit (getmaxdeg))'],
    ['anickdisplay', '', 'Print the Anick resolution and Betti numbers.', 'Вывести резольвенту Аника и числа Бетти.'],
    ['printbetti', '', 'Print the Betti numbers computed so far.', 'Вывести вычисленные числа Бетти.'],
    ['modulebettinumbers', '"in" "out"', 'Betti numbers of a right module (last nmodgen variables).', 'Числа Бетти правого модуля (последние nmodgen переменных).', '(modulebettinumbers "input.bg" "out.gb")'],
    ['leftmodulebettinumbers', '"in" "out"', 'Betti numbers of a left module.', 'Числа Бетти левого модуля.', '(leftmodulebettinumbers "input.bg" "out.gb")'],
    ['twomodbettinumbers', '"in" "out"', 'Betti numbers for a left and a right module.', 'Числа Бетти для левого и правого модулей.', '(twomodbettinumbers "input.bg" "out.gb")'],
    ['factalgbettinumbers', '"in" "out"', 'Betti numbers of a factor-algebra.', 'Числа Бетти факторалгебры.', '(factalgbettinumbers "input.bg" "out.gb")'],
    ['hochschild', '"in" "out"', 'Hochschild homology.', 'Гомологии Хохшильда.', '(hochschild "input.bg" "out.gb")'],
  ]),
  ...g('setup', [
    ['printsetup', '', 'Print every mode setting.', 'Вывести все настройки режимов.'],
    ['getsetup', '', 'The settings as a list, for setsetup.', 'Настройки в виде списка, для setsetup.'],
    ['setsetup', "'setup", 'Restore settings from a list like the one getsetup returns.', 'Восстановить настройки из списка, как у getsetup.', "(setsetup (getsetup))"],
    ['setlegacymode', 't|nil', 'T reproduces bergman 1.001 exactly; NIL applies George’s fixes.', 'T — в точности как bergman 1.001; NIL — с исправлениями George.', '(setlegacymode t)'],
    ['getlegacymode', '', 'Whether legacy mode is on.', 'Включён ли режим совместимости.'],
    ['clearring', '', 'Forget the variables and the ring.', 'Забыть переменные и кольцо.'],
    ['clearideal', '', 'Forget the relations and the basis.', 'Забыть соотношения и базис.'],
    ['clearall', '', 'Forget everything computed.', 'Забыть всё вычисленное.'],
  ]),
];

export const BY_NAME = new Map(COMMANDS.map((c) => [c.name, c]));

// Completion order: the catalogue first, then common Lisp words.
export const COMPLETIONS = [...COMMANDS.map((c) => c.name),
  'quote', 'setq', 'list', 'car', 'cdr', 'cons', 'print', 'prin2', 'terpri', 'load', 'hseries', 'nil', 't'];

// George's console shortcuts, expanded to standard Common Lisp before
// evaluation, package-qualified because bergman redefines some names, such
// as MAPCAR, with Standard Lisp argument order. Returns the Lisp source, or
// null when the input is not a shortcut.
export function expandShortcut(src) {
  const s = src.trim();
  if (/^\(\s*files\s*\)$/i.test(s)) {
    return '(cl:mapcar (function cl:file-namestring) (cl:directory "*.*"))';
  }
  const m = /^\(\s*show\s+("(?:[^"\\]|\\.)*")\s*\)$/i.exec(s);
  if (m) {
    return `(with-open-file (s ${m[1]}) (loop for l = (read-line s nil) while l do (write-line l)))`;
  }
  return null;
}

// (help), (help name), ?name and ?  →  { name } or { name: null } ; else null.
export function parseHelp(src) {
  const s = src.trim();
  let m = /^\?\s*([^\s()]*)$/.exec(s);
  if (m) return { name: m[1] ? m[1].toLowerCase() : null };
  m = /^\(\s*help(?:\s+'?([^\s()]+))?\s*\)$/i.exec(s);
  if (m) return { name: m[1] ? m[1].toLowerCase() : null };
  return null;
}

// Entries of bergman's own help file (doc/helptexts): topics are separated
// by form feeds, each starting with its name.
export function parseHelpTexts(text) {
  const map = new Map();
  for (const chunk of text.split('\f')) {
    const body = chunk.replace(/^\s+/, '');
    if (!body || body.startsWith('NIL Updated')) continue;
    const nl = body.search(/\s/);
    const name = (nl < 0 ? body : body.slice(0, nl)).toLowerCase();
    const rest = nl < 0 ? '' : body.slice(nl).replace(/^\s*\n/, '').trimEnd();
    if (name && name !== 'nil' && rest && !map.has(name)) map.set(name, rest);
  }
  return map;
}
