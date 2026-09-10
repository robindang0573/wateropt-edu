# WaterOpt Edu — API Documentation

Ứng dụng giảng dạy quản lý nước: Phân tích kinh tế dự án, Giá nước, và Tối ưu
(Quy hoạch tuyến tính / Gradient–Newton / Quy hoạch động).

- **Base URL:** `https://dautieng.kttnn.online`
- **Định dạng dữ liệu:** `application/json`
- **Bảng trang web (HTML)**
- Mọi giá trị tiền tệ tính bằng **triệu** (USD/CNY); lãi suất nhập theo đơn vị **%** và được chia 100 trong tính toán.

---

## 1. Trang web (HTML)

| Method | Path             | Mô tả                                                        |
|--------|------------------|--------------------------------------------------------------|
| GET    | `/`              | Trang chủ                                                     |
| GET/POST | `/economic`    | Phân tích kinh tế dự án (NPV, IRR, B/C, thời gian hoàn vốn)  |
| GET/POST | `/pricing`     | Tính toán giá nước (eps-tĩnh/động, biểu giá 3 bậc)           |
| GET    | `/optimization`  | Module 3 — LP, Gradient/Newton, Interior Point, Quy hoạch động|

---

## 2. `POST /api/economic`

Phân tích kinh tế dự án theo nguyên tắc With–Without (dòng tiền chênh lệch ΔCF).

### Request — form-urlencoded

| Field         | Loại  | Mặc định | Mô tả                                      |
|---------------|-------|----------|--------------------------------------------|
| `invest`      | float | 0        | Vốn đầu tư ban đầu I                       |
| `benefit`     | float | 0        | Lợi ích hằng năm B                         |
| `om`          | float | 0        | Chi phí VH & BDT hằng năm OM               |
| `rate`        | float | 8        | Lãi suất chiết khấu i (%/năm)              |
| `nper`        | int   | 20       | Thời gian phân tích (năm)                  |
| `rep_year`    | int   | 10       | Năm thay thế thiết bị                      |
| `rep_cost`    | float | 0        | Chi phí thay thế                           |
| `salvage`     | float | 0        | Giá trị còn lại (cuối kỳ)                  |
| `base_benefit`| float | 0        | Lợi ích cơ sở "không có dự án" B₀          |
| `base_om`     | float | 0        | Chi phí cơ sở "không có dự án" OM₀         |
| `base_growth` | float | 0        | Mức tăng B₀ mỗi năm g₀ (%/năm)             |

### Response 200

| Trường            | Loại   | Mô tả                                              |
|-------------------|--------|----------------------------------------------------|
| `I, B, OM, B0, OM0`| float | Các tham số đầu vào (g0 theo %)                   |
| `i`               | float  | Lãi suất chiết khấu (%)                            |
| `n`               | int    | Số năm phân tích                                   |
| `npv`             | float  | NPV của dòng tiền chênh lệch                       |
| `bc`              | float|null | Tỷ số B/C (bằng hiệu PW) nếu có nghĩa              |
| `aw`              | float  | Worth niên kim hóa                                 |
| `irr`             | float|null | IRR (Newton–Raphson), `null` nếu không hội tụ      |
| `crf`             | float  | Hệ số hồi phục vốn (A/P, i, n)                     |
| `payback`         | int|null| Năm hòa vốn (chiết khấu)                            |
| `status`          | string | `"feasible"` nếu NPV > 0 và B/C > 1, ngược lại `"not"` |
| `years`, `cf`, `cum` | arrays | Trục năm, ΔCF, tổng lũy kế chiết khấu             |
| `cf_with` / `cf_without` | array | Dòng tiền có / không có dự án            |
| `pw_b_with`, `pw_c_with`, ... `pw_b_inc`, `pw_c_inc` | float | PW lợi ích / chi phí theo kịch bản |
| `table`           | array  | `{year, cf_with, cf_without, incremental, discounted}` |
| `discount_table`  | array  | `{year, face, factor, pv}` (phép chiếu P = F/(1+r)^t) |
| `irr_rows`        | array  | `{iter, r, npv}` — nhật ký lặp IRR                 |
| `npv_sweep`       | array  | `{r, npv}` — đường NPV(r)                         |
| `details`         | object | Chuỗi giải thích từng bước (giảng dạy)             |

### Lỗi

`400 {"error": "invalid"}` khi dữ liệu không hợp lệ.

```bash
curl -X POST https://dautieng.kttnn.online/api/economic \
  -d "invest=1000&benefit=250&om=60&rate=8&nper=20"
```

---

## 3. `POST /api/pricing`

Tính giá nước từ chi phí (khấu hao tĩnh/động) và doanh thu yêu cầu; có bảng giá 3 bậc.

### Request — form-urlencoded

| Field         | Loại  | Mặc định | Mô tả                                    |
|---------------|-------|----------|------------------------------------------|
| `invest`      | float | 100      | Vốn đầu tư (triệu CNY)                   |
| `dep_life`    | float | 5        | Số năm khấu hao                          |
| `mode`        | string| `static` | `static` | `dynamic`                   |
| `disc_rate`   | float | 6        | Tỉ suất chiết khấu xã hội (%)            |
| `om_labor`    | float | 0        | CP nhân công                             |
| `om_energy`   | float | 0        | CP điện năng                             |
| `om_repair`   | float | 0        | CP sửa chữa                              |
| `om_mgmt`     | float | 0        | CP quản lý                               |
| `profit`      | float | 5        | Tỷ suất lợi nhuận (%)                    |
| `tax`         | float | 3        | Thuế (%)                                 |
| `design_q`    | float | 100      | Lưu lượng thiết kế (m³/năm ·10⁶? theo UI)|
| `actual_q`    | float | 80       | Lưu lượng thực tế                        |
| `quota`       | float | 6000     | Định mức (m³/hộ/năm)                     |
| `use`         | float | 7200     | Lượng dùng hộ mẫu (m³/hộ/năm)            |
| `area_ha`     | float | 1000     | Diện tích vùng tưới (ha)                 |
| `tier2`       | float | 20       | Phụ giá bậc 2 (%) (vượt ≤10%)            |
| `tier3`       | float | 50       | Phụ giá bậc 3 (%) (vượt >10%)            |

### Response 200

| Trường           | Loại   | Mô tả                                        |
|------------------|--------|----------------------------------------------|
| `breakdown`      | object | Cơ cấu chi phí: Khấu hao, Nhân công, ...     |
| `cost_rows`      | array  | `{name, value, share, calc}` (tỉ trọng % + giải thích) |
| `dep_static` / `dep_dynamic` | float | Khấu hao đường thẳng / niên kim |
| `comp_static` / `comp_dynamic` | object | So sánh: `{C, profit, tax, R, price}` |
| `crf`            | float  | (A/P, i, n)                                  |
| `C`              | float  | Tổng chi phí năm                             |
| `profit_amt`, `tax_amt`, `R` | float | Lợi nhuận, thuế, doanh thu yêu cầu |
| `price_cny` / `price_vnd` | float|null | Giá nước (CNY/m³ và VND/m³; VND_PER_CNY=3550) |
| `q_pricing`      | float  | Lưu lượng định giá (quy tắc 60%: max(aq, 0.6·dq)) |
| `rule60`         | bool   | Có áp quy tắc 60% hay không                 |
| `tiers`          | array  | Giá 3 bậc: `{name, range, use, rate, price, amount}` |
| `bill`           | float  | Hóa đơn hộ mẫu (3 bậc)                      |
| `total_ha_*`     | float  | Doanh thu vùng (use/quota/bill × area_ha)   |

### Lỗi

`400 {"error": "invalid"}` khi dữ liệu không hợp lệ.

```bash
curl -X POST https://dautieng.kttnn.online/api/pricing \
  -d "invest=100&dep_life=5&mode=dynamic&disc_rate=6&design_q=100&actual_q=80"
```

---

## 4. `POST /api/optimize/lp`

Quy hoạch tuyến tính 2 biến: `Max Z = c₁x₁ + c₂x₂` với `a₁x₁ + a₂x₂ ≤ b`, `x ≥ 0`.
Trả về đồng thời: đánh giá đỉnh (đồ giải), bảng lặp Simplex và kết quả Interior Point.

### Request — form-urlencoded

| Field          | Loại  | Mặc định | Mô tả                              |
|----------------|-------|----------|------------------------------------|
| `c1`, `c2`     | float | 50, 30   | Hệ số hàm mục tiêu                 |
| `a1_k`, `a2_k`, `b_k` (k=1..6) | float | — | Ràng buộc thứ k; bỏ qua nếu `a1_k` rỗng |

- Tối đa 6 ràng buộc; cần ít nhất 1. Nếu không gửi ràng buộc → `400`.

### Response 200

| Trường      | Loại   | Mô tả                                       |
|-------------|--------|---------------------------------------------|
| `obj`       | [c1, c2] | Hệ số mục tiêu                             |
| `rows`      | array  | Các ràng buộc `{a1, a2, b}`                 |
| `vertices`  | array  | Đỉnh miền khả thi `[x1, x2]` (cùng chiều quanh) |
| `feasible`  | bool   | Có ≥ 3 đỉnh hay không                      |
| `status`    | string | `"optimal"` | `"infeasible"` | `"unbounded"`   |
| `note`      | string | Ghi chú khi không tối ưu                   |
| `optimal`   | [x1,x2]|null | Nghiệm tối ưu                              |
| `z_star`    | float|null | Giá trị Z tối ưu                            |
| `path`      | array  | Đường đi Simplex mô phạm `[ [x1,x2], ...]` |
| `xmax`, `ymax` | float | Giới hạn hiển thị đồ thị                  |
| `vertex_zs` | array  | `{x1, x2, z, optimal}` — Z tại từng đỉnh, sắp tăng dần |
| `simplex`   | object | Bảng lặp Simplex (xem dưới)                |
| `ipm`       | object | Kết quả Interior Point (xem §7)            |

#### `simplex`

```json
{ "iterations": [
  {
    "it": 1,
    "entering": "x1", "leaving": "s1", "pivot": 140.0,
    "z": 0.0,
    "point": [0.0, 0.0],
    "basis": ["s1", "s2"],
    "ratios": [71.4286, 100.0],
    "optimal": false,
    "var_names": ["x1","x2","s1","s2"],
    "tableau": [ [140.0,60.0,1.0,0.0,10000.0], ... , [0.0,0.0,0.25,15.0,4000.0] ]
  }
]}
```

- `tableau` = ma trận `[A|I|b]` + hàng Z cuối.
- `point` = tọa độ đỉnh hiện tại; `ratios[i]` ứng với hàng ràng buộc i (null nếu hệ số ≤ 0).

### Lỗi

`400 {"error": "cần ít nhất 1 ràng buộc"}` hoặc `{"error":"invalid"}`.

```bash
curl -X POST https://dautieng.kttnn.online/api/optimize/lp \
  -d "c1=50&c2=30&a1_1=140&a2_1=60&b_1=10000&a1_2=1&a2_2=1&b_2=100"
```

---

## 5. `GET /api/optimize/gd`

Gradient Descent trên `f(x,y) = k[(x−40)² + (y−60)²]`, k = 3, tối đa 200 bước.

### Query params

| Param  | Mặc định | Mô tả            |
|--------|----------|------------------|
| `x0`   | 10       | Điểm khởi tạo x  |
| `y0`   | 85       | Điểm khởi tạo y  |
| `alpha`| 0.05     | Bước học (learning rate) |

### Response 200

| Trường    | Loại  | Mô tả                                    |
|-----------|-------|------------------------------------------|
| `target`  | [40, 60] | Tâm hàm mục tiêu                       |
| `traj`    | array | Quỹ đạo `[ [x, y], ... ]`                |
| `diverged`| bool  | Có bùng nổ (|x| hoặc |y| > 1e5) hay không |
| `x_final`, `y_final` | float | Điểm dừng                |
| `alpha`   | float | Bước học đã dùng                         |

```bash
curl "https://dautieng.kttnn.online/api/optimize/gd?x0=10&y0=85&alpha=0.05"
```

---

## 6. `GET /api/optimize/newton`

Một bước Newton cho `f = 3[(x−40)² + (y−60)²]` với Hessian `H = 6I` (`Δx = −H⁻¹∇f`).

### Query params

| Param | Mặc định | Mô tả           |
|-------|----------|-----------------|
| `x0`  | 10       | Điểm khởi tạo x |
| `y0`  | 85       | Điểm khởi tạo y |

### Response 200

| Trường  | Loại     | Mô tả                                |
|---------|----------|--------------------------------------|
| `target`| [40, 60] | Tâm hàm mục tiêu                     |
| `from`  | [x, y]   | Điểm khởi tạo                        |
| `to`    | [x, y]   | Điểm sau 1 bước Newton (đúng đáy của hàm toàn phương) |

```bash
curl "https://dautieng.kttnn.online/api/optimize/newton?x0=10&y0=85"
# → {"target":[40,60],"from":[10,85],"to":[40,60]}
```

---

## 7. `POST /api/optimize/ipm`

Interior Point Method (Barrier) — tham số đầu vào giống hệt `/api/optimize/lp`.
Chỉ trả về phần IPM, hữu ích khi cần đúng dữ liệu hội tụ.

### Request

Giống §4 (`c1`, `c2`, `a1_k`, `a2_k`, `b_k`, k=1..6).

### Response 200

```json
{
  "obj": [50, 30],
  "optimal": [50, 50],
  "z_star": 4000.0,
  "ipm": {
    "path": [[26.9, 36.6], ...],
    "hist": [{
      "outer": 1, "mu": 2000.0,
      "x1": 26.924, "x2": 36.621, "dx1": 26.424, "dx2": 36.121,
      "z": 2444.83, "inner": 4, "grad": 0.0
    }],
    "convergence": [{ "iter": 1, "mu": 2000.0, "z": 2444.83, "dist": 1555.17 }],
    "success": true,
    "iterations": 18
  }
}
```

| Trường `hist` | Mô tả                                     |
|---------------|-------------------------------------------|
| `outer`       | Số vòng lặp ngoài (chuỗi μ)               |
| `mu`          | Tham số barrier hiện tại                  |
| `x1`, `x2`    | Nghiệm sau vòng ngoài                     |
| `dx1`, `dx2`  | Chuyển động Newton trong vòng đó          |
| `z`           | Giá trị hàm mục tiêu                      |
| `inner`       | Số bước Newton nội bộ                     |
| `grad`        | ‖∇Z_μ‖∞                                   |

`convergence[i].dist` = |Z − Z*|. `path` = central path qua không gian `[x1, x2]`.

### Lỗi

`400` khi thiếu ràng buộc hoặc dữ liệu không hợp lệ.

---

## 8. `GET /api/optimize/dp`

Quy hoạch động vận hành hồ chứa (12 tháng, truy hồi ngược). Dùng dòng chảy mặc định:
`[1.4, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5]`.

### Response 200

| Trường     | Loại  | Mô tả                                        |
|------------|-------|----------------------------------------------|
| `months`   | array | `[1..12]`                                    |
| `states`   | array | Mực nước rời rạc `0..K` (K = 4)              |
| `inflows`  | array | Dòng chảy 12 tháng                           |
| `K`, `w`, `b1`, `b2` | float | Hằng số mô hình                    |
| `F`        | array | Ma trận giá trị tối ưu `F[tháng][mực nước]`  |
| `policy`   | array | Chính sách xả `policy[tháng][mực nước]`      |
| `F_last`   | array | Giá trị cuối kỳ (nước còn lại)               |
| `sample`   | array | Đường vận hành mẫu `[{month, inflow, storage, release, benefit, s_next}]` |

```bash
curl https://dautieng.kttnn.online/api/optimize/dp
```

---

## Ghi chú

- Tất cả endpoint đều trả về nội dung dạng JSON. Nếu cần gọi từ trình duyệt có thể
  dùng `fetch`/`axios` bình thường.
- Trang web tự gọi các endpoint này: `static/js/plotly_app.js` (module tối ưu)
  và `static/js/app.js` (economic/pricing).