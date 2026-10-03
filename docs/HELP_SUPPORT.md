# Help and support

Help is public and does not require authentication. The mobile Help screen provides searchable static topics for listeners and creators. Support requests are authenticated, user-owned tickets with `OPEN`, `IN_PROGRESS`, `WAITING_FOR_USER`, `RESOLVED`, and `CLOSED` states.

Ticket categories include account, upload, processing, audio, subscription/payment, creator submission, analytics/earnings, copyright, bugs, and other issues. Messages contain text and optional private storage keys; large attachments are not stored in PostgreSQL.

Support agents must receive only case-relevant data. Access tokens, passwords, provider keys, private PDF contents, extracted text, notes, and private listening history are never attached automatically. Contextual support may include a book ID, safe error code, processing stage, request ID, app version, and OS version after the user chooses to contact support.

Content reports are separate from support tickets. Copyright, takedown, and creator appeals are routed to human review; the reporting user cannot change moderation state. No AI support chatbot is used.
