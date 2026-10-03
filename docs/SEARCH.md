# Public catalog and search

Only `catalog_content` rows with `status = PUBLISHED` and `visibility = PUBLIC` are searchable. Private listener `books` and creator drafts are never queried by public search. MVP search uses PostgreSQL `ilike` filters over title, author display name, and description; the catalog migration also adds a GIN full-text index for future text-search refinement.
