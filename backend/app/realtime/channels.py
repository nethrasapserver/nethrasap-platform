"""Channel naming + subscription authorization.

Channel space:
  user:{user_id}   — personal: notifications, own order/enquiry/kyc updates
  role:{role}      — staff fan-out: new enquiries, KYC queue, order feed
  conv:{conv_id}   — chat conversations (subscribed per-conversation later)
  topic:{name}     — broadcast topics: catalogue, inventory, kpi

Authorization happens once, at connect time, from the JWT claims — a socket
is only ever attached to channels its token could read.
"""
from __future__ import annotations

from typing import Any

STAFF_ROLES = {"sales", "manager", "admin"}


def user_channel(user_id: str) -> str:
    return f"user:{user_id}"


def role_channel(role: str) -> str:
    return f"role:{role}"


def conversation_channel(conversation_id: str) -> str:
    return f"conv:{conversation_id}"


def topic_channel(name: str) -> str:
    return f"topic:{name}"


def authorized_channels(claims: dict[str, Any]) -> set[str]:
    """Channels this token may subscribe to."""
    channels = {user_channel(str(claims["sub"])), topic_channel("catalogue")}
    role = str(claims.get("role", ""))
    if role in STAFF_ROLES:
        channels.add(role_channel(role))
        channels.add(topic_channel("inventory"))
        channels.add(topic_channel("kpi"))
    return channels
