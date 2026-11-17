import unittest
from v3_core.atomic_lease import LeaseDecision, parse_claim, require_claim

class AtomicLeaseContractTests(unittest.TestCase):
    def test_claim_with_fencing_token(self):
        self.assertEqual(require_claim(parse_claim({"acquired":True,"token":3,"phase":"claimed"})),3)
    def test_busy_does_not_publish(self):
        with self.assertRaises(RuntimeError):
            require_claim(parse_claim({"acquired":False,"token":None,"phase":None}))
    def test_unknown_response_fails_closed(self):
        for value in (None,{},{"acquired":"true"},{"acquired":True,"token":None,"phase":"claimed"},{"acquired":True,"token":0,"phase":"claimed"},{"acquired":True,"token":1,"phase":"verified"}):
            with self.subTest(value=value),self.assertRaises(RuntimeError): parse_claim(value)
    def test_busy_state_is_explicit(self):
        self.assertEqual(parse_claim({"acquired":False}).decision,LeaseDecision.BUSY)
if __name__=="__main__": unittest.main()
