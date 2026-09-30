import { TUTORIALS } from './tutorials.js';

// The original files are included in the downloadable George source archive.
export const GUIDE_SOURCES = [
  ['src/inout.sl', 'ALGFORMINPUT and algebraic input/output'],
  ['src/modes.sl', 'Fields, monomial orders, weights and processing modes'],
  ['auxil/topproc.sl', 'SIMPLE, HILBERT and top-level computation procedures'],
  ['src/anick/doc/anick_part_doc.body.tex', 'Original Anick user documentation'],
  ['src/anick/anbetti.sl', 'Internal-degree Betti table conventions'],
  ['src/anick/bnminout.sl', 'Module, factor-algebra and Hochschild input conventions'],
  ['tests/clisp/unix/clisp_list', 'The original sequential regression session'],
];

const text = {
  en: String.raw`
    <h1>User guide</h1>
    <p>This guide follows bergman 1.001's input routines, mode setters, Anick documentation and regression examples. George adds a browser form, cancellation and the documented corrections.</p>
    <nav class="guide-contents" aria-label="Guide sections">
      <a href="#guide-input">Input</a><a href="#guide-options">Fields and orders</a><a href="#guide-results">Results</a><a href="#guide-resolutions">Resolutions</a><a href="#guide-examples">Examples</a><a href="#guide-sources">Sources</a>
    </nav>
    <section id="guide-input"><h2>1. Enter a presentation</h2>
      <p>A noncommutative presentation describes \(A=k\langle x_1,\ldots,x_n\rangle/(f_1,\ldots,f_m)\); a commutative presentation uses \(k[x_1,\ldots,x_n]\). Enter the generators in order, then enter each relation as a polynomial equal to zero.</p>
      <ol><li>Choose a guided example below or enter generators such as <code>x, y</code>.</li><li>Enter expanded polynomials, separated by lines or commas: <code>x^2-y^2, xy</code>. This means \(x^2-y^2=0\) and \(xy=0\).</li><li>Choose a field, order, degree limit and computation; press Compute.</li><li>Open Files or Session to download the exact output and input commands.</li></ol>
      <p>The form accepts integer coefficients, nonnegative integer exponents and products using <code>*</code>. With single-letter generators, <code>xyx</code> means <code>x*y*x</code>. Longer names need explicit multiplication. Names are case sensitive: <code>x</code> and <code>X</code> differ. Expand brackets yourself: write <code>x*y+x</code> for <code>x*(y+1)</code>. Rational arithmetic is exact internally, but fractions and decimal coefficients are not form input syntax.</p>
      <p>In a free associative algebra, \(xy\ne yx\). Switching the Algebra control changes the algebra, rather than merely changing the display.</p>
    </section>
    <section id="guide-options"><h2>2. Fields, orders and degree limits</h2>
      <p>Choose \(\mathbb Q\), \(\mathbb F_2\) or \(\mathbb F_p\) with prime \(p\). Coefficients are reduced in the chosen field. A coefficient divisible by \(p\) vanishes, so changing the field can change the ideal and its basis.</p>
      <p>Generator order affects leading monomials. The default associative order compares degree and then words from the left; the commutative default is degree reverse lexicographic. Reverse variable order, the elimination orders (noncommutative algebras) and the matrix order (commutative algebras) apply the corresponding bergman modes. A matrix must be square and nonsingular, with a positive first row in this interface.</p>
      <p>Weights must be positive integers, one per generator. The weighted degree is \(\deg(x_1^{a_1}\cdots x_n^{a_n})=\sum_i w_i a_i\). Relations such as <code>x^2-z</code> are homogeneous with weights <code>1, 2</code> for <code>x, z</code>.</p>
      <p>A maximal degree bounds the calculation; it does not prove that all higher critical pairs reduce to zero. An unbounded computation may never finish. Stop terminates the current worker, and the next computation starts a fresh session. Form computations are independent; Console commands retain their session.</p>
      <p>For nonhomogeneous relations choose automatic or itemwise processing. Default mode fixes the original nonhomogeneous reduction defects. Safe low-term handling accommodates constants and linear terms. Rabbit is an optional degree-jumping strategy; start with the ordinary strategy when comparing results.</p>
    </section>
    <section id="guide-results"><h2>3. Read and reproduce results</h2>
      <p>The Basis tab highlights the leading term of each printed polynomial and groups output by degree. Read its bound notice even when the raw file contains <code>Done</code>: a bounded calculation can still be partial.</p>
      <p>A Hilbert series records dimensions of graded components: \(H_A(t)=\sum_{d\ge0}\dim_k(A_d)t^d\). For an ordinary polynomial ring on \(n\) generators, \(H_A(t)=(1-t)^{-n}\); for an exterior algebra, \(H_A(t)=(1+t)^n\). Weighted inputs use weighted degrees. Hilbert and Poincaré–Betti computations are different tasks.</p>
      <p>Files contain the raw basis, series, resolution and, when applicable, <code>homology.json</code>. Session records <code>input.bg</code>, <code>session.lsp</code> and terminal output. Copy and Download preserve the original text. Display language and theme do not change any of these algebraic files.</p>
      <p>Legacy mode selects original computational branches, including known defects and the historical empty PB file. Default mode applies the specific fixes listed in the source review. The regression corpus establishes compatibility for those cases; it is not a proof for every experimental command.</p>
    </section>
    <section id="guide-resolutions"><h2>4. Anick resolutions and modules</h2>
      <p>For an Anick resolution, choose noncommutative algebra and an augmentation. Sending generators to 0 requires every relation's constant term to vanish. Sending generators to 1 requires the sum of its coefficients to vanish in the chosen field. For example, \(x^2-1\) admits the second augmentation. George then shifts \(x=u+1\) and labels the displayed resolution accordingly.</p>
      <p>For homogeneous relations, the printed Betti table's column \(i\) is homological degree and row \(r\) means internal degree \(i+r\). Its entry is \(\beta_{i,i+r}\); a dash means zero. The resolution view displays chains and their images in a tensor product.</p>
      <p>For nonhomogeneous relations, internal degree is not preserved. George first completes a basis, constructs the resolution and computes exact ranks of augmented differentials. The ungraded Betti numbers in <code>homology.json</code> are \(\beta_i=\dim C_i-\operatorname{rank}d_i-\operatorname{rank}d_{i+1}\). The original graded table alone is insufficient. Values are reported only where the incoming differential is available, or where a finite zero tail is certified.</p>
      <p>Longer names such as <code>x_1</code> and overlapping names such as <code>a</code> and <code>aa</code> are supported. George reads chains and exact coefficients from <code>resolution.jsonl</code>, a structural export using generator indices. A completed basis is required; increase the bound if completion cannot be certified.</p>
      <p>For right and left modules, module generators are the last generators listed. The two-module task uses the original left/right conventions. Factor-algebra and Hochschild tasks also have specialized variable conventions; start from their supplied regression presets. The original <code>bnminout.sl</code> describes the doubled variables and dummy generators. Do not treat arbitrary algebra relations as a module presentation.</p>
      <p>The Console evaluates complete Lisp forms such as <code>(GETSETUP)</code> and <code>(EXPT 3 40)</code>. It does not provide an interactive stdin dialogue between submissions. Use the presentation form or explicit file-based commands for polynomial input.</p>
    </section>`,
  ru: String.raw`
    <h1>Руководство пользователя</h1>
    <p>Руководство основано на процедурах ввода, настройках, документации Аника и тестовых примерах bergman 1.001. George добавляет браузерную форму, остановку вычислений и документированные исправления.</p>
    <nav class="guide-contents" aria-label="Разделы руководства">
      <a href="#guide-input">Ввод</a><a href="#guide-options">Поля и порядки</a><a href="#guide-results">Результаты</a><a href="#guide-resolutions">Резольвенты</a><a href="#guide-examples">Примеры</a><a href="#guide-sources">Исходники</a>
    </nav>
    <section id="guide-input"><h2>1. Задайте представление</h2>
      <p>Некоммутативное представление задаёт \(A=k\langle x_1,\ldots,x_n\rangle/(f_1,\ldots,f_m)\), коммутативное — фактор-алгебру \(k[x_1,\ldots,x_n]\). Укажите образующие в нужном порядке, затем введите соотношения как многочлены, равные нулю.</p>
      <ol><li>Выберите пример ниже или введите образующие, например <code>x, y</code>.</li><li>Введите раскрытые многочлены, разделяя их строками или запятыми: <code>x^2-y^2, xy</code>. Это означает \(x^2-y^2=0\) и \(xy=0\).</li><li>Выберите поле, порядок, предел степени и задачу; нажмите «Вычислить».</li><li>Во вкладках «Файлы» и «Сессия» можно скачать точный вывод и команды.</li></ol>
      <p>Форма принимает целые коэффициенты, неотрицательные целые показатели и произведения через <code>*</code>. Для однобуквенных образующих <code>xyx</code> означает <code>x*y*x</code>. Длинные имена разделяйте знаком умножения. Регистр важен: <code>x</code> и <code>X</code> различаются. Скобки нужно раскрыть: вместо <code>x*(y+1)</code> введите <code>x*y+x</code>. Внутренняя рациональная арифметика точная, однако дроби и десятичные коэффициенты не входят в синтаксис формы.</p>
      <p>В свободной ассоциативной алгебре \(xy\ne yx\). Переключатель типа алгебры меняет саму алгебру, а не только отображение.</p>
    </section>
    <section id="guide-options"><h2>2. Поля, порядки и предел степени</h2>
      <p>Выберите \(\mathbb Q\), \(\mathbb F_2\) или \(\mathbb F_p\) при простом \(p\). Коэффициенты вычисляются в выбранном поле. Кратный \(p\) коэффициент исчезает, поэтому изменение поля может изменить идеал и его базис.</p>
      <p>Порядок образующих влияет на старшие мономы. Ассоциативный порядок по умолчанию сравнивает степень, затем слова слева; коммутативный — степень, затем обратный лексикографический порядок. Обратный порядок переменных, исключающие порядки (для некоммутативных алгебр) и матричный порядок (для коммутативных) включают соответствующие режимы bergman. В интерфейсе матрица должна быть квадратной и невырожденной, с положительной первой строкой.</p>
      <p>Веса — положительные целые числа, по одному на образующий. Взвешенная степень равна \(\deg(x_1^{a_1}\cdots x_n^{a_n})=\sum_i w_i a_i\). Соотношение <code>x^2-z</code> однородно при весах <code>1, 2</code> для <code>x, z</code>.</p>
      <p>Предел степени ограничивает вычисление, но не доказывает обращение в ноль всех старших критических пар. Неограниченное вычисление может не завершиться. «Стоп» завершает текущий worker; следующее вычисление получает новую сессию. Задачи формы независимы; команды консоли сохраняют состояние сессии.</p>
      <p>Для неоднородных соотношений выберите автоматическую или поэлементную обработку. Режим по умолчанию исправляет исходные ошибки неоднородной редукции. Безопасная обработка младших членов учитывает константы и линейные члены. Rabbit — дополнительная стратегия со скачками по степени; для сравнения результатов начните с обычной стратегии.</p>
    </section>
    <section id="guide-results"><h2>3. Чтение и воспроизведение результатов</h2>
      <p>Вкладка «Базис Грёбнера» выделяет старший член каждого многочлена и группирует вывод по степени. Читайте сообщение о пределе, даже если в исходном файле стоит <code>Done</code>: ограниченный расчёт может дать частичный базис.</p>
      <p>Ряд Гильберта задаёт размерности однородных компонент: \(H_A(t)=\sum_{d\ge0}\dim_k(A_d)t^d\). Для обычного кольца многочленов от \(n\) образующих \(H_A(t)=(1-t)^{-n}\), для внешней алгебры — \(H_A(t)=(1+t)^n\). При весах используются взвешенные степени. Ряды Гильберта и Пуанкаре–Бетти вычисляются разными задачами.</p>
      <p>Во вкладке «Файлы» доступны исходные базисы, ряды, резольвента и, когда применимо, <code>homology.json</code>. «Сессия» содержит <code>input.bg</code>, <code>session.lsp</code> и терминальный вывод. Копирование и скачивание сохраняют оригинальный текст. Язык и тема не меняют алгебраические файлы.</p>
      <p>Режим совместимости выбирает исходные ветви вычислений, включая известные ошибки и исторически пустой PB-файл. Режим по умолчанию включает конкретные исправления из обзора исходников. Тестовый корпус подтверждает совместимость этих случаев, но не доказывает корректность каждой экспериментальной процедуры.</p>
    </section>
    <section id="guide-resolutions"><h2>4. Резольвенты Аника и модули</h2>
      <p>Для резольвенты Аника выберите некоммутативную алгебру и аугментацию. При отображении образующих в 0 свободный член каждого соотношения должен исчезать. При отображении в 1 сумма коэффициентов должна исчезать в выбранном поле. Например, \(x^2-1\) допускает вторую аугментацию. George выполняет сдвиг \(x=u+1\) и помечает полученную резольвенту.</p>
      <p>Для однородных соотношений столбец \(i\) в таблице Бетти означает гомологическую степень, а строка \(r\) — внутреннюю степень \(i+r\). Элемент равен \(\beta_{i,i+r}\); тире означает ноль. В резольвенте показаны цепи и их образы в тензорном произведении.</p>
      <p>Для неоднородных соотношений внутренняя степень не сохраняется. George сначала пополняет базис, строит резольвенту и вычисляет точные ранги аугментированных дифференциалов. Неградуированные числа Бетти в <code>homology.json</code> равны \(\beta_i=\dim C_i-\operatorname{rank}d_i-\operatorname{rank}d_{i+1}\). Одной исходной градуированной таблицы недостаточно. Значения выдаются при наличии входящего дифференциала либо сертифицированного конечного нулевого хвоста.</p>
      <p>Поддерживаются длинные имена, например <code>x_1</code>, и имена с общим префиксом, например <code>a</code> и <code>aa</code>. George читает цепи и точные коэффициенты из <code>resolution.jsonl</code> — структурного экспорта с индексами образующих. Необходим завершённый базис; увеличьте предел, если завершённость не удалось подтвердить.</p>
      <p>Для правых и левых модулей образующие модуля находятся в конце списка. Задача для двух модулей следует исходным соглашениям о левых и правых образующих. Для фактор-алгебр и гомологий Хохшильда действуют отдельные соглашения: начните с готовых тестовых примеров. Исходный <code>bnminout.sl</code> описывает копии переменных и фиктивные образующие. Произвольные соотношения алгебры не являются представлением модуля.</p>
      <p>Консоль вычисляет законченные Lisp-формы, например <code>(GETSETUP)</code> и <code>(EXPT 3 40)</code>. Между отправками она не ведёт интерактивный диалог stdin. Для многочленов используйте форму или команды с явными файлами.</p>
    </section>`,
};

export function guideHTML(language) {
  const ru = language === 'ru';
  language = ru ? 'ru' : 'en';
  return text[language].replace('<h1>', '<h1 id="guideTitle">') + `<section id="guide-examples"><h2>${ru ? '5. Примеры для изучения настроек' : '5. Explore the settings with examples'}</h2>
    <div class="example-cards">${TUTORIALS.map(t => `<article><h3>${t.title[language]}</h3><p>${t.description[language]}</p><button type="button" class="quiet" data-tutorial="${t.id}">${ru ? 'Открыть пример' : 'Load example'}</button></article>`).join('')}</div></section>
    <section id="guide-sources"><h2>${ru ? '6. Исходные материалы' : '6. Original source material'}</h2><p>${ru ? 'Все перечисленные файлы находятся в исходном архиве George. Руководство пересказывает процедуры и примеры; это не копия полного исторического справочника.' : 'All listed files are included in the George source archive. This guide explains the implemented procedures and examples; it is not a copy of the complete historical manual.'}</p>
    <ul>${GUIDE_SOURCES.map(([p]) => `<li><code>vendor/bergman-1.001/${p}</code></li>`).join('')}</ul>
    <p><a href="sources/george-source.tar.gz">${ru ? 'Скачать исходники George и bergman' : 'Download George and bergman sources'}</a></p></section>`;
}
