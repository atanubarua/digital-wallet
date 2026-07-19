#!/bin/bash
# Runs once, on first container start (postgres image convention: anything in
# /docker-entrypoint-initdb.d/ executes automatically against a fresh data dir).
#
# We run ONE Postgres container for the whole dev stack (RAM budget - see
# docs/adr/0006-database-per-service.md, dev-environment note) but each
# service still gets its own LOGICAL database. No service is granted access
# to another's database, so the ADR-0006 boundary (no cross-service tables)
# still holds - only the physical container is shared.
set -e

for db in auth_db user_db ledger_db transaction_db history_db; do
  # Must connect to an EXISTING database first (psql has no db to attach to
  # otherwise) - "postgres" always exists. Without -d/--dbname, psql defaults
  # to a database named after the user, which doesn't exist yet and fails.
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE DATABASE $db;
EOSQL
done
