"""B7 — HR: employees, holidays, attendance, leave (balance-aware), payroll."""
from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from .conftest import auth, phone_for, signup_token


async def _user_id(client, token):
    return (await client.get("/api/v1/auth/me", headers=auth(token))).json()["id"]


async def _make_employee(client, admin, *, code, user_id=None, basic=5000000, allowances=1000000):
    r = await client.post(
        "/api/v1/hr/employees",
        headers=auth(admin),
        json={
            "code": code, "user_id": user_id, "full_name": f"Emp {code}",
            "phone": "+919820000000", "department": "Sales", "designation": "Rep",
            "date_joined": "2026-01-01", "basic_salary": basic, "allowances": allowances,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.mark.asyncio
async def test_employee_crud_and_permission(client, staff_tokens):
    admin = staff_tokens["admin"]
    emp = await _make_employee(client, admin, code="E001")
    assert emp["code"] == "E001"

    lst = await client.get("/api/v1/hr/employees", headers=auth(admin))
    assert any(e["code"] == "E001" for e in lst.json()["items"])

    # sales role lacks hr:manage.
    r = await client.get("/api/v1/hr/employees", headers=auth(staff_tokens["sales"]))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_holidays(client, staff_tokens):
    admin = staff_tokens["admin"]
    r = await client.post(
        "/api/v1/hr/holidays", headers=auth(admin),
        json={"day": "2026-08-15", "name": "Independence Day", "kind": "national"},
    )
    assert r.status_code == 201
    # Any signed-in user can read the calendar.
    customer = await signup_token(client, phone_for("hr-cust"))
    cal = await client.get("/api/v1/hr/holidays?year=2026", headers=auth(customer))
    assert any(h["name"] == "Independence Day" for h in cal.json()["items"])


@pytest.mark.asyncio
async def test_attendance_self_service(client, staff_tokens, db_session):
    admin = staff_tokens["admin"]
    # Employee linked to a login account.
    token = await signup_token(client, phone_for("hr-att-emp"))
    uid = await _user_id(client, token)
    await _make_employee(client, admin, code="E100", user_id=uid)

    ci = await client.post("/api/v1/hr/attendance/check-in", headers=auth(token))
    assert ci.status_code == 200
    assert ci.json()["check_in"]
    # Double check-in conflicts.
    assert (await client.post("/api/v1/hr/attendance/check-in", headers=auth(token))).status_code == 409

    co = await client.post("/api/v1/hr/attendance/check-out", headers=auth(token))
    assert co.json()["check_out"]

    mine = await client.get("/api/v1/hr/attendance/me", headers=auth(token))
    assert len(mine.json()["items"]) == 1


@pytest.mark.asyncio
async def test_leave_balance_flow(client, staff_tokens, db_session):
    from app.models.hr import LeaveType

    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("hr-leave-emp"))
    uid = await _user_id(client, token)
    await _make_employee(client, admin, code="E200", user_id=uid)

    # Seed a leave type with a 10-day quota directly.
    lt = LeaveType(code="CL", name="Casual Leave", annual_quota_days=10)
    db_session.add(lt)
    await db_session.flush()
    lt_id = str(lt.id)

    # Apply for 3 days (within balance).
    apply = await client.post(
        "/api/v1/hr/leave", headers=auth(token),
        json={"leave_type_id": lt_id, "start_date": "2026-09-01", "end_date": "2026-09-03", "reason": "trip"},
    )
    assert apply.status_code == 201, apply.text
    req_id = apply.json()["id"]
    assert apply.json()["days"] == 3

    # Over-quota application is rejected (11 > 10).
    over = await client.post(
        "/api/v1/hr/leave", headers=auth(token),
        json={"leave_type_id": lt_id, "start_date": "2026-10-01", "end_date": "2026-10-11"},
    )
    assert over.status_code == 409

    # HR approves the first request → balance consumed.
    dec = await client.post(
        f"/api/v1/hr/leave/{req_id}/decision", headers=auth(admin), json={"approve": True, "note": "ok"}
    )
    assert dec.status_code == 200
    assert dec.json()["status"] == "approved"

    # Employee got a notification.
    notifs = await client.get("/api/v1/notifications", headers=auth(token))
    assert notifs.json()["unread"] >= 1

    # Now only 7 days remain: an 8-day request fails.
    r = await client.post(
        "/api/v1/hr/leave", headers=auth(token),
        json={"leave_type_id": lt_id, "start_date": "2026-11-01", "end_date": "2026-11-08"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_payroll_run_and_payslip(client, staff_tokens):
    admin = staff_tokens["admin"]
    token = await signup_token(client, phone_for("hr-pay-emp"))
    uid = await _user_id(client, token)
    await _make_employee(client, admin, code="E300", user_id=uid, basic=5000000, allowances=1000000)

    now = datetime.now(UTC)
    period = date(now.year, now.month, 1).isoformat()
    run = await client.post("/api/v1/hr/payroll/runs", headers=auth(admin), json={"period": period})
    assert run.status_code == 201, run.text
    body = run.json()
    assert body["status"] == "processed"
    assert body["payslips"] >= 1
    # net = basic + allowances - 12% PF on basic = 50L + 10L - 6L = 54L paise
    assert body["total_net_paise"] >= 5400000

    # Employee sees their payslip and can download it.
    mine = await client.get("/api/v1/hr/payroll/me", headers=auth(token))
    slips = mine.json()["items"]
    assert len(slips) == 1
    assert slips[0]["net_paise"] == 5400000

    dl = await client.get(f"/api/v1/hr/payslips/{slips[0]['id']}", headers=auth(token))
    assert dl.status_code == 200
    assert dl.json()["url"]  # presigned (stub) URL

    # Running the same period again conflicts.
    again = await client.post("/api/v1/hr/payroll/runs", headers=auth(admin), json={"period": period})
    assert again.status_code == 409


@pytest.mark.asyncio
async def test_payroll_requires_permission(client, staff_tokens):
    r = await client.post(
        "/api/v1/hr/payroll/runs", headers=auth(staff_tokens["sales"]), json={"period": "2026-07-01"}
    )
    assert r.status_code == 403
