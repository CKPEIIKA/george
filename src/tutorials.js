// Small, deterministic presentations for exploring the controls.
import { EXAMPLES } from './examples.js';
import { exampleForm } from './bergman-syntax.js';

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
