# WaterOpt Edu — API Documentation

Ứng dụng giảng dạy quản lý nước: Phân tích kinh tế dự án, Giá nước, và Tối ưu
(Quy hoạch tuyến tính / Gradient–Newton / Quy hoạch động).

- **Base URL:** `https://dautieng.kttnn.online`
- **Định dạng dữ liệu:** `application/json`
- **Bảng trang web (HTML)**
- Đơn vị tiền tệ theo từng mô-đun: Module 1 dùng triệu USD; Module 2 nhập chi phí tỷ đồng/năm và sản lượng triệu m³/năm, cho giá thành đồng/m³. Lãi suất nhập theo đơn vị **%**.

---

## 1. Trang web (HTML)

| Method | Path             | Mô tả                                                        |
|--------|------------------|--------------------------------------------------------------|
| GET    | `/`              | Trang chủ                                                     |
| GET/POST | `/economic`    | Phân tích kinh tế dự án (NPV, IRR, B/C, thời gian hoàn vốn)  |
| GET/POST | `/pricing`     | Tính giá thành nước sạch theo chi phí và sản lượng thương phẩm |
| GET/POST | `/pricing/agriculture` | Cơ chế tính giá nước nông nghiệp hiện có |
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

## 3. `POST /api/pricing/clean-water`

Tính giá thành nước sạch theo phương pháp Việt Nam `G=(E-F)/A`, giá bình quân minh họa `G+P`, đồng thời mô phỏng phương pháp doanh thu được phép kiểu Trung Quốc `G_CN=(C_allowed+Asset_effective×r_allowed+Tax)/Q_approved`. Chi phí nhập bằng tỷ đồng/năm; sản lượng bằng triệu m³/năm; đầu ra là đồng/m³. Phần Trung Quốc là mô hình giáo dục với tham số do người dùng giả định, không tạo giá chính thức.

### Request — form-urlencoded

| Field | Loại | Mặc định | Mô tả |
|---|---:|---:|---|
| `materials` | float | 25 | Vật tư, nguyên nhiên liệu trực tiếp (tỷ đồng/năm) |
| `labor` | float | 12 | Nhân công trực tiếp (tỷ đồng/năm) |
| `depreciation` | float | 22 | Khấu hao TSCĐ trực tiếp (tỷ đồng/năm) |
| `overhead` | float | 10 | Chi phí sản xuất chung (tỷ đồng/năm) |
| `other_production` | float | 4 | Chi phí hợp lý khác phục vụ sản xuất (tỷ đồng/năm) |
| `selling` | float | 4 | Chi phí bán hàng (tỷ đồng/năm) |
| `management` | float | 7 | Chi phí quản lý (tỷ đồng/năm) |
| `financial` | float | 3 | Chi phí tài chính (tỷ đồng/năm) |
| `other_revenue` | float | 0.6 | Khoản thu khác được giảm trừ F (tỷ đồng/năm) |
| `production_volume` | float | 12 | Sản lượng sản xuất Qsx (triệu m³/năm) |
| `loss_rate` | float | 10 | Tỷ lệ hao hụt (%) |
| `profit_per_m3` | float | 500 | P, lợi nhuận/tích lũy minh họa (đồng/m³) |
| `cn_allowed_cost` | float | 60 | Chi phí được phép sau giám sát (tỷ đồng/năm) |
| `cn_effective_assets` | float | 300 | Tài sản hiệu quả được phép tính sinh lợi (tỷ đồng) |
| `cn_tax` | float | 3 | Thuế được phép (tỷ đồng/năm) |
| `cn_debt_ratio` | float | 40 | Tỷ trọng nợ D (%) |
| `cn_equity_return` | float | 7 | Tỷ suất sinh lợi vốn chủ sở hữu rE (%/năm) |
| `cn_debt_return` | float | 3.5 | Tỷ suất sinh lợi vốn vay rD (%/năm) |
| `cn_approved_volume` | float | 10.8 | Sản lượng được duyệt, sau tự dùng và thất thoát được chấp nhận (triệu m³/năm) |
| `cn_utilization` | float | 75 | Mức sử dụng công suất thiết kế (%); dưới 65% sẽ áp dụng điều chỉnh mẫu số minh họa |

Sản lượng thương phẩm `A=Qsx×(1−loss_rate/100)`. Mỗi chi phí và sản lượng phải không âm; `loss_rate<100` và A phải lớn hơn 0.

### Response 200

Trả về các trường `production_cost` (B), `total_cost` (E), `other_revenue` (F), `net_cost` (E−F), `commercial_volume` (A), `unit_cost` (G, đồng/m³), `vietnam_average_price` (G+P), `china_allowed_return_rate`, `china_allowed_return`, `china_allowed_revenue`, `china_pricing_volume`, `china_unit_price`, các giá trị đầu vào `inputs` và `cost_rows`. Mỗi dòng chi phí có `name`, `amount` (tỷ đồng/năm), `unit_cost` (đồng/m³), `share` (% tổng E) và mô tả cách xác định.

### Ví dụ

```bash
curl -X POST https://dautieng.kttnn.online/api/pricing/clean-water \
  -d "materials=25&labor=12&depreciation=22&overhead=10&other_production=4&selling=4&management=7&financial=3&other_revenue=0.6&production_volume=12&loss_rate=10"
```

Với dữ liệu mẫu Việt Nam, E=87 tỷ đồng/năm, F=0,6 tỷ đồng/năm, A=10,8 triệu m³/năm, G=8.000 đồng/m³ và G+P=8.500 đồng/m³. Tham số Trung Quốc cho phép tự chỉnh riêng để so sánh.

Mô hình Trung Quốc dựa trên công thức lợi nhuận được phép bằng tài sản hiệu quả nhân tỷ suất sinh lợi bình quân gia quyền. Khi mức sử dụng công suất thấp hơn 65%, mô phỏng điều chỉnh mẫu số theo mốc 65%. Căn cứ tham khảo: [NDRC — Biện pháp quản lý giá cấp nước đô thị](https://zfxxgk.ndrc.gov.cn/web/iteminfo.jsp?id=18524) và [NDRC — Biện pháp giám sát chi phí định giá nước đô thị](https://zfxxgk.ndrc.gov.cn/web/iteminfo.jsp?id=18523).

### Lỗi

`400 {"error": "invalid"}` khi dữ liệu không hợp lệ.

## 3.1 `POST /api/pricing` — giá nước nông nghiệp

Giữ API giá nước nông nghiệp hiện có với các tham số về vốn, khấu hao, chi phí vận hành, doanh thu cho phép, quy tắc 60% và biểu giá lũy tiến. Các trường và cấu trúc kết quả tương thích với phiên bản trước.

Các trường chính gồm `invest`, `dep_life`, `mode`, `disc_rate`, `om_labor`, `om_energy`, `om_repair`, `om_mgmt`, `profit`, `tax`, `design_q`, `actual_q`, `quota`, `use`, `area_ha`, `tier2` và `tier3`. Đơn vị tiền là triệu đồng, lượng nước năm là triệu m³, định mức hộ là m³/hộ/năm.

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

Quy hoạch động phân bổ nước hồ chứa cho phát điện, tưới và sinh hoạt (12 tháng, truy hồi ngược). Dùng dòng vào mặc định:
`[1.4, 1.2, 1.0, 0.9, 0.8, 0.6, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5]` tỷ m³.
Lợi ích tháng là tổng của `B_H(H)=6H−1.5H²`, `B_A(A)=8A−2.5A²` và
`B_D(D)=12D−10D²`; giới hạn mỗi tháng lần lượt là `H≤0.8`, nhu cầu tưới theo mùa,
`D≤0.4` tỷ m³. Mục tiêu cộng tổng lợi ích 12 tháng với giá trị nước cuối kỳ `2S₁₃`.

### Response 200

| Trường     | Loại  | Mô tả                                        |
|------------|-------|----------------------------------------------|
| `months`   | array | `[1..12]`                                    |
| `states`   | array | 41 mức trữ lượng từ `0` đến `4.0`, bước `0.1` tỷ m³ |
| `inflows`  | array | Dòng chảy 12 tháng                           |
| `K`, `w`, `step`, `state_step` | float | Dung tích, giá trị nước cuối kỳ, bước phân bổ `0.2` và bước trạng thái `0.1` |
| `irrigation_demand` | array | Nhu cầu tưới tối đa theo tháng |
| `benefit_coefficients` | object | Hệ số hàm lợi ích của ba mục đích |
| `F`        | array | Ma trận giá trị tối ưu `F[tháng][mực nước]` |
| `policy`   | array | Tổng phân bổ nước tối ưu theo tháng và trạng thái |
| `sector_policy` | array | Phân bổ tối ưu H/A/D theo tháng và trạng thái |
| `F_last`   | array | Giá trị cuối kỳ `w·S₁₃` theo trạng thái |
| `sample`   | array | Quỹ đạo mẫu gồm H, A, D, tổng lợi ích và trữ lượng |
| `sample_steps` | array | Các phương án khả thi và phép tính Bellman theo từng tháng |

```bash
curl https://dautieng.kttnn.online/api/optimize/dp
```

---

## Ghi chú

- Tất cả endpoint đều trả về nội dung dạng JSON. Nếu cần gọi từ trình duyệt có thể
  dùng `fetch`/`axios` bình thường.
- Trang web tự gọi các endpoint này: `static/js/plotly_app.js` (module tối ưu)
  và `static/js/app.js` (economic/pricing).
