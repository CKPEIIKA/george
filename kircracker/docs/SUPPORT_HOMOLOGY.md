# Support-resolved program

The star support is the subset of the five leaves occurring in a word. The bar differential preserves total support because adjacent multiplication takes unions of supports. The support <=2 contribution is known in all degrees. Kircracker 0.3 therefore treats support 3, 4 and 5 separately.

`kircracker support K --degree D` computes exact Anick-chain ranks whose chain words use exactly K of the five star letters. It tracks a five-bit support mask along actual paths of the fixed-order Anick automaton, so it does not assume S5 invariance of a lexicographic Groebner basis.

Chain ranks are not Tor dimensions. Homology additionally requires differential ranks. The degree-8 bounded result is shipped as a regression target: r4=985, r5=840, r6=280. Its Betti vector is (39,200,390,240,80,20,5), while the Euler coefficient remains 54 independently of those ranks.

For internal degree <14, S and T=S/(Q) have the same bar complex because Q has degree 14. Degree-8 homology therefore studies the star itself and cannot detect the Q quotient.
