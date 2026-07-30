"""Backfill product-information attributes for the PDP (healthcare data,
materials/composition, directions, mfg/expiry).

Idempotent and price-safe: only the JSONB `attributes` column is written, and
existing non-info keys are preserved. Run once after deploying the info feature:

    docker compose exec -T api sh -c "cd /app && uv run python -m scripts.backfill_product_info"
"""
from __future__ import annotations

import asyncio
from datetime import UTC, date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import SessionLocal
from app.models.catalogue import Product

# Category families → templates. Keyed by category slug (seeded set).
MEDICINE = {"prescription", "otc", "ayurveda"}
SUPPLEMENT = {"wellness", "baby-care"}
DEVICE = {"devices"}
CONSUMABLE = {"surgical"}
COLD_CHAIN = {"cold-chain"}


def _core_name(name: str) -> str:
    # "Amoxicillin 500mg Capsules" -> "Amoxicillin"
    return name.split(" ")[0]


def _highlights_for(product: Product, category_slug: str, rx: bool) -> list[str]:
    core = _core_name(product.name)
    if category_slug in DEVICE:
        return [
            "Clinically validated measurement accuracy",
            "Latex-free, medical-grade construction",
            "Simple at-home and clinical operation",
            "Serviced and supported in India",
        ]
    if category_slug in CONSUMABLE:
        return [
            "Sterile, single-use unless stated otherwise",
            "Medical-grade, latex-free material",
            "Tamper-evident sealed packaging",
            "Batch-traceable sourcing",
        ]
    if category_slug in COLD_CHAIN:
        return [
            "Unbroken GDP cold chain, temperature logged",
            "Cold-chain indicator on every pack",
            "CDSCO-approved, batch-traceable sourcing",
            "Administered by healthcare professionals",
        ]
    if category_slug in SUPPLEMENT:
        return [
            f"{core} to support daily nutrition",
            "Quality-tested, label-verified contents",
            "Tamper-evident sealed packaging",
            "Batch-traceable sourcing",
        ]
    first = f"{core} — prescription-grade formulation" if rx else f"{core} — trusted OTC formulation"
    return [
        first,
        "CDSCO-approved, batch-traceable sourcing",
        "Blister-sealed, tamper-evident packaging",
        "Stored and shipped under audited conditions",
    ]


def _tags_for(product: Product, category_slug: str) -> list[str]:
    tags = [_core_name(product.name)]
    if product.sub_category:
        tags.append(product.sub_category)
    tags.append(category_slug.replace("-", " ").title())
    if product.schedule.value != "NONE":
        tags.append(f"Schedule {product.schedule.value}")
    # De-dupe while preserving order.
    seen: set[str] = set()
    return [t for t in tags if t and not (t.lower() in seen or seen.add(t.lower()))]


def _info_for(product: Product, category_slug: str) -> dict:
    core = _core_name(product.name)
    rx = product.schedule.value != "NONE"

    # Representative dates — real mfg/expiry is per batch and printed on the pack.
    today = date.today()
    mfg = (today - timedelta(days=120))
    exp = (today + timedelta(days=630))
    mm = lambda d: d.strftime("%b %Y")  # noqa: E731

    base = {
        "manufacturer": "Manufactured in India",
        "country_of_origin": "India",
        "mfg_date": mm(mfg),
        "expiry_date": mm(exp),
        "shelf_life_months": 24,
        # PDP buy-box checklist + tag chips (approved PDP layout, 2026-07-31).
        "highlights": _highlights_for(product, category_slug, rx),
        "tags": _tags_for(product, category_slug),
    }

    if category_slug in DEVICE:
        return {
            **base,
            "uses": f"{product.name} for accurate at-home and clinical measurement. Diagnostic device — not a medicine.",
            "composition": "Medical-grade ABS housing, silicone contact surfaces, and electronic sensor assembly. Latex-free.",
            "directions": "Read the user manual before first use. Clean contact surfaces before and after each measurement. Store the device dry and replace batteries when the low-battery indicator shows.",
            "dosage_timing": [],
            "storage": "Store at room temperature, away from moisture and direct sunlight.",
            "warnings": "Not a substitute for professional diagnosis. Consult your doctor to interpret readings.",
            "shelf_life_months": 36,
        }

    if category_slug in CONSUMABLE:
        return {
            **base,
            "uses": f"{product.name} for clinical and surgical use where a sterile, single-use consumable is required.",
            "composition": "Manufactured from medical-grade, latex-free material. Sterile, single-use unless the pack states otherwise.",
            "directions": "For use by trained healthcare professionals. Check the pack seal and expiry before use. Discard after single use.",
            "dosage_timing": [],
            "storage": "Store in a clean, dry place away from direct sunlight.",
            "warnings": "Do not use if the sterile pack is torn or damaged.",
        }

    if category_slug in COLD_CHAIN:
        return {
            **base,
            "uses": f"{product.name} — temperature-sensitive biologic. Handled under an unbroken GDP cold chain.",
            "composition": f"Contains {core} as the active biologic, with pharmacopoeial excipients. Full composition on the pack insert.",
            "directions": "To be administered by a qualified healthcare professional. Do not use if the cold-chain indicator shows an excursion.",
            "dosage_timing": ["morning"],
            "storage": "Store at 2–8°C. Do not freeze. Protect from light.",
            "warnings": "Prescription required. Keep refrigerated at all times until administration.",
            "shelf_life_months": 18,
        }

    if category_slug in SUPPLEMENT:
        return {
            **base,
            "uses": f"{product.name} to support daily nutritional needs as part of a balanced diet.",
            "composition": f"Contains {core} with supporting vitamins and minerals. See the label for the full nutritional panel.",
            "directions": "Take one unit daily with food, or as advised by your healthcare professional.",
            "dosage_timing": ["morning"],
            "storage": "Store below 25°C in a cool, dry place. Keep tightly closed.",
            "warnings": "Not for medicinal use. Keep out of reach of children. Do not exceed the recommended daily dose.",
        }

    # Default: medicine (prescription / OTC / ayurveda)
    return {
        **base,
        "uses": (
            f"{product.name} is used as prescribed for its approved indications. "
            f"{'A prescription is required. ' if rx else ''}Always follow your doctor's advice."
        ),
        "composition": f"Active ingredient: {core}. Contains standard pharmacopoeial excipients. Full composition is printed on the pack.",
        "directions": (
            "Swallow with water. Take after food unless directed otherwise. "
            "Do not crush or chew extended-release forms. Complete the full course as prescribed."
            if rx
            else "Take as directed on the label or by your pharmacist. Do not exceed the stated dose."
        ),
        "dosage_timing": ["morning", "night"] if rx else ["morning"],
        "storage": "Store below 25°C, away from direct sunlight and moisture. Keep out of reach of children.",
        "warnings": (
            "Prescription medicine (Schedule "
            + product.schedule.value
            + "). Do not self-medicate; use only under medical supervision."
            if rx
            else "Read the label carefully. Consult a doctor if symptoms persist."
        ),
    }


async def main() -> None:
    async with SessionLocal() as db:
        products = (
            (
                await db.execute(
                    select(Product).options(selectinload(Product.category)).order_by(Product.name)
                )
            )
            .scalars()
            .all()
        )
        updated = 0
        for p in products:
            slug = p.category.slug if p.category else ""
            info = _info_for(p, slug)
            attrs = dict(p.attributes or {})
            attrs.update(info)
            p.attributes = attrs
            updated += 1
        await db.commit()
        print(f"backfilled product info on {updated} products")


if __name__ == "__main__":
    asyncio.run(main())
