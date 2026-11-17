"""Real PostgreSQL integration tests; uses only disposable CI service database."""
import os
import threading
import uuid
import unittest
from concurrent.futures import ThreadPoolExecutor

try:
    import psycopg
except ImportError:
    psycopg=None

DB=os.getenv("LEASE_TEST_DATABASE_URL")

@unittest.skipUnless(DB and psycopg,"Requires disposable PostgreSQL test database and psycopg")
class PostgresAtomicLeaseTests(unittest.TestCase):
    def setUp(self):
        self.resource="ci-"+str(uuid.uuid4())
    def call(self,sql,params):
        with psycopg.connect(DB,autocommit=True) as conn:
            with conn.cursor() as cur:
                cur.execute(sql,params)
                return cur.fetchone()
    def claim(self,owner,ttl="10 minutes"):
        return self.call("select * from publication_private.claim_lease(%s,%s,%s,%s::interval)",(self.resource,owner,"a"*64,ttl))
    def transition(self,owner,token,old,new):
        return self.call("select publication_private.transition_lease(%s,%s,%s,%s,%s)",(self.resource,owner,token,old,new))[0]
    def test_concurrent_transactions_have_single_winner(self):
        barrier=threading.Barrier(12)
        def attempt(_):
            barrier.wait(timeout=15)
            return self.claim(uuid.uuid4())
        with ThreadPoolExecutor(max_workers=12) as pool:
            results=list(pool.map(attempt,range(12)))
        self.assertEqual(sum(row[0] for row in results),1)
    def test_expired_claim_fences_previous_owner(self):
        old=uuid.uuid4();new=uuid.uuid4()
        acquired,token,_=self.claim(old,"1 second")
        self.assertTrue(acquired)
        self.call("update publication_private.leases set expires_at=clock_timestamp()-interval '1 second' where resource=%s returning 1",(self.resource,))
        acquired,new_token,_=self.claim(new)
        self.assertTrue(acquired)
        self.assertGreater(new_token,token)
        self.assertFalse(self.transition(old,token,"claimed","build_requested"))
        self.assertTrue(self.transition(new,new_token,"claimed","build_requested"))
    def test_ambiguous_build_never_reclaimed_after_expiry(self):
        owner=uuid.uuid4();acquired,token,_=self.claim(owner)
        self.assertTrue(acquired)
        self.assertTrue(self.transition(owner,token,"claimed","build_requested"))
        self.call("update publication_private.leases set expires_at=clock_timestamp()-interval '1 second' where resource=%s returning 1",(self.resource,))
        self.assertFalse(self.claim(uuid.uuid4())[0])
    def test_claimed_crash_can_be_recovered_after_expiry(self):
        owner=uuid.uuid4();self.assertTrue(self.claim(owner)[0])
        self.call("update publication_private.leases set expires_at=clock_timestamp()-interval '1 second' where resource=%s returning 1",(self.resource,))
        self.assertTrue(self.claim(uuid.uuid4())[0])

if __name__=="__main__":unittest.main()
