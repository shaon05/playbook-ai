# Abuse enforcement

PlayBook distinguishes normal user mistakes from abuse. Empty images, unreadable photos, password-protected PDFs, corrupted personal documents, and harmless type mismatches are rejected without suspension. Confirmed malware creates a security event and blocks future uploads; repeated high-confidence malicious activity may lead to stronger account restrictions or suspension after review.

Restrictions are stored as typed `account_restrictions` records rather than a single `banned` flag. Restricted users receive a safe incident reference and a Contact Support action. Scanner failures and infrastructure errors do not create user penalties.
