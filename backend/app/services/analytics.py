"""Analytics — every dashboard number computed live from real orders.

No invented figures: revenue, order counts, AOV, trends, top products, and
rep attainment all derive from the orders/order_items tables. Rollup tables
(incremental daily aggregates) are a later optimisation; at current volume
live SQL is correct and simple, and this module is the single source the
rollups would later cache.
"""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.order import Order, OrderItem, OrderStatus
from ..models.sales import SalesAssignment, SalesTarget
from ..models.user import User, UserRole

# Statuses that count as realised revenue (paid/in-fulfilment/delivered).
REVENUE_STATUSES = (
    OrderStatus.confirmed,
    OrderStatus.packed,
    OrderStatus.dispatched,
    OrderStatus.out_for_delivery,
    OrderStatus.delivered,
)


def _revenue_filter(stmt: Select) -> Select:
    return stmt.where(Order.status.in_(REVENUE_STATUSES))


def _period_start(now: datetime, days: int) -> datetime:
    return now - timedelta(days=days)


# --- Core KPIs ----------------------------------------------------------------


async def kpis(db: AsyncSession, *, days: int = 30) -> dict[str, Any]:
    """Platform-wide KPIs over the trailing `days` window."""
    since = _period_start(datetime.now(UTC), days)
    row = (
        await db.execute(
            _revenue_filter(
                select(
                    func.coalesce(func.sum(Order.grand_total), 0),
                    func.count(Order.id),
                    func.count(func.distinct(Order.user_id)),
                )
            ).where(Order.placed_at >= since)
        )
    ).one()
    revenue, orders, buyers = int(row[0]), int(row[1]), int(row[2])
    aov = revenue // orders if orders else 0

    pending = (
        await db.execute(
            select(func.count(Order.id)).where(
                Order.status == OrderStatus.placed, Order.placed_at >= since
            )
        )
    ).scalar_one()

    return {
        "window_days": days,
        "revenue_paise": revenue,
        "orders": orders,
        "unique_buyers": buyers,
        "aov_paise": aov,
        "awaiting_payment": int(pending),
    }


async def revenue_trend(db: AsyncSession, *, days: int = 30) -> list[dict[str, Any]]:
    """Daily revenue series for the last `days` calendar days, INCLUDING today,
    zero-filled."""
    now = datetime.now(UTC)
    start_date = (now - timedelta(days=days - 1)).date()
    start_ts = datetime(start_date.year, start_date.month, start_date.day, tzinfo=UTC)
    day = func.date(Order.placed_at)
    rows = (
        await db.execute(
            _revenue_filter(select(day, func.sum(Order.grand_total), func.count(Order.id)))
            .where(Order.placed_at >= start_ts)
            .group_by(day)
        )
    ).all()
    by_day = {r[0]: (int(r[1]), int(r[2])) for r in rows}
    out = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        rev, cnt = by_day.get(d, (0, 0))
        out.append({"date": d.isoformat(), "revenue_paise": rev, "orders": cnt})
    return out


async def top_products(db: AsyncSession, *, days: int = 30, limit: int = 10) -> list[dict[str, Any]]:
    since = _period_start(datetime.now(UTC), days)
    rows = (
        await db.execute(
            select(
                OrderItem.product_name_snapshot,
                func.sum(OrderItem.quantity),
                func.sum(OrderItem.line_total + OrderItem.gst_amount),
            )
            .join(Order, Order.id == OrderItem.order_id)
            .where(Order.status.in_(REVENUE_STATUSES), Order.placed_at >= since)
            .group_by(OrderItem.product_name_snapshot)
            .order_by(func.sum(OrderItem.line_total + OrderItem.gst_amount).desc())
            .limit(limit)
        )
    ).all()
    return [
        {"product_name": r[0], "units": int(r[1]), "revenue_paise": int(r[2])} for r in rows
    ]


# --- Sales rep performance ----------------------------------------------------


async def _rep_revenue(db: AsyncSession, rep_id: uuid.UUID, *, since: datetime) -> tuple[int, int]:
    """(revenue, orders) from customers currently assigned to this rep."""
    assigned = select(SalesAssignment.customer_id).where(
        SalesAssignment.rep_id == rep_id, SalesAssignment.ended_at.is_(None)
    )
    row = (
        await db.execute(
            _revenue_filter(
                select(func.coalesce(func.sum(Order.grand_total), 0), func.count(Order.id))
            ).where(Order.user_id.in_(assigned), Order.placed_at >= since)
        )
    ).one()
    return int(row[0]), int(row[1])


async def rep_performance(db: AsyncSession, *, rep_id: uuid.UUID, days: int = 30) -> dict[str, Any]:
    now = datetime.now(UTC)
    since = _period_start(now, days)
    revenue, orders = await _rep_revenue(db, rep_id, since=since)

    customers = (
        await db.execute(
            select(func.count(SalesAssignment.id)).where(
                SalesAssignment.rep_id == rep_id, SalesAssignment.ended_at.is_(None)
            )
        )
    ).scalar_one()

    # This-month target attainment.
    period = date(now.year, now.month, 1)
    target = (
        await db.execute(
            select(SalesTarget.target_paise).where(
                SalesTarget.rep_id == rep_id, SalesTarget.period == period
            )
        )
    ).scalar_one_or_none()
    month_revenue, _ = await _rep_revenue(db, rep_id, since=datetime(now.year, now.month, 1, tzinfo=UTC))
    attainment = round(month_revenue / target * 100, 1) if target else None

    return {
        "rep_id": rep_id,
        "window_days": days,
        "revenue_paise": revenue,
        "orders": orders,
        "customers": int(customers),
        "aov_paise": revenue // orders if orders else 0,
        "month_target_paise": target,
        "month_revenue_paise": month_revenue,
        "attainment_pct": attainment,
    }


async def team(db: AsyncSession, *, days: int = 30) -> list[dict[str, Any]]:
    reps = (
        await db.execute(
            select(User).where(User.role == UserRole.sales).order_by(User.created_at)
        )
    ).scalars().all()
    out = []
    for rep in reps:
        perf = await rep_performance(db, rep_id=rep.id, days=days)
        perf["name"] = rep.profile.full_name if rep.profile else None
        perf["phone"] = rep.phone
        out.append(perf)
    out.sort(key=lambda p: p["revenue_paise"], reverse=True)
    return out


# --- Portal dashboards --------------------------------------------------------


async def dashboard(db: AsyncSession, *, portal: str, days: int = 30) -> dict[str, Any]:
    """Aggregate view for manager/admin dashboards."""
    data: dict[str, Any] = {
        "kpis": await kpis(db, days=days),
        "revenue_trend": await revenue_trend(db, days=days),
        "top_products": await top_products(db, days=days, limit=5),
    }
    if portal in ("manager", "admin"):
        data["team"] = await team(db, days=days)
    return data
