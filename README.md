# George

**Gröbner bases, Hilbert series and Anick resolutions in the browser — an interface to bergman and more…**

### [Open George →](https://ckpeiika.github.io/george/)

No installation. Computations run locally in your browser; algebra input stays on your device.

## Engines

- **Bergman:** commutative and noncommutative Gröbner bases, series, Anick
  resolutions and homological computations over ℚ and prime fields. George uses
  Bergman 1.001 with documented fixes; Legacy mode preserves original behavior.
- **Fomkyr:** a fast, independent C engine for homogeneous noncommutative Gröbner
  bases and Hilbert coefficients. The same exact kernel runs natively and through
  WebAssembly, with multicore execution and resumable checkpoints.

George and the bundled Fomkyr release are **0.7.4**.

## Use it

1. Enter generators and relations, or load a guided example.
2. Select the computation, field and degree bound. Runtime controls are under
   **Engine**; mathematical controls are under **More settings**.
3. Press **Compute**. Explore the basis and series, or download complete output
   from **Files**, including a ZIP when the display is only a preview.

The **Share** button creates a link with the input and settings. The guide,
controls and examples are available in English and Russian.

Fomkyr supports 1–16 generators, unit weights and degree/left lexicographic order;
unsupported settings are disabled. The FK6 example supplies settings for deeper
runs. Imported dimension assistance is labelled as an assumption. A degree bound
establishes completion only through that bound.

See the [user guide](docs/USER-GUIDE.md) for input syntax, memory, checkpoints,
settings, the Lisp console and result formats.

## Run locally

Requires Node.js 22.8 or later.

```sh
npm ci
npm run serve
```

Open **http://127.0.0.1:8000/**. For shared Fomkyr workers, use
`npm run serve:fomkyr`.

### Native Fomkyr

```sh
cd fomkyr
make check
make
```

Input, calculation commands, optimization profiles and resume instructions are
in the [Fomkyr manual](fomkyr/README.md).

## Performance

![FK6: native Fomkyr and browsers](docs/benchmarks/fomkyr-0.6.6-native-browser.svg)

Historical Fomkyr 0.6.6 measurements; performance depends on the presentation,
settings and runtime. [Methods, data and comparisons with Bergman and Singular](docs/benchmarks/README.md).

## Documentation

| Topic | Reference |
|---|---|
| Browser usage | [User guide](docs/USER-GUIDE.md) |
| Native C engine | [Fomkyr](fomkyr/README.md) |
| FK dimensions and certificates | [Kircracker](kircracker/README.md) |
| Resolution output | [Export format](docs/RESOLUTION-EXPORT.md) |
| Builds, tests and architecture | [Development](docs/development/DEVELOPMENT.md) |
| Mathematical checks and scope | [Validation](docs/development/VALIDATION.md) |
| Version history | [Changelog](docs/CHANGELOG.md) |

This is a vibe-coded project. Check results that matter; the documentation
records the independent comparisons and their scope.

## License and credits

George's code is available under the Bergman General Public License or
GPL-2.0-or-later. Fomkyr and Kircracker are MIT licensed; bundled components
retain their own licenses. See [LICENSE.md](LICENSE.md) and [credits](docs/CREDITS.md).
