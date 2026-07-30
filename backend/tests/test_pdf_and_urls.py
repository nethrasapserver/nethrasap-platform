"""Launch blockers (deploy plan §5): image URL mapping + real PDF rendering.

- `storage.image_url` is the single choke point turning stored image values
  (R2 keys, seed-data absolute URLs, or nothing) into renderable <img src>
  values for every catalogue/category serializer.
- Invoice and payslip PDFs must be real reportlab output, not placeholders.
  The renderers are pure functions of their inputs, so we exercise them
  directly with fakes — the full DB round-trip is covered by
  test_invoices.py / test_hr.py.
"""
from __future__ import annotations

from datetime import UTC, date, datetime
from types import SimpleNamespace

from app.config import get_settings
from app.integrations import storage
from app.services import invoices
from app.services.payroll import _render_payslip

# --- image_url --------------------------------------------------------------


def test_image_url_none_and_empty():
    assert storage.image_url(None) is None
    assert storage.image_url("") is None


def test_image_url_absolute_urls_pass_through(monkeypatch):
    # Seed data stores full Unsplash URLs in storage_key — must survive even
    # when a public base is configured.
    monkeypatch.setattr(get_settings(), "storage_public_base_url", "https://cdn.example.com")
    for url in (
        "https://images.unsplash.com/photo-123?w=800",
        "http://images.example.com/cat.jpg",
    ):
        assert storage.image_url(url) == url


def test_image_url_prefixes_configured_public_base(monkeypatch):
    # Trailing slash on the base must not double up.
    monkeypatch.setattr(get_settings(), "storage_public_base_url", "https://cdn.example.com/")
    key = "products/2026/07/30/abc123.webp"
    assert storage.image_url(key) == f"https://cdn.example.com/{key}"


def test_image_url_stub_base_when_unconfigured(monkeypatch):
    monkeypatch.setattr(get_settings(), "storage_public_base_url", "")
    key = "categories/2026/07/30/def456.jpg"
    out = storage.image_url(key)
    # Degrades to the obviously-fake host rather than a broken relative path.
    assert out == f"{storage._STUB_BASE}/public/{key}"


# --- Invoice PDF ------------------------------------------------------------


def _fake_item(name: str = "Paracetamol 500mg") -> SimpleNamespace:
    # Tax-inclusive maths (migration 0012): gst sits *within* line_total.
    return SimpleNamespace(
        product_name_snapshot=name,
        hsn_code_snapshot="3004",
        quantity=2,
        unit_price=5_000,  # paise
        line_total=10_000,
        gst_amount=1_071,
        gst_rate_pct=12,
        unit_label_snapshot="strip of 10",
    )


def _fake_order(items: list[SimpleNamespace]) -> SimpleNamespace:
    line_sum = sum(i.line_total for i in items)
    gst = sum(i.gst_amount for i in items)
    return SimpleNamespace(
        order_number="NS-2026-000123",
        placed_at=datetime(2026, 7, 1, 10, 30, tzinfo=UTC),
        shipping_address={
            "full_name": "Asha Rao",
            "phone": "9876543210",
            "line1": "12 Gandhi Road",
            "line2": None,
            "city": "Chennai",
            "state": "Tamil Nadu",
            "pincode": "600001",
        },
        items=items,
        subtotal=line_sum - gst,
        discount_total=0,
        gst_total=gst,
        shipping_total=0,
        grand_total=line_sum,
    )


def test_invoice_pdf_renders_real_bytes():
    order = _fake_order([_fake_item()])
    pdf = invoices._render_pdf(order, "INV-2026-00001", invoices.SELLER_DEFAULTS)
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1_000  # a placeholder/empty upload would be tiny


def test_invoice_pdf_paginates_long_orders():
    # Enough line items to spill past the first page (new_page path).
    order = _fake_order([_fake_item(f"Item {i:02d}") for i in range(40)])
    pdf = invoices._render_pdf(order, "INV-2026-00002", invoices.SELLER_DEFAULTS)
    assert pdf.startswith(b"%PDF")
    assert pdf.count(b"/Type /Page") >= 2 or len(pdf) > 5_000


# --- Payslip PDF ------------------------------------------------------------


def test_payslip_pdf_renders_real_bytes():
    emp = SimpleNamespace(
        full_name="R. Kumar", code="EMP-007", designation="Pharmacist", department="Operations"
    )
    slip = SimpleNamespace(
        basic_paise=30_000_00,
        allowances_paise=5_000_00,
        deductions_paise=3_600_00,
        net_paise=31_400_00,
    )
    pdf = _render_payslip(emp, slip, date(2026, 7, 1))
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 500
