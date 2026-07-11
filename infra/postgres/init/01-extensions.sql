-- Bootstrap a separate test database and required extensions.
CREATE DATABASE nethrasap_test;

\c nethrasap
CREATE EXTENSION IF NOT EXISTS pgcrypto;

\c nethrasap_test
CREATE EXTENSION IF NOT EXISTS pgcrypto;
