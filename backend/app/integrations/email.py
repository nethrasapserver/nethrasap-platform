"""Email dispatch — **STUB** for Phase 3.

In Phase 3 every "send" call logs the rendered envelope at INFO. Phase 8 will
swap the body to either AWS SES (prod) or MailHog (dev).

# TODO(phase-3.5+): real SES via boto3 / MailHog SMTP for dev.
"""
from __future__ import annotations

from ..logging import get_logger

log = get_logger("integrations.email")


def send(
    *,
    to: str | list[str],
    subject: str,
    text_body: str,
    html_body: str | None = None,
    headers: dict[str, str] | None = None,
) -> None:
    recipients = [to] if isinstance(to, str) else list(to)
    log.info(
        "email.send.stub",
        to=recipients,
        subject=subject,
        text_preview=text_body[:140],
        has_html=bool(html_body),
        headers=headers or {},
        message="Phase-3 stub. Real SES/MailHog lands later.",
    )


def send_order_confirmation(*, to: str, order_number: str, grand_total_paise: int) -> None:
    """Convenience wrapper used by services/checkout.py — keeps templating
    centralised so swapping to real SES later means editing one file."""
    rupees = f"₹{grand_total_paise / 100:,.2f}"
    send(
        to=to,
        subject=f"Order {order_number} confirmed — Nethrasap",
        text_body=(
            f"Thanks for ordering with Nethrasap.\n\n"
            f"Order: {order_number}\n"
            f"Total: {rupees}\n\n"
            f"We'll email you again when your order ships.\n"
        ),
    )


def send_order_cancelled(*, to: str, order_number: str) -> None:
    send(
        to=to,
        subject=f"Order {order_number} cancelled — Nethrasap",
        text_body=(
            f"Your order {order_number} has been cancelled.\n"
            f"Any captured payment will be refunded automatically.\n"
        ),
    )
