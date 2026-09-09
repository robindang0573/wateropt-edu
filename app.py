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
# ============================================================
def compute_economic(form):
    I = float(form.get("invest", 0))
    B = float(form.get("benefit", 0))
    OM = float(form.get("om", 0))
    i = float(form.get("rate", 8)) / 100.0
    n = int(form.get("nper", 20))
    rep_year = int(form.get("rep_year", 10))
    rep_cost = float(form.get("rep_cost", 0))
    salvage = float(form.get("salvage", 0))

    n = max(1, n)
    # Dòng tiền ròng qua từng năm (t = 0..n)
    cf = []
    pw_b, pw_c = 0.0, 0.0
    for t in range(n + 1):
        if t == 0:
            c = -I
            pw_c += I
        else:
            b = B + (salvage if t == n else 0.0)
            o = OM + (rep_cost if t == rep_year else 0.0)
            c = b - o
            if (1 + i) ** t > 0:
                pw_b += b / (1 + i) ** t
                pw_c += o / (1 + i) ** t
        cf.append(c)

    f = [(1 + i) ** t for t in range(n + 1)]
    npv = sum(cf[t] / f[t] for t in range(n + 1))
    bc = pw_b / pw_c if pw_c > 0 else None

    # AW: NPV × [i(1+i)^n] / [(1+i)^n − 1]  (i=0 → NPV/n)
    if abs(i) < 1e-12:
        aw = npv / n
    else:
        aw = npv * (i * (1 + i) ** n) / ((1 + i) ** n - 1)

    # IRR: tìm r sao cho NPV(r)=0 (brentq, dải (-0.999, 10))
    def npv_of(rr):
        rr = rr + 1.0
        return sum(cf[t] / (rr ** t) for t in range(n + 1))

    irr = None
    lo, hi = -0.999, 10.0
    try:
        if npv_of(lo) * npv_of(hi) < 0:
            irr = brentq(npv_of, lo, hi)
    except (ValueError, RuntimeError):
        pass

    # Dòng tiền chiết khấu lũy tích → Payback
    cum, payback = 0.0, None
    cum_list = []
    for t in range(n + 1):
        cum += cf[t] / f[t]
        cum_list.append(cum)
        if payback is None and t >= 1 and cum >= 0:
            payback = t

    status = "feasible" if npv > 0 and (bc is None or bc > 1) else "not"

    return {
        "I": I, "B": B, "OM": OM, "i": i * 100, "n": n,
        "rep_year": rep_year, "rep_cost": rep_cost, "salvage": salvage,
        "npv": npv, "bc": bc, "aw": aw, "irr": irr,
        "payback": payback,
        "years": list(range(n + 1)),
        "cf": [round(x, 2) for x in cf],
        "cum": [round(x, 2) for x in cum_list],
        "status": status,
        "pw_b": pw_b, "pw_c": pw_c,
    }


# ============================================================
# MODULE 2 — GIÁ NƯỚC NÔNG NGHIỆP (Cơ chế Trung Quốc, Chương 6)
# ============================================================
def compute_pricing(form):
    dep = float(form.get("dep", 0))
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

    breakdown = {
        "Khấu hao": dep,
        "Nhân công": om_lab,
        "Điện năng": om_en,
        "Sửa chữa": om_rep,
        "Quản lý": om_mg,
    }
    C = dep + om_lab + om_en + om_rep + om_mg
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

    return {
        "breakdown": breakdown,
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


@app.route("/api/optimize/dp")
def api_dp():
    return jsonify(solve_dp(DEFAULT_INFLOWS))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)