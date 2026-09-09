# 💧 WaterOpt Edu — Webapp Tương tác Tối ưu hóa & Kinh tế Tài nguyên Nước

Nền tảng học tập tương tác giúp sinh viên Thủy lợi & Tài nguyên nước trực quan hóa 3 trụ cột:

1. **📊 Phân tích kinh tế dự án** — NPV, B/C, IRR, AW, Payback (Chương 3).
2. **🌾 Cơ chế giá nước nông nghiệp** — chi phí cho phép (准许成本), quy tắc 60%, giá lũy tiến, tham chiếu Hồ Nam 0,038 CNY/m³ (Chương 6, cơ chế Trung Quốc).
3. **🧠 Tối ưu hóa** — Quy hoạch tuyến tính 2 biến (vùng khả thi + hoạt ảnh Simplex/Interior Point), Gradient Descent & Newton trên bề mặt 3D, Quy hoạch động vận hành hồ chứa (truy hồi ngược).

## Tính năng
- 4 theme giao diện (Sáng / Tối / Hồ / Đồng ruộng), lưu theo trình duyệt.
- Layout sidebar, responsive desktop ↔ tablet (iPad) ↔ điện thoại.
- Công thức toán hiển thị bằng **KaTeX**, tooltip giải thích thuật ngữ; triết lý **"No Math Wall"**.

## Chạy tại chỗ (Docker)

```bash
cd wateropt_edu
docker compose up -d --build
# Truy cập: http://<IP-máy>:5001
```

## Chạy trực tiếp (Python)

```bash
pip install -r requirements.txt
python app.py
# http://127.0.0.1:5000
```

## REST API

| Endpoint | Phương thức | Mô tả |
|---|---|---|
| `/api/economic` | POST | Tính NPV/B/C/IRR/AW (form: invest, benefit, om, rate, nper, rep_cost, rep_year, salvage) |
| `/api/pricing` | POST | Tính giá nước (form: dep, om_labor, om_energy, om_repair, om_mgmt, profit, tax, design_q, actual_q, quota, use, area_ha, tier2, tier3) |
| `/api/optimize/lp` | POST | Giải LP 2 biến (form: c1, c2, a1_1..6, a2_1..6, b_1..6) |
| `/api/optimize/gd` | GET | Gradient Descent (query: x0, y0, alpha) |
| `/api/optimize/newton` | GET | Bước nhảy Newton (query: x0, y0) |
| `/api/optimize/dp` | GET | Quy hoạch động vận hành hồ chứa (dữ liệu mẫu) |

## Đơn vị
- Module 1: triệu USD. Module 2: triệu CNY / triệu m³ / CNY per m³ (quy đổi ₫ với tỉ giá tham chiếu 3.550 đ/CNY). Module 3: ha, tỷ m³, tỷ đồng.