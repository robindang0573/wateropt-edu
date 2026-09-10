import json
import math

import numpy as np
from flask import Flask, jsonify, render_template, request
from scipy.optimize import brentq, linprog

app = Flask(__name__)

VND_PER_CNY = 3550.0  # tỷ giá tham chiếu


def money(x, unit="triệu USD"):
    if x is None:
        return "—"
    return f"{x:,.2f} {unit}"


# ============================================================
# MODULE 1 — PHÂN TÍCH KINH TẾ DỰ ÁN (Chương 3)
# Nguyên tắc With–Without (Incremental): các chỉ số tính trên
# DÒNG TIỀN CHÊNH LỆCH ΔCF = CF(có dự án) − CF(không dự án).
# ============================================================
def calculate_irr(cash_flows):
    """IRR bằng Newton–Raphson (kèm nhật ký lặp để giảng dạy)."""
    rate = 0.1
    iterations = []
    rows = []
    for k in range(100):
        npv = sum(cf / ((1 + rate) ** i) for i, cf in enumerate(cash_flows))
        rows.append({"iter": k + 1, "r": round(rate * 100, 6), "npv": npv})
        if k < 4:
            iterations.append(f"Lần lặp {k + 1}: r = {rate * 100:.2f}% → NPV = {npv:.4f}")
        elif k == 4:
            iterations.append("... (tiếp tục lặp tới khi |NPV| < 0.0001)")
        if abs(npv) < 0.0001:
            iterations.append("⇒ |NPV| < 0.0001 — hội tụ.")
            iterations.append(f"⇒ IRR = {rate * 100:.2f}% (làm ΔNPV ≈ 0)")
            return rate, iterations, rows
        d_npv = sum(-i * cf / ((1 + rate) ** (i + 1)) for i, cf in enumerate(cash_flows) if i > 0)
        if d_npv == 0:
            break
        rate = rate - npv / d_npv
    if abs(rate) > 1000:
        return None, iterations, rows
    return rate, iterations, rows


def compute_economic(form):
    I = float(form.get("invest", 0))
    B = float(form.get("benefit", 0))
    OM = float(form.get("om", 0))
    i = float(form.get("rate", 8)) / 100.0
    n = int(form.get("nper", 20))
    rep_year = int(form.get("rep_year", 10))
    rep_cost = float(form.get("rep_cost", 0))
    salvage = float(form.get("salvage", 0))

    # Kịch bản cơ sở "không có dự án" (Without-project)
    B0 = float(form.get("base_benefit", 0))
    OM0 = float(form.get("base_om", 0))
    g0 = float(form.get("base_growth", 0)) / 100.0

    n = max(1, n)

    cash_flows = []          # ΔCF (chênh lệch)
    cf_with_list = []        # dòng tiền "có dự án"
    cf_without_list = []     # dòng tiền "không dự án"
    npv_terms = []
    table = []

    # B/C theo từng kịch bản (PW của B và C)
    pw_b_with, pw_c_with = 0.0, I
    pw_b_without, pw_c_without = 0.0, 0.0
    ben_with = [f"Năm 0: Vốn đầu tư I = {I:,.2f} → PW = {I:,.2f}"]
    cost_with = [f"Năm 0: Vốn đầu tư I = {I:,.2f} → PW = {I:,.2f}"]
    ben_without, cost_without = [], []

    for t in range(n + 1):
        at = (1 + i) ** t

        if t == 0:
            cfw, cfw0 = -I, 0.0
        else:
            nb = B - OM
            if t == rep_year:
                nb -= rep_cost
            if t == n:
                nb += salvage
            cfw = nb

            bt = B0 * (1 + g0) ** (t - 1)
            cfw0 = bt - OM0

            ben_with.append(f"Năm {t}: Lợi ích B = {B:,.2f} / {at:,.4f} = {B / at:,.2f}")
            cost_with.append(f"Năm {t}: O&amp;M = {OM:,.2f} / {at:,.4f} = {OM / at:,.2f}")
            pw_b_with += B / at
            pw_c_with += OM / at
            if t == rep_year:
                cost_with.append(f"Năm {t}: Thay thế = {rep_cost:,.2f} / {at:,.4f} = {rep_cost / at:,.2f}")
                pw_c_with += rep_cost / at
            if t == n:
                ben_with.append(f"Năm {t}: Giá trị còn lại = {salvage:,.2f} / {at:,.4f} = {salvage / at:,.2f}")
                pw_b_with += salvage / at

            ben_without.append(f"Năm {t}: Lợi ích cơ sở B0 = {bt:,.2f} / {at:,.4f} = {bt / at:,.2f}")
            cost_without.append(f"Năm {t}: O&amp;M cơ sở = {OM0:,.2f} / {at:,.4f} = {OM0 / at:,.2f}")
            pw_b_without += bt / at
            pw_c_without += OM0 / at

        dcf = (cfw - cfw0) / at
        cash_flows.append(cfw - cfw0)
        cf_with_list.append(cfw)
        cf_without_list.append(cfw0)

        if t == 0 or abs(cfw - cfw0) > 0.005:
            npv_terms.append(
                f"Năm {t}: ΔCF = {cfw:,.2f} − ({cfw0:,.2f}) = {cfw - cfw0:,.2f} → / {at:,.4f} = {dcf:,.2f}"
            )

        table.append({
            "year": t,
            "cf_with": round(cfw, 2),
            "cf_without": round(cfw0, 2),
            "incremental": round(cfw - cfw0, 2),
            "discounted": round(dcf, 2),
        })

    # ---- Chỉ số trên dòng tiền chênh lệch ----
    npv = sum(cf / ((1 + i) ** t) for t, cf in enumerate(cash_flows))
    pw_b_inc = pw_b_with - pw_b_without
    pw_c_inc = pw_c_with - pw_c_without
    bc = pw_b_inc / pw_c_inc if pw_c_inc > 0 else None
    crf = (i * (1 + i) ** n) / ((1 + i) ** n - 1) if abs(i) > 1e-12 else 1.0 / n
    aw = npv * crf

    try:
        irr, irr_iterations, irr_rows = calculate_irr(cash_flows)
        irr_null = irr is None
    except (OverflowError, ValueError):
        irr, irr_iterations, irr_rows, irr_null = None, [], [], True
    if not irr_null and irr is not None and (abs(irr) > 10 or not np.isfinite(irr)):
        irr = None
        irr_null = True

    # ---- Đường NPV(r): chiết khấu cùng dòng ΔCF theo mức lãi suất ----
    sweep_max = max(40.0, (irr if irr is not None else 20.0) * 160)
    npv_sweep = []
    sr = 0.0
    while sr <= sweep_max and len(npv_sweep) < 130:
        r_ = sr / 100.0
        val = sum(cf / (1 + r_) ** t for t, cf in enumerate(cash_flows))
        npv_sweep.append({"r": round(sr, 2), "npv": round(val, 3)})
        sr += 1.0

    # ---- Bảng "phép chiếu chiết khấu" (P = F/(1+r)^t) ----
    discount_table = []
    face_cf, pv_cf = [], []
    for t in range(n + 1):
        factor = 1 / (1 + i) ** t
        F = cash_flows[t]
        P = F * factor
        face_cf.append(F)
        pv_cf.append(P)
        discount_table.append({"year": t, "face": round(F, 2), "factor": round(factor, 6), "pv": round(P, 2)})

    cum, payback = 0.0, None
    cum_list = []
    for t in range(n + 1):
        cum += cash_flows[t] / (1 + i) ** t
        cum_list.append(round(cum, 2))
        if payback is None and t >= 1 and cum >= 0:
            payback = t

    status = "feasible" if npv > 0 and (bc is None or bc > 1) else "not"

    aw_ben = pw_b_inc * crf
    aw_cost = pw_c_inc * crf

    detail_val = {
        "npv": npv, "bc": bc, "irr": irr, "crf": crf, "aw": aw,
        "r_pct": i * 100, "n": n,
    }
    details = build_economic_details(
        detail_val, cf_with_list, cf_without_list, cash_flows, npv_terms,
        ben_with, cost_with, ben_without, cost_without,
        pw_b_with, pw_c_with, pw_b_without, pw_c_without, pw_b_inc, pw_c_inc,
        irr_iterations, irr_null, I, B, OM, rep_cost, rep_year, salvage, B0, OM0, g0, i, n,
    )

    return {
        "I": I, "B": B, "OM": OM, "i": i * 100, "n": n,
        "rep_year": rep_year, "rep_cost": rep_cost, "salvage": salvage,
        "B0": B0, "OM0": OM0, "g0": g0 * 100,
        "npv": npv, "bc": bc, "aw": aw, "irr": irr, "crf": crf,
        "payback": payback,
        "years": list(range(n + 1)),
        "cf": [round(x, 2) for x in cash_flows],
        "cum": cum_list,
        "status": status,
        "pw_b_with": pw_b_with, "pw_c_with": pw_c_with,
        "pw_b_without": pw_b_without, "pw_c_without": pw_c_without,
        "pw_b_inc": pw_b_inc, "pw_c_inc": pw_c_inc,
        "cf_with": [round(x, 2) for x in cf_with_list],
        "cf_without": [round(x, 2) for x in cf_without_list],
        "table": table,
        "discount_table": discount_table,
        "irr_rows": [] if irr_null else irr_rows,
        "npv_sweep": npv_sweep,
        "aw_ben": round(aw_ben, 2), "aw_cost": round(aw_cost, 2),
        "details": details,
    }


def build_economic_details(v, cf_with_list, cf_without_list, cash_flows, npv_terms,
                           ben_with, cost_with, ben_without, cost_without,
                           pw_b_with, pw_c_with, pw_b_without, pw_c_without, pw_b_inc, pw_c_inc,
                           irr_iterations, irr_null, I, B, OM, rep_cost, rep_year, salvage,
                           B0, OM0, g0, i, n):
    r_pct = i * 100
    npv, bc, aw, crf, irr = v["npv"], v["bc"], v["aw"], v["crf"], v["irr"]
    return {
        "npv": {
            "name": "NPV — Giá trị hiện tại ròng (dòng tiền chênh lệch)",
            "formula": "ΔCF<sub>t</sub> = CF<sub>t</sub>(có dự án) − CF<sub>t</sub>(không dự án)<br>"
                       "NPV = Σ<sub>t=0..n</sub> ΔCF<sub>t</sub> / (1+r)<sup>t</sup>",
            "meaning": "<strong>Nguyên tắc With–Without:</strong> lợi ích dự án = <em>chênh lệch do dự án tạo ra</em> "
                       "so với kịch bản cơ sở (không dự án nhưng vẫn có xu thế phát triển tự nhiên). NU (NPV &gt; 0) → khả thi.",
            "steps": ["Mỗi năm tính ΔCF<sub>t</sub> = CF<sub>t</sub>(có) − CF<sub>t</sub>(không), "
                      "quy về hiện giá ΔCF<sub>t</sub>/(1+r)<sup>t</sup> rồi cộng dồn:"] + npv_terms + [
                f"⇒ NPV = Σ ΔDCF = {npv:,.2f} — " +
                ("phần diện tích giữa hai đường cong thể hiện lợi ích thuần của dự án." if npv > 0 else "dự án không sinh lợi.")
            ],
        },
        "bc": {
            "name": "B/C — Tỷ số Lợi ích / Chi phí (incremental)",
            "formula": "B/C = [PW(B)<sub>có</sub> − PW(B)<sub>không</sub>] ÷ [PW(C)<sub>có</sub> − PW(C)<sub>không</sub>]",
            "meaning": "Phần tăng thêm của hiện giá lợi ích so với phần tăng thêm của hiện giá chi phí "
                       "khi chuyển từ kịch bản cơ sở sang làm dự án. B/C ≥ 1 → khả thi.",
            "steps": [
                "Bước 1 — PW(B) của kịch bản CÓ dự án:"] + ben_with + [
                f"⇒ PW(B) có dự án = {pw_b_with:,.2f}",
                "Bước 2 — PW(C) của kịch bản CÓ dự án:"] + cost_with + [
                f"⇒ PW(C) có dự án = {pw_c_with:,.2f}",
                "Bước 3 — PW(B) của kịch bản KHÔNG dự án:"] + (
                ben_without + [f"⇒ PW(B) không dự án = {pw_b_without:,.2f}"]
                if pw_b_without else [f"⇒ PW(B) không dự án = 0 (chưa nhập kịch bản cơ sở)"]) + [
                "Bước 4 — PW(C) của kịch bản KHÔNG dự án:"] + (
                cost_without + [f"⇒ PW(C) không dự án = {pw_c_without:,.2f}"]
                if pw_c_without else [f"⇒ PW(C) không dự án = 0 (chưa nhập kịch bản cơ sở)"]) + [
                "Bước 5 — Chênh lệch (incremental):",
                f"PW(B) chênh lệch = {pw_b_with:,.2f} − {pw_b_without:,.2f} = {pw_b_inc:,.2f}",
                f"PW(C) chênh lệch = {pw_c_with:,.2f} − {pw_c_without:,.2f} = {pw_c_inc:,.2f}",
                f"⇒ B/C = {pw_b_inc:,.2f} ÷ {pw_c_inc:,.2f} = {bc:.2f}" if bc else "⇒ B/C không xác định (chi phí chênh lệch ≤ 0)",
            ],
        },
        "irr": {
            "name": "IRR — Suất sinh lợi nội tại (dòng chênh lệch)",
            "formula": "Tìm r* sao cho Σ ΔCF<sub>t</sub>/(1+r*)<sup>t</sup> = 0",
            "meaning": f"Tỉ suất chiết khấu làm ΔNPV = 0 — mức lợi nhuận do riêng dự án tạo ra (vượt xu thế cơ sở). "
                       f"IRR ≥ {r_pct:.1f}% → khả thi.",
            "steps": (["Giải bằng Newton–Raphson trên dòng ΔCF:"] + irr_iterations) if not irr_null else [
                "⚠️ IRR không hội tụ (dòng tiền đổi dấu nhiều lần hoặc ΔNPV &lt; 0 với mọi r). "
                "Với dòng chênh lệch này IRR không có nghĩa — dùng NPV/AW để đánh giá."
            ],
        },
        "aw": {
            "name": "AW — Giá trị đều hàng năm (dòng chênh lệch)",
            "formula": "AW = NPV × (A/P, r, n) ; (A/P, r, n) = r(1+r)<sup>n</sup> ÷ [(1+r)<sup>n</sup> − 1]",
            "meaning": "Quy NPV thành giá trị đều mỗi năm — mức gia tăng thu nhập thuần hàng năm so với kịch bản cơ sở. AW &gt; 0 → khả thi.",
            "steps": [
                f"Bước 1 — Hệ số thu hồi vốn (A/P, r, n) = {r_pct:.1f}% × {i:.4f}^{n} ÷ [(1+{i:.4f})^{n} − 1] = {crf:.6f}",
                f"Bước 2 — AW = NPV × (A/P, r, n) = {npv:,.2f} × {crf:.6f} = {aw:,.2f} (đơn vị tiền tệ/năm)",
            ],
        },
    }


# ============================================================
# MODULE 2 — GIÁ NƯỚC NÔNG NGHIỆP (Cơ chế Trung Quốc, Chương 6)
# ============================================================
def compute_pricing(form):
    invest = float(form.get("invest", 100))            # triệu CNY — vốn đầu tư ban đầu
    dep_life = float(form.get("dep_life", 5))          # năm — thời gian khấu hao
    mode = form.get("mode", "static")                  # static | dynamic
    disc_rate = float(form.get("disc_rate", 6)) / 100.0  # tỉ suất chiết khấu xã hội (6–8%)
    n_years = max(float(dep_life), 1.0)
    dep_static = invest / n_years                      # đường thẳng I ÷ n
    crf = (disc_rate * (1 + disc_rate) ** n_years) / ((1 + disc_rate) ** n_years - 1) \
        if disc_rate > 1e-12 else 1.0 / n_years        # (A/P, i, n) — niên kim hóa
    dep_dynamic = invest * crf
    dep = dep_dynamic if mode == "dynamic" else dep_static
    om_lab = float(form.get("om_labor", 0))
    om_en = float(form.get("om_energy", 0))
    om_rep = float(form.get("om_repair", 0))
    om_mg = float(form.get("om_mgmt", 0))
    profit = float(form.get("profit", 5)) / 100.0
    tax = float(form.get("tax", 3)) / 100.0
    dq = float(form.get("design_q", 100))
    aq = float(form.get("actual_q", 80))
    quota = float(form.get("quota", 6000))          # m³/hộ/năm
    use = float(form.get("use", 7200))              # m³/hộ/năm (hộ mẫu)
    area_ha = float(form.get("area_ha", 1000))
    r2 = float(form.get("tier2", 20)) / 100.0       # vượt ≤10% → +20%
    r3 = float(form.get("tier3", 50)) / 100.0       # vượt >10% → +50%

    oms = om_lab + om_en + om_rep + om_mg
    dep_calc = (f"Khấu hao (tĩnh) = Vốn đầu tư ÷ Số năm KH = {invest:,.0f} ÷ {n_years:,.0f} = {dep_static:,.2f}") \
        if mode == "static" else \
        (f"Khấu hao (động) = Vốn đầu tư × (A/P, {disc_rate*100:.1f}%, {n_years:,.0f}) = {invest:,.0f} × {crf:.6f} = {dep_dynamic:,.2f}")
    breakdown = {
        "Khấu hao": dep,
        "Nhân công": om_lab,
        "Điện năng": om_en,
        "Sửa chữa": om_rep,
        "Quản lý": om_mg,
    }
    calc_map = {
        "Khấu hao": dep_calc,
        "Nhân công": "Chi phí nhân công vận hành (lương + phụ cấp) quy ra 1 năm",
        "Điện năng": "Chi phí điện bơm/sai kênh thực tế trong 1 năm vận hành",
        "Sửa chữa": "Trích chi phí sửa chữa, bảo trì định kỳ trong 1 năm",
        "Quản lý": "Chi phí quản lý hành chính, giám sát công trình trong 1 năm",
    }
    C = dep + oms
    profit_amt = C * profit
    tax_amt = C * tax
    R = C + profit_amt + tax_amt

    # Quy tắc 60%: Q_pricing = max(Actual_Q, 0.6 × Design_Q)
    rule60 = dq > 0 and aq < 0.6 * dq
    q_pricing = max(aq, 0.6 * dq) if dq > 0 else aq

    price = None
    if q_pricing > 0:
        price = R / q_pricing          # CNY/m³
    price_vnd = price * VND_PER_CNY if price is not None else None

    # So sánh hai phương pháp khấu hao (Tĩnh ↔ Động)
    def _rev_for(d):
        c_ = d + oms
        p_ = c_ * profit
        t_ = c_ * tax
        r_ = c_ + p_ + t_
        pr_ = r_ / q_pricing if q_pricing > 0 else None
        return {
            "C": round(c_, 2), "profit": round(p_, 2), "tax": round(t_, 2),
            "R": round(r_, 2),
            "price": round(pr_, 6) if pr_ is not None else None,
        }
    comp_static = _rev_for(dep_static)
    comp_dynamic = _rev_for(dep_dynamic)

    # Bảng tính tiền 3 bậc (hộ mẫu)
    floor10 = 1.1 * quota
    tiers = [
        {
            "name": "Trong định mức",
            "range": f"0 – {quota:,.0f} m³",
            "use": max(0.0, min(use, quota)),
            "rate": "P",
            "price": price,
            "amount": max(0.0, min(use, quota)) * (price or 0),
        },
        {
            "name": "Vượt định mức ≤ 10%",
            "range": f"{quota:,.0f} – {floor10:,.0f} m³",
            "use": max(0.0, min(use, floor10) - quota),
            "rate": f"P × {1 + r2:.2f}",
            "price": price * (1 + r2) if price else None,
            "amount": max(0.0, min(use, floor10) - quota) * (price or 0) * (1 + r2),
        },
        {
            "name": "Vượt định mức > 10%",
            "range": f"> {floor10:,.0f} m³",
            "use": max(0.0, use - floor10),
            "rate": f"P × {1 + r3:.2f}",
            "price": price * (1 + r3) if price else None,
            "amount": max(0.0, use - floor10) * (price or 0) * (1 + r3),
        },
    ]
    bill = sum(t["amount"] for t in tiers)
    # Doanh thu vùng (theo diện tích, giả định mật độ hộ = 1 ha/hộ)
    total_ha_use = area_ha * use
    total_ha_quota = area_ha * quota
    total_ha_bill = area_ha * bill

    # Bảng cơ cấu chi phí có tỉ trọng + cách tính ra tiền
    cost_rows = []
    for name, val in breakdown.items():
        cost_rows.append({
            "name": name, "value": round(val, 2),
            "share": round(val / C * 100, 2) if C > 0 else 0.0,
            "calc": calc_map[name],
        })

    return {
        "breakdown": breakdown,
        "cost_rows": cost_rows,
        "invest": invest, "dep_life": dep_life,
        "mode": mode, "disc_rate": disc_rate * 100,
        "dep_static": round(dep_static, 2), "dep_dynamic": round(dep_dynamic, 2),
        "crf": crf, "comp_static": comp_static, "comp_dynamic": comp_dynamic,
        "C": C, "profit_amt": profit_amt, "tax_amt": tax_amt,
        "profit_pct": profit * 100, "tax_pct": tax * 100, "R": R,
        "design_q": dq, "actual_q": aq, "q_pricing": q_pricing,
        "rule60": rule60,
        "price_cny": price, "price_vnd": price_vnd,
        "quota": quota, "use": use, "area_ha": area_ha,
        "tiers": tiers, "bill": bill,
        "total_ha_use": total_ha_use, "total_ha_quota": total_ha_quota,
        "total_ha_bill": total_ha_bill,
    }


# ============================================================
# MODULE 3.1 — QUY HOẠCH TUYẾN TÍNH (LP) 2 biến
# ============================================================
def solve_lp(c1, c2, rows):
    """rows: list[{a1,a2,b}] các ràng buộc a1·x1 + a2·x2 ≤ b, x1,x2 ≥ 0."""
    A = np.array([[r["a1"], r["a2"]] for r in rows], dtype=float)
    b = np.array([r["b"] for r in rows], dtype=float)
    c = np.array([-c1, -c2], dtype=float)

    res = linprog(c, A_ub=A, b_ub=b, bounds=[(0, None), (0, None)], method="highs")
    optimal = None
    z_star = None
    status = "optimal"
    note = ""
    if not res.success:
        status = "infeasible" if res.status == 2 else "unbounded"
        note = "Không tìm thấy nghiệm (miền khả thi rỗng hoặc hàm mục tiêu không chặn)."
    else:
        optimal = [round(float(res.x[0]), 3), round(float(res.x[1]), 3)]
        z_star = round(float(c1 * optimal[0] + c2 * optimal[1]), 3)

    # Đỉnh miền khả thi: liệt kê giao điểm các cặp đường biên trong hộp hiển thị [0..Xb]x[0..Yb]
    Xb = Yb = 0.0
    for r in rows:
        if r["a1"] > 0:
            Xb = max(Xb, r["b"] / r["a1"])
        if r["a2"] > 0:
            Yb = max(Yb, r["b"] / r["a2"])
    Xb = max(10.0, Xb * 1.1)
    Yb = max(10.0, Yb * 1.1)

    def clip_vertex(p):
        return -1e-6 <= p[0] <= Xb + 1e-6 and -1e-6 <= p[1] <= Yb + 1e-6

    def satisfies_all(p):
        if p[0] < -1e-9 or p[1] < -1e-9:
            return False
        for r in rows:
            if r["a1"] * p[0] + r["a2"] * p[1] > r["b"] + 1e-7:
                return False
        return True

    lines = [r for r in rows] + [
        {"a1": 1, "a2": 0, "b": Xb},
        {"a1": 0, "a2": 1, "b": Yb},
        {"a1": 1, "a2": 0, "b": 0},
        {"a1": 0, "a2": 1, "b": 0},
    ]
    vertices = []
    seen = set()
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            L = np.array([[lines[i]["a1"], lines[i]["a2"]],
                          [lines[j]["a1"], lines[j]["a2"]]], dtype=float)
            v = np.array([lines[i]["b"], lines[j]["b"]], dtype=float)
            if abs(np.linalg.det(L)) < 1e-12:
                continue
            p = np.linalg.solve(L, v)
            if not clip_vertex(p) or not satisfies_all(p):
                continue
            key = (round(float(p[0]), 4), round(float(p[1]), 4))
            if key not in seen:
                seen.add(key)
                vertices.append([round(float(p[0]), 3), round(float(p[1]), 3)])

    feasible = len(vertices) >= 3
    if feasible:
        cx = sum(v[0] for v in vertices) / len(vertices)
        cy = sum(v[1] for v in vertices) / len(vertices)
        vertices.sort(key=lambda v: math.atan2(v[1] - cy, v[0] - cx))

    # Đường đi "Simplex" mô phạm: đi từ (0,0) qua các đỉnh theo Z tăng dần → tối ưu
    path = [[0.0, 0.0]]
    if feasible and optimal:
        order = sorted(vertices, key=lambda v: (c1 * v[0] + c2 * v[1]))
        for v in order:
            if v[0] == 0 and v[1] == 0:
                continue
            if (c1 * v[0] + c2 * v[1]) <= z_star + 1e-9:
                path.append(v)
        if path[-1] != optimal:
            path.append(optimal)

    # ========== Interior Point Method (barrier) ==========
    ipm_result = _solve_ipm(c1, c2, rows, optimal, z_star)

    # ========== Đánh giá Z tại từng đỉnh (đồ giải) ==========
    vertex_zs = []
    if feasible:
        for v in vertices:
            z = c1 * v[0] + c2 * v[1]
            is_opt = (
                optimal is not None
                and abs(v[0] - optimal[0]) < 1e-6
                and abs(v[1] - optimal[1]) < 1e-6
            )
            vertex_zs.append({"x1": v[0], "x2": v[1], "z": round(float(z), 3), "optimal": bool(is_opt)})
        vertex_zs.sort(key=lambda e: e["z"])

    return {
        "obj": [c1, c2],
        "rows": rows,
        "vertices": vertices,
        "feasible": feasible,
        "status": status,
        "note": note,
        "optimal": optimal,
        "z_star": z_star,
        "path": path,
        "xmax": round(Xb, 2), "ymax": round(Yb, 2),
        "vertex_zs": vertex_zs,
        "simplex": simplex_tableau(c1, c2, rows) if feasible else {"iterations": []},
        "ipm": ipm_result,
    }


def simplex_tableau(c1, c2, rows):
    """Bảng lặp Simplex (dạng chuẩn Max, với biến bù s_i ≥ 0)."""
    A = np.array([[r["a1"], r["a2"]] for r in rows], dtype=float)
    b = np.array([r["b"] for r in rows], dtype=float)
    c = np.array([c1, c2], dtype=float)
    m, n = A.shape
    T = np.hstack([A, np.eye(m), b.reshape(-1, 1)]).astype(float)
    zrow = np.hstack([-c, np.zeros(m), [0.0]]).astype(float)
    basis = list(range(n, n + m))
    vn = ["x1", "x2"] + [f"s{i + 1}" for i in range(m)]
    iters = []
    for it in range(1, 60):
        entering = None
        for j in range(n + m):
            if zrow[j] < -1e-9 and (entering is None or zrow[j] < zrow[entering]):
                entering = j
        zv = sum(c[bi] * T[i, -1] for i, bi in enumerate(basis) if bi < n)
        ratios = [None] * m
        leaving = None
        pivot = None
        if entering is not None:
            rmin = None
            for i in range(m):
                if T[i, entering] > 1e-9:
                    r = T[i, -1] / T[i, entering]
                    ratios[i] = round(float(r), 4)
                    if rmin is None or r < rmin:
                        rmin, leaving = r, i
            if leaving is not None:
                pivot = round(float(T[leaving, entering]), 4)
        iters.append({
            "it": it,
            "entering": vn[entering] if entering is not None else None,
            "leaving": vn[basis[leaving]] if leaving is not None else None,
            "pivot": pivot,
            "z": round(float(zv), 4),
            "basis": [vn[bi] for bi in basis],
            "ratios": ratios,
            "optimal": entering is None,
            "var_names": vn,
            "tableau": np.round(np.vstack([T, zrow]), 4).tolist(),
        })
        if entering is None or leaving is None:
            break
        piv = T[leaving, entering]
        T[leaving] = T[leaving] / piv
        for i in range(m):
            if i != leaving and abs(T[i, entering]) > 1e-12:
                T[i] = T[i] - T[i, entering] * T[leaving]
            elif i != leaving:
                T[i, entering] = 0.0
        if abs(zrow[entering]) > 1e-12:
            zrow = zrow - zrow[entering] * T[leaving]
        else:
            zrow[entering] = 0.0
        basis[leaving] = entering
    return {"iterations": iters}


def _solve_ipm(c1, c2, rows, optimal, z_star):
    """Barrier Interior Point Method — trả về lịch sử các bước lặp."""
    A = np.array([[r["a1"], r["a2"]] for r in rows], dtype=float)
    b = np.array([r["b"] for r in rows], dtype=float)
    n = 2

    # Tìm điểm khả thi bên trong (Chebyshev-ish)
    norms = np.linalg.norm(A, axis=1)
    Aub = np.vstack([np.hstack([A, norms[:, None]]), np.array([[-1, 0, -1], [0, -1, -1]], dtype=float)])
    bub = np.r_[b, np.zeros(2)]
    res = linprog(np.array([0.0, 0.0, -1.0]), A_ub=Aub, b_ub=bub,
                  bounds=[(0, None), (0, None), (0, None)], method="highs")
    if res.success and res.x[2] > 1e-4:
        x = res.x[:2].copy()
    else:
        x = np.array([1.0, 1.0])
    x = np.maximum(x, 0.5)
    while np.min(b - A @ x) <= 0 or np.min(x) <= 0:
        x = x * 0.5

    mu0 = max(100.0, abs(z_star) * 0.5) if z_star and z_star > 0 else 100.0
    path = []
    hist = []
    mu = mu0
    outer_max = 18
    inner_max = 15
    conv = []

    for oi in range(outer_max):
        if mu < 1e-12:
            break
        x_start = x.copy()
        converged_inner = False
        for ii in range(inner_max):
            s = b - A @ x
            if np.min(s) <= 1e-12 or np.min(x) <= 1e-12:
                break
            g = -np.array([c1, c2]) + mu * (A.T @ (1.0 / s)) - mu / x
            H = mu * (A.T @ (A / (s[:, None] ** 2))) + mu * np.diag(1.0 / (x ** 2))
            try:
                p = np.linalg.solve(H, -g)
            except np.linalg.LinAlgError:
                break
            # Backtracking line search
            a = 1.0
            for _ in range(25):
                xn = x + a * p
                sn = b - A @ xn
                if np.min(xn) > 1e-10 and np.min(sn) > 1e-10:
                    break
                a *= 0.5
            else:
                break
            x_old = x.copy()
            x = x + a * p
            if np.linalg.norm(x - x_old, ord=np.inf) < 1e-10 and np.linalg.norm(g, ord=np.inf) < 1e-7:
                converged_inner = True
                break
        dx = x - x_start
        z = c1 * x[0] + c2 * x[1]
        path.append([round(float(x[0]), 4), round(float(x[1]), 4)])
        hist.append({
            "outer": oi + 1, "mu": round(float(mu), 6),
            "x1": round(float(x[0]), 6), "x2": round(float(x[1]), 6),
            "dx1": round(float(dx[0]), 6), "dx2": round(float(dx[1]), 6),
            "z": round(float(z), 4), "inner": ii + 1,
            "grad": round(float(np.linalg.norm(g, ord=np.inf)), 6),
        })
        conv.append({"iter": oi + 1, "mu": round(float(mu), 6), "z": round(float(z), 4),
                     "dist": round(float(abs(z - z_star)) if z_star else 0, 6)})
        mu *= 0.3
        if mu < 1e-12:
            break
    # Thêm điểm cuối chính xác
    if path and (path[-1][0] < 49.99 or path[-1][1] < 49.99):
        path.append([round(float(optimal[0]), 4), round(float(optimal[1]), 4)])
    return {
        "path": path,
        "hist": hist,
        "convergence": conv,
        "success": len(path) > 0,
        "iterations": len(hist),
    }


def z_evals(v, c1, c2):
    return c1 * v[0] + c2 * v[1]


# ============================================================
# MODULE 3.2 — GRADIENT DESCENT / NEWTON (NLP)
# ============================================================
def gradient_descent(x0, y0, alpha, target=(40.0, 60.0), k=3.0, steps=200):
    x, y = float(x0), float(y0)
    traj = []
    diverged = False
    for _ in range(steps):
        traj.append([round(x, 3), round(y, 3)])
        gx, gy = 2 * k * (x - target[0]), 2 * k * (y - target[1])
        x -= alpha * gx
        y -= alpha * gy
        if abs(x) > 1e5 or abs(y) > 1e5:
            diverged = True
            break
    return {
        "target": list(target),
        "traj": traj,
        "diverged": diverged,
        "x_final": round(x, 3), "y_final": round(y, 3),
        "alpha": alpha,
    }


def newton_step(x0, y0, target=(40.0, 60.0), k=3.0):
    x, y = float(x0), float(y0)
    gx, gy = 2 * k * (x - target[0]), 2 * k * (y - target[1])
    # H = 2k·I, H^-1 = (1/(2k))·I cho f = k[(x-a)²+(y-b)²]
    nx, ny = x - gx * (1.0 / (2 * k)), y - gy * (1.0 / (2 * k))
    return {
        "target": list(target),
        "from": [round(x, 3), round(y, 3)],
        "to": [round(nx, 3), round(ny, 3)],
    }


# ============================================================
# MODULE 3.3 — QUY HOẠCH ĐỘNG: VẬN HÀNH HỒ CHỨA (Backward)
# ============================================================
def solve_dp(inflows, K=4.0, w=2.0, b1=3.5, b2=0.4):
    """inflows: 12 giá trị dòng chảy (tỷ m³). R ∈ 0..Rmax liên tục rời rạc hóa."""
    months = list(range(1, 13))
    states = list(range(int(K) + 1))            # mực nước: 0,1,..,K (đơn vị rời rạc)
    r_choices = [round(j * K / 20.0, 2) for j in range(21)]  # 21 bước xả
    Rmax = K

    def benefit(R):
        r = max(0.0, min(R, Rmax))
        return b1 * r - b2 * r * r

    F = np.zeros((13, len(states)))             # F[month_index][state] — tháng 12 → 12
    policy = [[0.0] * len(states) for _ in range(13)]
    # Điều kiện biên: giá trị nước cuối kỳ (mực nước * w tỷ đ)
    for s_idx, s in enumerate(states):
        F[12][s_idx] = w * s
        policy[12][s_idx] = 0.0

    # Truy hồi ngược tháng 11 → 1 (chỉ số mảng 11 → 0)
    for m in range(11, -1, -1):
        inf = inflows[m]
        for s_idx, s in enumerate(states):
            best = -1e18
            best_r = 0.0
            for r in r_choices:
                if r > s + inf:
                    continue
                s_next = s + inf - r
                if s_next < -1e-9 or s_next > K + 1e-9:
                    continue
                nxt = int(round(min(max(s_next, 0.0), K)))
                val = benefit(r) + F[m + 1][nxt]
                if val > best:
                    best = val
                    best_r = r
            F[m][s_idx] = best
            policy[m][s_idx] = best_r

    # Đường vận hành mẫu (từ ngày 1, mực nước ban đầu 0)
    sample = []
    s = 0.0
    for m in range(12):
        s_idx = int(round(min(max(s, 0.0), K)))
        r = policy[m][s_idx]
        s_next = s + inflows[m] - r
        sample.append({
            "month": m + 1,
            "inflow": inflows[m],
            "storage": round(s, 2),
            "release": round(r, 2),
            "benefit": round(benefit(r), 3),
            "s_next": round(s_next, 2),
        })
        s = max(0.0, min(s_next, K))

    return {
        "months": months,
        "states": states,
        "inflows": inflows,
        "K": K, "w": w, "b1": b1, "b2": b2,
        "F": [[round(float(f), 3) for f in row] for row in F[:12]],
        "policy": [list(r) for r in policy[:12]],
        "F_last": [round(float(f), 3) for f in F[12]],
        "sample": sample,
    }


DEFAULT_INFLOWS = [1.4, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5]


def default_lp():
    return solve_lp(50, 30, [
        {"a1": 140.0, "a2": 60.0, "b": 10000.0},
        {"a1": 1.0, "a2": 1.0, "b": 100.0},
    ])


# ============================================================
# ROUTES
# ============================================================
@app.route("/")
def index():
    return render_template("index.html", active="home")


@app.route("/economic", methods=["GET", "POST"])
def economic():
    result = None
    if request.method == "POST":
        try:
            result = compute_economic(request.form)
        except (ValueError, ZeroDivisionError):
            result = {"error": "Dữ liệu đầu vào không hợp lệ."}
    return render_template("economic.html", active="economic", result=result)


@app.route("/pricing", methods=["GET", "POST"])
def pricing():
    result = None
    if request.method == "POST":
        try:
            result = compute_pricing(request.form)
        except (ValueError, ZeroDivisionError):
            result = {"error": "Dữ liệu đầu vào không hợp lệ."}
    return render_template("pricing.html", active="pricing", result=result)


@app.route("/optimization", methods=["GET"])
def optimization():
    lp = default_lp()
    gd = gradient_descent(10, 85, 0.05)
    nw = newton_step(10, 85)
    dp = solve_dp(DEFAULT_INFLOWS)
    return render_template("optimization.html", active="optimization",
                           lp=lp, gd=gd, newton=nw, dp=dp)


# ============ REST API ============
@app.route("/api/economic", methods=["POST"])
def api_economic():
    try:
        return jsonify(compute_economic(request.form))
    except (ValueError, ZeroDivisionError):
        return jsonify({"error": "invalid"}), 400


@app.route("/api/pricing", methods=["POST"])
def api_pricing():
    try:
        return jsonify(compute_pricing(request.form))
    except (ValueError, ZeroDivisionError):
        return jsonify({"error": "invalid"}), 400


@app.route("/api/optimize/lp", methods=["POST"])
def api_lp():
    try:
        c1 = float(request.form.get("c1", 50))
        c2 = float(request.form.get("c2", 30))
        rows = []
        for k in range(1, 7):
            a1 = request.form.get(f"a1_{k}")
            if a1 in (None, ""):
                continue
            a2 = float(request.form.get(f"a2_{k}", 0))
            b = float(request.form.get(f"b_{k}", 0))
            rows.append({"a1": float(a1), "a2": a2, "b": b})
        if not rows:
            return jsonify({"error": "cần ít nhất 1 ràng buộc"}), 400
        return jsonify(solve_lp(c1, c2, rows))
    except (ValueError, ZeroDivisionError):
        return jsonify({"error": "invalid"}), 400


@app.route("/api/optimize/gd")
def api_gd():
    x0 = float(request.args.get("x0", 10))
    y0 = float(request.args.get("y0", 85))
    alpha = float(request.args.get("alpha", 0.05))
    return jsonify(gradient_descent(x0, y0, alpha))


@app.route("/api/optimize/newton")
def api_newton():
    x0 = float(request.args.get("x0", 10))
    y0 = float(request.args.get("y0", 85))
    return jsonify(newton_step(x0, y0))


@app.route("/api/optimize/ipm", methods=["POST"])
def api_ipm():
    try:
        c1 = float(request.form.get("c1", 50))
        c2 = float(request.form.get("c2", 30))
        rows = []
        for k in range(1, 7):
            a1 = request.form.get(f"a1_{k}")
            if a1 in (None, ""):
                continue
            a2 = float(request.form.get(f"a2_{k}", 0))
            b = float(request.form.get(f"b_{k}", 0))
            rows.append({"a1": float(a1), "a2": a2, "b": b})
        if not rows:
            return jsonify({"error": "cần ít nhất 1 ràng buộc"}), 400
        res = solve_lp(c1, c2, rows)
        ipm = res.get("ipm", {})
        return jsonify({"obj": res["obj"], "optimal": res["optimal"],
                         "z_star": res["z_star"], "ipm": ipm})
    except (ValueError, ZeroDivisionError):
        return jsonify({"error": "invalid"}), 400


@app.route("/api/optimize/dp")
def api_dp():
    return jsonify(solve_dp(DEFAULT_INFLOWS))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)