"""Tests for the GM mail command builder. Run: python3 -m unittest discover -s tests"""
import unittest
from webapp.gm import GmError, _command


class MailCommandTests(unittest.TestCase):
    def test_multiple_attachments(self):
        self.assertEqual(
            _command("items", {"guid": 42, "subject": "Rewards", "text": "Well done",
                               "items": [{"item": 1234, "count": 2}, {"item": 4321, "count": 1}]}),
            '.send items 42 "Rewards" "Well done" 1234:2 4321:1',
        )

    def test_legacy_single_item(self):
        self.assertIn("99:3", _command("items", {"guid": 42, "item": 99, "count": 3}))

    def test_empty_cart_rejected(self):
        with self.assertRaises(GmError):
            _command("items", {"guid": 42, "items": []})

    def test_more_than_twelve_rejected(self):
        with self.assertRaises(GmError):
            _command("items", {"guid": 42, "items": [{"item": 1}] * 13})

    def test_invalid_item_rejected(self):
        with self.assertRaises(GmError):
            _command("items", {"guid": 42, "items": [{"item": "1; .ban account X"}]})


if __name__ == "__main__":
    unittest.main()
