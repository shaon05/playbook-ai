# Publication pipeline

Creator submissions are creator-owned drafts until submitted. Submission moves through `SUBMITTED`, moderation, `APPROVED`, canonical content preparation, `READY_FOR_CREATOR_REVIEW`, and explicit creator confirmation to `PUBLISHED`. Ordinary creator tokens cannot approve content. Moderation stores internal notes separately from creator-visible messages. Unpublishing changes catalog visibility to private while retaining the submission and analytics history.

Rights declarations are persisted per submission with a version and acceptance timestamp. Deduplication can optimize processing, but a rights declaration remains required.
