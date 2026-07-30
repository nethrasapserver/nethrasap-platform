"""Integration-layer guardrails — prod config validators, stub-signature gating,
CSV import limits."""
from __future__ import annotations

import io

import pytest
from pydantic import ValidationError

from app.api.v1.admin_catalogue import MAX_IMPORT_BYTES
from app.config import Settings, get_settings
from app.integrations import razorpay

from .conftest import auth


# --- Razorpay stub signature is dev/test-only ---------------------------------


def _stub_sig() -> tuple[str, str, str]:
    order_id, payment_id = "order_guard", "pay_guard"
    return order_id, payment_id, razorpay.stub_checkout_signature(
        order_id=order_id, payment_id=payment_id
    )


def test_stub_checkout_signature_accepted_in_dev(monkeypatch):
    order_id, payment_id, sig = _stub_sig()
    settings = get_settings()
    assert not settings.razorpay_key_secret, "guard tests assume stub mode"
    for env in ("dev", "test"):
        monkeypatch.setattr(settings, "environment", env)
        assert razorpay.verify_checkout_signature(
            order_id=order_id, payment_id=payment_id, signature=sig
        )


def test_stub_checkout_signature_rejected_outside_dev(monkeypatch):
    order_id, payment_id, sig = _stub_sig()
    settings = get_settings()
    assert not settings.razorpay_key_secret, "guard tests assume stub mode"
    for env in ("staging", "production"):
        monkeypatch.setattr(settings, "environment", env)
        assert not razorpay.verify_checkout_signature(
            order_id=order_id, payment_id=payment_id, signature=sig
        )


# --- CSV import limits ---------------------------------------------------------


@pytest.mark.asyncio
async def test_csv_import_over_size_cap_is_413(client, staff_tokens):
    oversized = b"name,brand,category_slug\n" + b"x" * MAX_IMPORT_BYTES
    r = await client.post(
        "/api/v1/admin/imports/catalogue",
        headers=auth(staff_tokens["admin"]),
        files={"file": ("huge.csv", io.BytesIO(oversized), "text/csv")},
    )
    assert r.status_code == 413, r.text


@pytest.mark.asyncio
async def test_csv_import_non_csv_content_type_is_415(client, staff_tokens):
    r = await client.post(
        "/api/v1/admin/imports/catalogue",
        headers=auth(staff_tokens["admin"]),
        files={"file": ("payload.json", io.BytesIO(b"{}"), "application/json")},
    )
    assert r.status_code == 415, r.text


# --- Production config validators -----------------------------------------------


def _settings_kwargs(**overrides) -> dict:
    kwargs = dict(
        environment="production",
        database_url="postgresql+asyncpg://user:pass@db.example.com/nethrasap",
        jwt_secret="k" * 64,
        sms_provider="msg91",
        storage_endpoint="https://accountid.r2.cloudflarestorage.com",
        storage_access_key_id="access-key",
        storage_secret_access_key="secret-key",
    )
    kwargs.update(overrides)
    return kwargs


def test_production_refuses_console_sms():
    with pytest.raises(ValidationError, match="SMS_PROVIDER=console"):
        Settings(**_settings_kwargs(sms_provider="console"))


def test_production_refuses_unconfigured_storage():
    with pytest.raises(ValidationError, match="storage is unconfigured"):
        Settings(**_settings_kwargs(storage_endpoint=""))
    with pytest.raises(ValidationError, match="storage is unconfigured"):
        Settings(**_settings_kwargs(storage_secret_access_key=""))


def test_production_boots_with_real_providers():
    s = Settings(**_settings_kwargs())
    assert s.environment == "production"


def test_dev_and_test_allow_console_and_stub_storage():
    for env in ("dev", "test"):
        s = Settings(
            **_settings_kwargs(
                environment=env,
                sms_provider="console",
                storage_endpoint="",
                storage_access_key_id="",
                storage_secret_access_key="",
            )
        )
        assert s.sms_provider == "console"
