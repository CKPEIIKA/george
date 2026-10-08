# Nichols algebra B6

The `nichols` namespace studies the transposition Nichols algebra B6 separately from the original quadratic Fomin-Kirillov algebra E6.

Commands:

```bash
kircracker nichols upper D ...
kircracker nichols search D ...
kircracker nichols verify D ...
kircracker nichols run D ...
kircracker nichols export D -o profile.json ...
```

The upper computation uses the Nichols-only presented model. Lower bounds come from independently replayed complementary-pairing minors. Exactness is declared only when the componentwise bounds meet. No Q-shift is added, and E6=B6 is never assumed.

The same checkpointed 128-bit word / signed-128 verifier path supports degrees through 22. This supports bounded B6 dimension computations in degrees 20–22. It may return BOUNDS_ONLY rather than inventing a coefficient.
