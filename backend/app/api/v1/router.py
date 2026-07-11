"""Aggregate router for /api/v1."""
from __future__ import annotations

from fastapi import APIRouter

from . import (
    admin_catalogue,
    admin_orders,
    analytics,
    auth,
    cart,
    categories,
    chat,
    checkout,
    cms,
    coupons,
    enquiries,
    health,
    inventory,
    kyc,
    notifications,
    orders,
    payments,
    products,
    realtime,
    reviews,
)

api_router_v1 = APIRouter()
api_router_v1.include_router(health.router, tags=["health"])
api_router_v1.include_router(realtime.router, tags=["realtime"])
api_router_v1.include_router(kyc.router, tags=["kyc"])
api_router_v1.include_router(admin_catalogue.router, tags=["admin-catalogue"])
api_router_v1.include_router(inventory.router, tags=["inventory"])
api_router_v1.include_router(payments.router, tags=["payments"])
api_router_v1.include_router(admin_orders.router, tags=["admin-orders"])
api_router_v1.include_router(enquiries.router, tags=["enquiries"])
api_router_v1.include_router(chat.router, tags=["chat"])
api_router_v1.include_router(notifications.router, tags=["notifications"])
api_router_v1.include_router(analytics.router, tags=["analytics"])
api_router_v1.include_router(cms.router, tags=["cms"])
api_router_v1.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router_v1.include_router(products.router, prefix="/products", tags=["products"])
api_router_v1.include_router(reviews.router, prefix="/products", tags=["reviews"])
api_router_v1.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router_v1.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router_v1.include_router(checkout.router, prefix="/checkout", tags=["checkout"])
api_router_v1.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router_v1.include_router(coupons.router, prefix="/coupons", tags=["coupons"])
