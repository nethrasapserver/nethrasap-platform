"""External-service integrations.

  * ``sms``      — SMS/OTP dispatch. `console` provider in dev/test (logs the
                   message); real providers (MSG91/Exotel/Twilio) are selected
                   via SMS_PROVIDER once credentials exist. There is
                   deliberately NO email integration on this platform.
  * ``razorpay`` — payment gateway. STUB until B4 wires the live client +
                   webhook processing.
  * ``storage``  — object storage. STUB until B1 wires Cloudflare R2
                   (KYC documents, product images, invoice PDFs).

Each remaining stub logs every call with structured fields so it's obvious in
dev that the stub was hit, and returns deterministic data so flows work
end-to-end.
"""
