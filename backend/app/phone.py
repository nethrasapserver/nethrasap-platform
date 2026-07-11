"""Phone number normalization — the platform's identity key.

Nethrasap is an India-first platform: bare 10-digit mobiles are treated as
Indian numbers. Everything is stored and compared in E.164 form so a user can
type `98450 12345`, `098450...`, or `+91 98450 12345` and always resolve to
the same account.
"""
from __future__ import annotations

import re

_DIGITS = re.compile(r"\d+")

# Indian mobiles are 10 digits starting 6-9.
_INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")
# General E.164: + followed by 8-15 digits.
_E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class InvalidPhoneError(ValueError):
    pass


def normalize_phone(raw: str) -> str:
    """Normalize user input to E.164. Raises InvalidPhoneError if hopeless."""
    digits = "".join(_DIGITS.findall(raw or ""))
    if not digits:
        raise InvalidPhoneError("phone number required")

    if raw.strip().startswith("+"):
        candidate = f"+{digits}"
        if _E164.match(candidate):
            return candidate
        raise InvalidPhoneError("invalid international phone number")

    # 0-prefixed domestic form: 09845012345
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    # 91-prefixed without +: 919845012345
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]

    if _INDIAN_MOBILE.match(digits):
        return f"+91{digits}"
    raise InvalidPhoneError("expected an Indian mobile number (10 digits, starts 6-9)")


def mask_phone(e164: str) -> str:
    """+919845012345 -> +91•••••2345 — safe for logs and UI hints."""
    if len(e164) <= 7:
        return e164
    return f"{e164[:3]}{'•' * (len(e164) - 7)}{e164[-4:]}"
