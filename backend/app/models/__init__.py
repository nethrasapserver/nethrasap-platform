"""SQLAlchemy ORM models — aggregated for Alembic autogeneration.

Importing this package side-effect-registers every model with the Base
metadata so `target_metadata = Base.metadata` in `migrations/env.py` sees
everything.
"""
from .audit import AuditLog
from .base import Base
from .cart import Cart, CartItem, Coupon, CouponType
from .catalogue import (
    Category,
    PriceRole,
    Product,
    ProductImage,
    ProductPrice,
    ProductVariant,
    Review,
    ScheduleClass,
    StockStatus,
)
from .chat import Conversation, ConversationStatus, Message, MessageRead
from .cms import AppSetting, CmsBlock, CmsPage, FeatureFlag
from .enquiry import (
    Enquiry,
    EnquiryApproval,
    EnquiryItem,
    EnquiryMessage,
    EnquiryStatus,
    EnquiryStatusHistory,
)
from .hr import (
    AttendanceRecord,
    AttendanceStatus,
    Employee,
    EmployeeStatus,
    Holiday,
    LeaveBalance,
    LeaveRequest,
    LeaveStatus,
    LeaveType,
    PayrollRun,
    PayrollRunStatus,
    Payslip,
)
from .inventory import StockLedger, StockLevel, StockMovement, Warehouse
from .notification import Notification, NotificationPriority, NotificationType
from .order import (
    Invoice,
    Order,
    OrderItem,
    OrderStatus,
    OrderStatusHistory,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Refund,
    RefundStatus,
    Shipment,
    ShipmentStatus,
)
from .otp import OtpCode, OtpPurpose
from .pincode import Pincode
from .rbac import Permission, Role, RolePermission
from .sales import SalesAssignment, SalesTarget
from .saved_items import CompareItem, WishlistItem
from .user import Address, Session, User, UserProfile, UserRole, UserStatus
from .verification import KycDocType, KycDocument, VerificationRequest, VerificationStatus

__all__ = [
    "AuditLog",
    "Base",
    "Cart",
    "CartItem",
    "Category",
    "Coupon",
    "CouponType",
    "Invoice",
    "Order",
    "OrderItem",
    "OrderStatus",
    "OrderStatusHistory",
    "Payment",
    "PaymentMethod",
    "PaymentStatus",
    "PriceRole",
    "Product",
    "ProductImage",
    "ProductPrice",
    "ProductVariant",
    "Refund",
    "RefundStatus",
    "Review",
    "ScheduleClass",
    "Shipment",
    "ShipmentStatus",
    "StockStatus",
    "OtpCode",
    "OtpPurpose",
    "Pincode",
    "Permission",
    "Role",
    "RolePermission",
    "Address",
    "Session",
    "User",
    "UserProfile",
    "UserRole",
    "UserStatus",
    "AppSetting",
    "CmsBlock",
    "CmsPage",
    "FeatureFlag",
    "KycDocType",
    "KycDocument",
    "VerificationRequest",
    "VerificationStatus",
    "StockLedger",
    "StockLevel",
    "StockMovement",
    "Warehouse",
    "Conversation",
    "ConversationStatus",
    "Message",
    "MessageRead",
    "Enquiry",
    "EnquiryApproval",
    "EnquiryItem",
    "EnquiryMessage",
    "EnquiryStatus",
    "EnquiryStatusHistory",
    "Notification",
    "NotificationPriority",
    "NotificationType",
    "SalesAssignment",
    "SalesTarget",
    "CompareItem",
    "WishlistItem",
    "AttendanceRecord",
    "AttendanceStatus",
    "Employee",
    "EmployeeStatus",
    "Holiday",
    "LeaveBalance",
    "LeaveRequest",
    "LeaveStatus",
    "LeaveType",
    "PayrollRun",
    "PayrollRunStatus",
    "Payslip",
]
