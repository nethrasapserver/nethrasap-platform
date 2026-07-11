"""Aggregate router for /api/v1."""
from __future__ import annotations

from fastapi import APIRouter

from . import auth, cart, categories, checkout, coupons, health, orders, products, reviews

api_router_v1 = APIRouter()
api_router_v1.include_router(health.router, tags=["health"])
api_router_v1.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router_v1.include_router(products.router, prefix="/products", tags=["products"])
api_router_v1.include_router(reviews.router, prefix="/products", tags=["reviews"])
api_router_v1.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router_v1.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router_v1.include_router(checkout.router, prefix="/checkout", tags=["checkout"])
api_router_v1.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router_v1.include_router(coupons.router, prefix="/coupons", tags=["coupons"])
