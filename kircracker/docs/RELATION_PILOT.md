# Partial relation elimination on a saved spanning chart

Build the optional exact kernel:

```sh
make relation-pilot
```

`bin/kir-contained-relations` reads a five-generator, degree-graded `KKRMAP01`
word frame with no stored actions and the original 248 integer relations. It
selects one permutation sector. A trie finds defining-relation tips in its
words and forms literal two-sided relation consequences. A row is processed
only when **every integer-polynomial term** is present in the selected chart,
including terms whose coefficients become zero modulo two.

```sh
bin/kir-contained-relations FRAME RELATIONS BINDING DISCOVERY_DIR \
  GROUP 1200 5368709120 discovery
bin/kir-contained-relations FRAME RELATIONS BINDING REPLAY_DIR \
  GROUP 600 5368709120 replay DISCOVERY_DIR/relations.cpr
```

`GROUP` is the zero-based lexicographic S6 permutation index. `BINDING` is the
64-character frame binding. Times are seconds; the memory argument bounds
pivot storage with conservative chart overhead. Use a process memory limit
and a supervisor when running several sectors. Output directories must be new.

## Certificate and scope

The trace contains the literal chart, each accepted original relation/context,
and the earlier pivot rows used to eliminate it. Replay regenerates all source
rows and checks the nonzero triangular pivots. Discovery uses sorted sparse
vectors; replay uses set toggling. It does not repeat a search for useful rows.

If the supplied words span the desired characteristic-zero component and the
replayed relation rank modulo two is `r`, its dimension is at most `N-r`, where
`N` is the chart size. This follows because a nonzero modular minor is nonzero
over Q, and all rows are genuine integer relations among the chart words.
The saved chart's spanning/provenance certificate is an external dependency.
Bind the frame, relation library, executed source/binary and proof files by
SHA256 in the supervising manifest.

The result is **partial**. Contexts with missing chart terms are counted and
omitted. Exhausting all contained contexts does not complete relation
elimination. A timeout never certifies an exact dimension. Discovery results
remain candidates until replay passes. Hashes of the replay trace and free-word
file should match their discovery counterparts.

Outputs are `relations.cpr`, `free-words.bin` (16-byte little-endian literal
words), and `RESULT.json`. Previously certified upper bounds can be intersected
with the new upper bound after the appropriate graded factor assembly.
Nichols and original-algebra bounds require separate assembly when a known
Nichols-kernel defect is present.

## Next extension

Handling omitted contexts requires certified coordinates for their missing
terms, or an enlarged relation chart with all additional free coordinates
counted. An auxiliary column that vanishes modulo two cannot be discarded as
if it had vanished over Q. The current kernel deliberately omits such rows.
