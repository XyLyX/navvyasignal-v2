"""Deterministic concurrency model tests for the proposed database lease protocol.

These tests exercise a locked in-memory state machine, NOT PostgreSQL transaction
isolation or the SQL migration. Database integration is still a release blocker.
"""
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

@dataclass
class State:
    owner: str
    token: int
    expires: int
    phase: str
    fingerprint: str

class AtomicLeaseModel:
    def __init__(self):
        self.mutex=threading.Lock()
        self.state=None
        self.build_requests=0

    def claim(self, owner, fingerprint, now, ttl=10):
        with self.mutex:
            s=self.state
            if s and not (s.phase=="claimed" and s.expires<now):
                return None
            token=1 if s is None else s.token+1
            self.state=State(owner,token,now+ttl,"claimed",fingerprint)
            return token

    def transition(self,owner,token,expected,next_phase,now):
        with self.mutex:
            s=self.state
            allowed={("claimed","build_requested"),("build_requested","verified"),
                     ("build_requested","ambiguous"),("ambiguous","verified")}
            if (expected,next_phase) not in allowed or not s or s.owner!=owner or s.token!=token or s.phase!=expected or s.expires<now:
                return False
            s.phase=next_phase
            if next_phase=="build_requested":self.build_requests+=1
            return True

class LeaseContentionTests(unittest.TestCase):
    def test_only_one_of_64_simultaneous_workers_acquires(self):
        m=AtomicLeaseModel()
        barrier=threading.Barrier(64)
        def worker(i):
            barrier.wait(timeout=10)
            return m.claim(str(i),"a"*64,now=100)
        with ThreadPoolExecutor(max_workers=64) as pool:
            results=list(pool.map(worker,range(64)))
        self.assertEqual(sum(x is not None for x in results),1)

    def test_expired_claim_fences_stale_owner(self):
        m=AtomicLeaseModel()
        old=m.claim("old","a"*64,now=100,ttl=10)
        new=m.claim("new","b"*64,now=111,ttl=10)
        self.assertGreater(new,old)
        self.assertFalse(m.transition("old",old,"claimed","build_requested",now=111))
        self.assertTrue(m.transition("new",new,"claimed","build_requested",now=111))
        self.assertEqual(m.build_requests,1)

    def test_crash_after_build_claim_never_auto_replays(self):
        m=AtomicLeaseModel()
        token=m.claim("worker","a"*64,now=100)
        self.assertTrue(m.transition("worker",token,"claimed","build_requested",now=100))
        self.assertIsNone(m.claim("retry","a"*64,now=100000))
        self.assertEqual(m.build_requests,1)

    def test_ambiguous_side_effect_never_auto_replays(self):
        m=AtomicLeaseModel()
        token=m.claim("worker","a"*64,now=100)
        self.assertTrue(m.transition("worker",token,"claimed","build_requested",now=100))
        self.assertTrue(m.transition("worker",token,"build_requested","ambiguous",now=101))
        self.assertIsNone(m.claim("retry","a"*64,now=100000))
        self.assertEqual(m.build_requests,1)

    def test_expired_lease_cannot_change_phase(self):
        m=AtomicLeaseModel()
        token=m.claim("worker","a"*64,now=100,ttl=10)
        self.assertFalse(m.transition("worker",token,"claimed","build_requested",now=111))
        self.assertEqual(m.build_requests,0)

if __name__=="__main__":unittest.main()
