// Deterministic presentations with bounded starting degrees.
import { EXAMPLES } from './examples.js';
import { exampleForm } from './bergman-syntax.js';
import { TUTORIAL_PRESENTATIONS } from './tutorial-presentations.js';
import { FOMKYR_DEFAULTS } from './fomkyr-options.js';

export const TUTORIALS = [
  { id: 'hilbert', example: 'hilb',
    title: { en: 'Commutative quotient and Hilbert series', ru: 'Коммутативная алгебра и ряд Гильберта' },
    description: { en: 'Use a commutative quotient over Q. Compare its basis, rational Hilbert series and dimensions by degree.', ru: 'Коммутативная фактор-алгебра над Q. Сравните базис, рациональный ряд Гильберта и размерности однородных компонент.' } },
  { id: 'char2', example: 'char2',
    title: { en: 'Arithmetic in characteristic 2', ru: 'Арифметика в характеристике 2' },
    description: { en: 'Coefficients are reduced modulo 2. Run the same presentation over Q to see how characteristic changes the basis.', ru: 'Коэффициенты вычисляются по модулю 2. Повторите вычисление над Q и сравните базисы.' } },
  { id: 'char5', example: 'char5',
    title: { en: 'An odd prime field', ru: 'Поле нечётной характеристики' },
    description: { en: 'Select F_p with p = 5. All division uses inverses in the prime field; composite moduli are rejected.', ru: 'Выберите F_p при p = 5. Деление использует обратные элементы конечного поля; составные модули не допускаются.' } },
  { id: 'weights', example: 'simp_weight_nc',
    title: { en: 'Weighted degree', ru: 'Взвешенная степень' },
    description: { en: 'The weights 1, 1, 2 make the third generator count twice. The degree limit and homogeneity check use these weights.', ru: 'Веса 1, 1, 2 придают третьему образующему степень 2. Предел степени и проверка однородности учитывают эти веса.' } },
  { id: 'matrix', example: 'matrix',
    title: { en: 'A matrix monomial order', ru: 'Матричный порядок мономов' },
    description: { en: 'The commutative example uses a full-rank order matrix with a positive first row. Change the order and compare leading monomials.', ru: 'Коммутативный пример использует невырожденную матрицу порядка с положительной первой строкой. Измените порядок и сравните старшие мономы.' } },
  { id: 'anick', example: 'anick_tm',
    title: { en: 'Anick chains and graded Betti numbers', ru: 'Цепи Аника и градуированные числа Бетти' },
    description: { en: 'Inspect the chains, their differentials and the internal-degree Betti table. The maximal degree bounds how much of the resolution is available.', ru: 'Просмотрите цепи, дифференциалы и таблицу градуированных чисел Бетти. Предел степени ограничивает вычисленную часть резольвенты.' } },
  { id: 'monoid',
    title: { en: 'A group relation and monoid augmentation', ru: 'Групповое соотношение и моноидная аугментация' },
    description: { en: 'For x² = 1 with a free generator y, send generators to 1. The resolution uses shifted generators and reports ungraded homology.', ru: 'Для x² = 1 и свободного образующего y выберите аугментацию в 1. Резольвента использует сдвинутые образующие и вычисляет неградуированные гомологии.' },
    form: { vars: ['x', 'y'], rels: ['x^2-1'], task: 'anick', augmentation: 'monoid', nonhomog: 'itemwise' } },
  { id: 'nonhomogeneous',
    title: { en: 'A nonhomogeneous idempotent', ru: 'Неоднородное идемпотентное соотношение' },
    description: { en: 'For x² = x, use itemwise completion and augmentation to 0. Compare the ungraded Betti numbers with the raw graded table; the latter is insufficient here.', ru: 'Для x² = x используйте поэлементное пополнение и аугментацию в 0. Сравните неградуированные числа Бетти с исходной градуированной таблицей: здесь её недостаточно.' },
    form: { vars: ['x', 'y'], rels: ['x^2-x'], task: 'anick', augmentation: 'graded', nonhomog: 'itemwise' } },
  { id: 'fk6',
    title: { en: 'Fomin–Kirillov algebra FK6', ru: 'Алгебра Фомина–Кириллова FK6' },
    description: { en: '15 generators and 100 quadratic relations in the original order. Starts through degree 11 with the optional FK6 dimension profile, large-row memory settings and automatic workers. Increase the degree for longer runs; imported dimensions remain explicit assumptions.', ru: '15 образующих и 100 квадратичных соотношений в исходном порядке. Начальная степень — 11; включены профиль размерностей FK6, память для больших строк и автоматический выбор потоков. Для длительных вычислений увеличьте степень. Импортированные размерности остаются явным допущением.' },
    form: { ...TUTORIAL_PRESENTATIONS.fk6, backend: 'fomkyr', memoryMiB: 14304, timeoutMinutes: 0,
      nativeWorkers: 0, monomialPruning: true,
      fomkyrOptions: { ...FOMKYR_DEFAULTS, autoWorkerMiB:1024, cachePercent:2, sharedCacheMiB:2048, gateMiB:1024, hilbertGate:true, hilbertSectors:true } } },
  { id: 'oscillator',
    title: { en: 'Bosonic creation and annihilation operators', ru: 'Бозонные операторы рождения и уничтожения' },
    description: { en: 'Two independent oscillator modes with central t and [a_i, b_j] = δ_ij t². Setting t = 1 gives the canonical commutators. Explore normal ordering through degree 6.', ru: 'Две независимые моды осциллятора: t центрально, [a_i, b_j] = δ_ij t². При t = 1 получаются канонические коммутаторы. Исследуйте нормальное упорядочение до степени 6.' },
    form: TUTORIAL_PRESENTATIONS.oscillator },
  { id: 'clifford',
    title: { en: 'Clifford algebra and Euclidean Dirac matrices', ru: 'Алгебра Клиффорда и евклидовы матрицы Дирака' },
    description: { en: 'Four gamma generators satisfy g_i g_j + g_j g_i = 2δ_ij t², with central t. Setting t = 1 recovers the Euclidean Clifford relations; compare the ordered products through degree 6.', ru: 'Четыре гамма-образующие удовлетворяют g_i g_j + g_j g_i = 2δ_ij t², где t центрально. При t = 1 получаются евклидовы соотношения Клиффорда. Сравните упорядоченные произведения до степени 6.' },
    form: TUTORIAL_PRESENTATIONS.clifford },
  { id: 'spin',
    title: { en: 'Angular momentum and raising/lowering operators', ru: 'Момент импульса и повышающие/понижающие операторы' },
    description: { en: 'Homogenized sl₂ commutators with central t. At t = 1, [h, e] = 2e, [h, f] = −2f and [e, f] = h; identify h = 2J_z, e = J_+ and f = J_−. Start through degree 6.', ru: 'Однородные коммутаторы sl₂ с центральным t. При t = 1: [h, e] = 2e, [h, f] = −2f, [e, f] = h; положите h = 2J_z, e = J_+, f = J_−. Начальный предел — степень 6.' },
    form: TUTORIAL_PRESENTATIONS.spin },
  { id: 'yang-mills',
    title: { en: 'Four-dimensional Yang–Mills algebra', ru: 'Четырёхмерная алгебра Янга–Миллса' },
    description: { en: 'Four covariant-derivative generators satisfy Σ_μ [X_μ, [X_μ, X_ν]] = 0 for the Euclidean metric. These cubic relations encode the Yang–Mills equations in an associative algebra. Start through degree 5.', ru: 'Четыре образующие ковариантных производных удовлетворяют Σ_μ [X_μ, [X_μ, X_ν]] = 0 для евклидовой метрики. Эти кубические соотношения записывают уравнения Янга–Миллса в ассоциативной алгебре. Начальный предел — степень 5.' },
    source: { title: 'Connes & Dubois-Violette (2004)', url: 'https://arxiv.org/html/math-ph/0411062' },
    form: TUTORIAL_PRESENTATIONS.yangMills },
];

export function tutorialForm(id) {
  const item = TUTORIALS.find(t => t.id === id);
  if (!item) throw new Error(`Unknown tutorial: ${id}`);
  const defaults = { ring: 'noncomm', order: 'degleftlex', field: '0', modulus: 5, maxdeg: '6',
    weights: '', reverseVars: false, augmentation: 'graded', nonhomog: 'auto',
    strategy: 'default', lowterms: 'safe', outmode: 'ALG', legacy: false };
  const form = item.example ? exampleForm(EXAMPLES.find(e => e.id === item.example)) : item.form;
  return { ...defaults, ...form, legacy: false };
}
