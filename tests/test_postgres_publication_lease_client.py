import unittest
from unittest.mock import Mock
from v3_core.postgres_publication_lease import PostgresPublicationLease,LeaseUnavailable

class Cursor:
    def __init__(self,row):self.row=row
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def execute(self,statement,params):self.statement=statement;self.params=params
    def fetchone(self):return self.row
class Conn:
    def __init__(self,row):self.cursor_obj=Cursor(row)
    def __enter__(self):return self
    def __exit__(self,*args):pass
    def cursor(self):return self.cursor_obj
class LeaseClientTests(unittest.TestCase):
    def test_claim_returns_fenced_handle(self):
        client=PostgresPublicationLease(lambda:Conn((True,7,"claimed")))
        h=client.claim("release","a"*64)
        self.assertEqual(h.token,7)
        self.assertEqual(h.resource,"release")
    def test_busy_blocks_build(self):
        with self.assertRaises(RuntimeError):
            PostgresPublicationLease(lambda:Conn((False,None,None))).claim("release","a"*64)
    def test_database_failure_blocks_build(self):
        def broken():raise ConnectionError("secret")
        with self.assertRaisesRegex(LeaseUnavailable,"build blocked"):
            PostgresPublicationLease(broken).claim("release","a"*64)
    def test_transition_rejects_lost_owner(self):
        client=PostgresPublicationLease(lambda:Conn((False,)))
        h=__import__('v3_core.postgres_publication_lease',fromlist=['LeaseHandle']).LeaseHandle("r","00000000-0000-0000-0000-000000000001",1)
        with self.assertRaises(LeaseUnavailable):client.reserve_build(h)
    def test_transition_true(self):
        client=PostgresPublicationLease(lambda:Conn((True,)))
        h=__import__('v3_core.postgres_publication_lease',fromlist=['LeaseHandle']).LeaseHandle("r","00000000-0000-0000-0000-000000000001",1)
        client.reserve_build(h)
if __name__=='__main__':unittest.main()
