import unittest
from app.structural import degree8_result,support_formula,support_anick

class Structural03(unittest.TestCase):
    def test_degree8(self):
        r=degree8_result();self.assertEqual(r['ranks'],{'d4':985,'d5':840,'d6':280});self.assertEqual(r['betti_p2_to_p8'],[39,200,390,240,80,20,5]);self.assertEqual(r['alternatingCoefficient'],54)
    def test_formula(self):
        r=support_formula();self.assertIn('Xi_{>=3}',r['reciprocalDecomposition'])
    def test_support3_degree8(self):
        r=support_anick(3,8,0,5_000_000);self.assertTrue(r['fullEulerCheck']);self.assertEqual(int(r['exactSupportChainCounts'][4][8]),460);self.assertEqual(len(r['subsetAggregateCounts']),10)
    def test_support4_degree8(self):
        r=support_anick(4,8,0,5_000_000);self.assertEqual(int(r['exactSupportChainCounts'][4][8]),1395);self.assertEqual(len(r['subsetAggregateCounts']),5)
    def test_support5_degree8(self):
        r=support_anick(5,8,0,5_000_000);self.assertEqual(int(r['exactSupportChainCounts'][4][8]),360);self.assertEqual(len(r['subsetAggregateCounts']),1)
if __name__=='__main__':unittest.main()
