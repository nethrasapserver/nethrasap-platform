"""External-service integrations.

Every module in this package is a **STUB** in Phase 3. Real wiring (Razorpay
order creation, SES email dispatch, S3/MinIO uploads) lands in a later
incremental phase — the interfaces here are designed so swapping in the real
client is a single function-body replacement, not a refactor.

Each stub:
    * Returns deterministic data so the order-placement flow works end-to-end.
    * Logs every call with structured fields so it's obvious in dev that the
      stub was hit (and what real call would have happened).
    * Carries a `# TODO(phase-3.5): replace with real <vendor> client` marker.
"""
