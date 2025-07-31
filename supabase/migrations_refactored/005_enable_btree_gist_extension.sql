-- Enable B-tree GiST extension
-- Required for exclusion constraints with scalar types
CREATE EXTENSION IF NOT EXISTS "btree_gist";