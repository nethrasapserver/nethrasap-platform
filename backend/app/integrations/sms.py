"""SMS dispatch — the platform's only outbound message channel (no email).

Providers implement one method; which one runs is chosen by `SMS_PROVIDER`:

  * ``console`` — dev/test default. Logs the message at INFO so OTPs are
    readable in the backend logs. Also records the last message per phone in
    memory so the test suite can assert on OTP delivery without parsing logs.
  * ``msg91`` / ``exotel`` / ``twilio`` — real providers, added when chosen.
    Adding one is a new subclass + env change; call sites never change.
"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod

from ..config import get_settings
from ..logging import get_logger
from ..phone import mask_phone

log = get_logger("integrations.sms")


class SmsProvider(ABC):
    @abstractmethod
    def send(self, *, to: str, body: str) -> None:
        """Send `body` to E.164 number `to`. Raises on hard provider errors."""


class ConsoleSmsProvider(SmsProvider):
    """Dev/test provider: log-only delivery + in-memory outbox for tests."""

    def __init__(self) -> None:
        self.outbox: dict[str, list[str]] = {}

    def send(self, *, to: str, body: str) -> None:
        self.outbox.setdefault(to, []).append(body)
        if get_settings().is_dev:
            # Dev/test only: the full body (incl. OTP) must be readable locally.
            log.info("sms.console", to=to, body=body)
        else:
            # Config validation blocks console in production, but staging (or a
            # misconfigured env) must never log OTPs or unmasked phone numbers.
            log.info("sms.console", to=mask_phone(to), body_len=len(body), body="<redacted>")


class Msg91Provider(SmsProvider):  # pragma: no cover - needs credentials
    def send(self, *, to: str, body: str) -> None:
        raise NotImplementedError(
            "MSG91 not wired yet — set SMS_PROVIDER=console until credentials exist"
        )


class ExotelProvider(SmsProvider):  # pragma: no cover - needs credentials
    def send(self, *, to: str, body: str) -> None:
        raise NotImplementedError(
            "Exotel not wired yet — set SMS_PROVIDER=console until credentials exist"
        )


class TwilioProvider(SmsProvider):  # pragma: no cover - needs credentials
    def send(self, *, to: str, body: str) -> None:
        raise NotImplementedError(
            "Twilio not wired yet — set SMS_PROVIDER=console until credentials exist"
        )


_PROVIDERS: dict[str, type[SmsProvider]] = {
    "console": ConsoleSmsProvider,
    "msg91": Msg91Provider,
    "exotel": ExotelProvider,
    "twilio": TwilioProvider,
}

_instance: SmsProvider | None = None


def get_provider() -> SmsProvider:
    global _instance
    if _instance is None:
        _instance = _PROVIDERS[get_settings().sms_provider]()
    return _instance


def send_sms(*, to: str, body: str) -> None:
    """Send an SMS. Never raises on provider failure — logs and continues,
    because a notification must not break the transaction it follows."""
    try:
        get_provider().send(to=to, body=body)
    except Exception:
        log.exception("sms.send_failed", to=mask_phone(to))


async def send_sms_async(*, to: str, body: str) -> None:
    """Async facade for calls from the event loop: the provider interface is
    sync (real providers do blocking HTTP), so hop to a thread."""
    await asyncio.to_thread(send_sms, to=to, body=body)


# --- Message templates (centralised so copy changes touch one file) --------


def send_otp(*, to: str, code: str, purpose: str) -> None:
    # OTP sends must NOT swallow errors silently at this layer — the caller
    # decides how a delivery failure surfaces. Console provider never raises.
    get_provider().send(
        to=to,
        body=f"{code} is your Nethrasap {purpose} code. Valid 5 minutes. Do not share it.",
    )


async def send_otp_async(*, to: str, code: str, purpose: str) -> None:
    """Async facade for `send_otp` (see `send_sms_async`); propagates provider
    errors just like the sync version."""
    await asyncio.to_thread(send_otp, to=to, code=code, purpose=purpose)


def send_order_confirmation(*, to: str, order_number: str, grand_total_paise: int) -> None:
    rupees = f"Rs {grand_total_paise / 100:,.2f}"
    send_sms(
        to=to,
        body=f"Nethrasap: order {order_number} confirmed ({rupees}). Track it in your account.",
    )


def send_order_cancelled(*, to: str, order_number: str) -> None:
    send_sms(
        to=to,
        body=f"Nethrasap: order {order_number} cancelled. Any captured payment will be refunded.",
    )
