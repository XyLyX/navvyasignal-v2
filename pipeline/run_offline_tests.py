"""Run unit tests with outbound sockets and unmocked provider calls prohibited."""
import os
import socket
import unittest
from unittest.mock import Mock
import anthropic


def no_network(*args, **kwargs):
    raise AssertionError('Unit test attempted an unmocked network operation')


def main():
    socket.socket.connect = no_network
    socket.create_connection = no_network
    os.environ['ANTHROPIC_API_KEY']='test-only'
    # Tests patch this client explicitly. An omitted patch must never contact a model.
    client=Mock()
    client.messages.stream.side_effect=no_network
    anthropic.Anthropic=Mock(return_value=client)
    result=unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover('pipeline',pattern='test_*.py',top_level_dir='.'))
    raise SystemExit(not result.wasSuccessful())

if __name__=='__main__':main()
