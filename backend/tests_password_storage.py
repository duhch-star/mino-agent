import unittest
from unittest.mock import patch
from app.services import user_service

class PasswordStorageTests(unittest.TestCase):
    def test_salted_password_survives_jwt_key_rotation(self):
        encoded = user_service.hash_password('acceptance-password')
        self.assertTrue(encoded.startswith('pbkdf2_sha256$'))
        self.assertNotEqual(encoded, user_service.hash_password('acceptance-password'))
        with patch.object(user_service.settings, 'secret_key', 'new-jwt-secret'):
            self.assertTrue(user_service.verify_password('acceptance-password', encoded))
            self.assertFalse(user_service.verify_password('wrong', encoded))

    def test_malformed_hash_is_refused(self):
        for value in ['pbkdf2_sha256$bad', 'pbkdf2_sha256$999999999$salt$hash']:
            self.assertFalse(user_service.verify_password('password', value))
