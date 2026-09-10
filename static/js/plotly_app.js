/* ============================================================
   WaterOpt Edu — Plotly tương tác: LP / GD-Newton / DP
   ============================================================ */
(function () {
    const SLEEP = (ms) => new Promise(r => setTimeout(r, ms));
    const CNF = { responsive: true, displayModeBar: false, scrollZoom: false };
    let lpStop = false, gdStop = false, dpStop = false;

    function fmt(v) {
        return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    }
    function zval(o, c1, c2) { return c1 * o[0] + c2 * o[1]; }

    /* ============================= LP ============================= */
    function readLPForm() {
        const c1 = parseFloat(document.getElementById('lp_c1').value) || 0;
        const c2 = parseFloat(document.getElementById('lp_c2').value) || 0;
        const rows = [];
        document.querySelectorAll('.cons-row').forEach(function (row) {
            const a1 = row.querySelector('.con_a1').value.trim();
            const a2 = row.querySelector('.con_a2').value.trim();
            const b = row.querySelector('.con_b').value.trim();
            if (a1 === '' && a2 === '' && b === '') return;
            rows.push({ a1: parseFloat(a1) || 0, a2: parseFloat(a2) || 0, b: parseFloat(b) || 0 });
        });
        return { c1: c1, c2: c2, rows: rows };
    }

    function buildLPTraces(data, contourK) {
        const traces = [];
        const { rows, xmax, ymax } = data;
        const X = Math.max(xmax, ymax);

        // Vùng khả thi (polygon)
        if (data.feasible && data.vertices.length >= 3) {
            const v = data.vertices.slice();
            v.push(data.vertices[0]);
            traces.push({
                x: v.map(p => p[0]), y: v.map(p => p[1]), type: 'scatter', mode: 'lines',
                fill: 'toself', fillcolor: 'rgba(10,147,150,0.22)',
                line: { color: 'rgba(10,147,150,0.9)', width: 2 }, name: 'Miền khả thi', hoverinfo: 'skip'
            });
        }

        // Các đường ràng buộc
        rows.forEach(function (r, i) {
            if (Math.abs(r.a2) > 1e-9) {
                const xs = [0, X * 1.15];
                const ys = xs.map(x => (r.b - r.a1 * x) / r.a2);
                traces.push({ x: xs, y: ys, type: 'scatter', mode: 'lines',
                    line: { color: '#e76f51', width: 1.5, dash: 'dot' }, hoverinfo: 'skip', showlegend: false });
            } else if (Math.abs(r.a1) > 1e-9) {
                const xv = r.b / r.a1;
                traces.push({ x: [xv, xv], y: [0, ymax] , type: 'scatter', mode: 'lines',
                    line: { color: '#e76f51', width: 1.5, dash: 'dot' }, hoverinfo: 'skip', showlegend: false });
            }
        });

        // Đường đồng mức Z (các mức khác nhau)
        if (data.z_star !== null) {
            [(0.2), 0.35, 0.5, 0.65, 0.8, 0.95].forEach(function (k, i) {
                const z0 = k * data.z_star;
                const xs = [0, X * 1.2];
                const ys = xs.map(x => (data.obj[1] !== 0 ? (z0 - data.obj[0] * x) / data.obj[1] : null));
                if (data.obj[1] !== 0) {
                    traces.push({ x: xs, y: ys, type: 'scatter', mode: 'lines',
                        line: { color: '#8d99ae', width: 1.4 - i * 0.1, dash: 'dash' },
                        name: k === contourK ? 'Z = ' + fmt(z0) : '', hoverinfo: 'skip', showlegend: false });
                }
            });
        }

        // Đỉnh tối ưu
        if (data.optimal) {
            traces.push({
                x: [data.optimal[0]], y: [data.optimal[1]], type: 'scatter', mode: 'markers+text',
                marker: { size: 15, color: '#0a9396', symbol: 'star' },
                text: ['★ ' + fmt(zval(data.optimal, data.obj[0], data.obj[1]))],
                textposition: 'top center', name: 'Tối ưu', hovertemplate: 'x₁=%{x}<br>x₂=%{y}<extra></extra>'
            });
        }
        return traces;
    }

    function plotLP(data, contourK) {
        const traces = buildLPTraces(data, contourK);
        const X = Math.max(data.xmax, data.ymax);
        Plotly.newPlot('lpPlot', traces, {
            margin: { t: 12, b: 50, l: 60, r: 20 },
            xaxis: { title: 'x₁ (ha)', range: [0, X * 1.08], zeroline: false },
            yaxis: { title: 'x₂ (ha)', range: [0, X * 1.08], zeroline: false },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            showlegend: false
        }, CNF);
    }

    async function animateLP(path, name, color) {
        lpStop = false;
        const X = Math.max(window.__lpCur.xmax, window.__lpCur.ymax);
        let elapsed = 0;
        for (let i = 0; i < path.length; i++) {
            if (lpStop) return;
            const seen = path.slice(0, i + 1);
            await Plotly.react('lpPlot', buildLPTraces(window.__lpCur).concat({
                x: seen.map(p => p[0]), y: seen.map(p => p[1]), type: 'scatter', mode: 'lines+markers',
                line: { color: color, width: 3.5 }, marker: { size: 9, color: color },
                name: name, hoverinfo: 'skip', showlegend: false
            }), {
                margin: { t: 12, b: 50, l: 60, r: 20 },
                xaxis: { title: 'x₁ (ha)', range: [0, X * 1.08] },
                yaxis: { title: 'x₂ (ha)', range: [0, X * 1.08] },
                paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
            }, CNF);
            await SLEEP(650);
        }
    }

    async function lpSolveClick() {
        const f = readLPForm();
        const fd = new FormData();
        fd.append('c1', f.c1); fd.append('c2', f.c2);
        f.rows.forEach(function (r, i) {
            fd.append('a1_' + (i + 1), r.a1); fd.append('a2_' + (i + 1), r.a2); fd.append('b_' + (i + 1), r.b);
        });
        document.getElementById('lpStatus').textContent = '⏳ Đang giải...';
        document.getElementById('lpStatus').classList.remove('hidden');
        try {
            const res = await fetch('/api/optimize/lp', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.error) { document.getElementById('lpStatus').textContent = '⚠️ ' + data.error; return; }
            window.__lpCur = data;
            plotLP(data, 0.6);
            document.getElementById('lpContent').classList.remove('hidden');
            document.getElementById('lpSimplexContent').classList.add('hidden');
            populateVertexTable(data);
            const st = document.getElementById('lpStatus');
            if (data.status === 'optimal') {
                st.textContent = '✅ Tối ưu: x₁ = ' + fmt(data.optimal[0]) + ', x₂ = ' + fmt(data.optimal[1]) +
                    '  ·  Z* = ' + fmt(data.z_star);
            } else {
                st.textContent = '⚠️ ' + data.note;
            }
        } catch (e) {
            document.getElementById('lpStatus').textContent = '⚠️ Lỗi kết nối API.';
        }
    }

    async function lpSimplexClick() {
        if (!window.__lpCur || !window.__lpCur.feasible) {
            document.getElementById('lpStatus').textContent = '⚠️ Hãy ấn "Giải & Vẽ" trước.';
            document.getElementById('lpStatus').classList.remove('hidden');
            return;
        }
        document.getElementById('lpSimplexContent').classList.remove('hidden');
        populateSimplexTable(window.__lpCur.simplex);
        await animateLP(window.__lpCur.path || [], 'Simplex', '#005f73');
    }

    function populateVertexTable(data) {
        const tbody = document.querySelector('#lpVertexTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        (data.vertex_zs || []).forEach(function (v, i) {
            const tr = document.createElement('tr');
            if (v.optimal) tr.className = 'active-row';
            const note = v.optimal
                ? '★ Tối ưu (Z lớn nhất)'
                : (i === 0 ? 'Khởi tạo, Z nhỏ nhất' : 'Ứng viên');
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + fmt(v.x1) + '</td><td>' + fmt(v.x2) + '</td>' +
                '<td><b>' + fmt(v.z) + '</b></td><td>' + note + '</td>';
            tbody.appendChild(tr);
        });
    }

    function populateSimplexTable(sim) {
        const tbody = document.querySelector('#lpSimplexTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const its = (sim && sim.iterations) ? sim.iterations : [];
        if (!its.length) {
            tbody.innerHTML = '<tr><td class="cell-note">⚠️ Hệ này không lập được bảng Simplex (miền khả thi rỗng).</td></tr>';
            return;
        }
        const names = its[0].var_names || ['x1', 'x2', 's1', 's2'];
        const cols = names.length + 3;
        its.forEach(function (it) {
            let title = 'Lặp ' + it.it + ' · đỉnh (x₁, x₂) = (' + fmt(it.point[0]) + '; ' + fmt(it.point[1]) + ')' +
                ' · Z = <b>' + fmt(it.z) + '</b>';
            if (it.entering) title += ' · vào: <b>' + it.entering + '</b>';
            if (it.leaving) title += ' · ra: <b>' + it.leaving + '</b> · trục = <b>' + fmt(it.pivot) + '</b>';
            if (it.optimal) title += '  ✅ TỐI ƯU';
            tbody.insertAdjacentHTML('beforeend',
                '<tr class="itr-hdr"><td colspan="' + cols + '">' + title + '</td></tr>');
            let hdr = '<tr class="itr-colhdr"><th>Biến cơ sở</th>';
            names.forEach(function (nm) { hdr += '<th>' + nm + '</th>'; });
            hdr += '<th>RHS</th><th>Tỷ số</th></tr>';
            tbody.insertAdjacentHTML('beforeend', hdr);

            const enterIdx = it.entering ? names.indexOf(it.entering) : -1;
            const leaveRow = it.leaving ? it.basis.indexOf(it.leaving) : -1;
            const rows = it.tableau;
            const nrow = rows.length - 1;

            rows.forEach(function (row, i) {
                const isZ = (i === nrow);
                const isLeave = (i === leaveRow);
                let cells = '<td><b>' + (isZ ? 'Z' : it.basis[i]) + '</b></td>';
                for (let j = 0; j < names.length; j++) {
                    let cls = '';
                    if (j === enterIdx) cls = (isZ || !isLeave) ? ' enter-col' : ' pivot-cell';
                    cells += '<td' + (cls ? ' class="' + cls.trim() + '"' : '') + '>' + fmt(row[j]) + '</td>';
                }
                cells += '<td>' + fmt(row[names.length]) + '</td>';   // RHS
                if (isZ) {
                    cells += '<td>—</td>';
                } else {
                    cells += '<td>' + (it.ratios[i] != null ? fmt(it.ratios[i]) : '—') + '</td>';
                }
                tbody.insertAdjacentHTML('beforeend',
                    '<tr' + (isZ ? ' class="itr-zrow"' : '') + '>' + cells + '</tr>');
            });
        });
    }

    async function lpInteriorClick() {
        if (!window.__lpCur || !window.__lpCur.optimal) {
            document.getElementById('ipmStatus').textContent = '⚠️ Hãy ấn "Giải & Vẽ" trước.';
            document.getElementById('ipmStatus').classList.remove('hidden');
            return;
        }
        const f = readLPForm();
        const fd = new FormData();
        fd.append('c1', f.c1); fd.append('c2', f.c2);
        f.rows.forEach(function (r, i) {
            fd.append('a1_' + (i + 1), r.a1); fd.append('a2_' + (i + 1), r.a2); fd.append('b_' + (i + 1), r.b);
        });
        document.getElementById('ipmContent').classList.remove('hidden');
        document.getElementById('ipmStatus').textContent = '⏳ Đang chạy Interior Point...';
        document.getElementById('ipmStatus').classList.remove('hidden');
        try {
            const res = await fetch('/api/optimize/ipm', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.error) { document.getElementById('ipmStatus').textContent = '⚠️ ' + data.error; return; }
            const ipm = data.ipm;
            const o = data.optimal;
            const st = document.getElementById('ipmStatus');
            st.textContent = '✅ Interior Point: x₁ = ' + fmt(o[0]) + ', x₂ = ' + fmt(o[1]) +
                '  ·  Z* = ' + fmt(data.z_star) + '  (sau ' + ipm.iterations + ' bước barrier)';
            populateIpmTable(ipm);
            if (ipm.path && ipm.path.length > 1) {
                await animateLP(ipm.path, 'Interior Point', '#9d4edd');
            }
            drawIpmConvergence(ipm.convergence || []);
        } catch (e) {
            document.getElementById('ipmStatus').textContent = '⚠️ Lỗi kết nối API.';
        }
    }

    function populateIpmTable(ipm) {
        const tbody = document.querySelector('#ipmTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const theory = [
            'Khởi tạo điểm khả thi trong: x>0, s = b−Ax > 0; tính ∇Z_μ, H.',
            'μ lớn → hàm rào cản chi phối, nghiệm gần tâm Chebyshev của miền.',
            'μ giảm (×0.3) → central path dịch về phía đỉnh tối ưu.',
            'Lặp Newton: giải H·Δx = −∇Z_μ, line search giữ x>0, s>0.',
            'Giai đoạn cuối: μ→0, nghiệm hội tụ về (50,50), Z=4000.'
        ];
        (ipm.hist || []).forEach(function (h, idx) {
            const t = theory[idx % theory.length];
            const tr = document.createElement('tr');
            tr.innerHTML = '<td>' + h.outer + '</td>' +
                '<td style="font-size:0.72em;color:var(--muted);min-width:220px;max-width:260px">' + t + '</td>' +
                '<td>' + h.mu + '</td><td>' + fmt(h.x1) + '</td><td>' + fmt(h.x2) + '</td><td>' + fmt(h.z) + '</td>' +
                '<td>' + fmt(h.dx1) + '</td><td>' + fmt(h.dx2) + '</td><td>' + h.grad + '</td>';
            tbody.appendChild(tr);
        });
    }

    function drawIpmConvergence(conv) {
        if (!conv || conv.length === 0) return;
        const traces = [
            {
                x: conv.map(function (c) { return c.iter; }),
                y: conv.map(function (c) { return c.z; }),
                type: 'scatter', mode: 'lines+markers',
                line: { color: '#9d4edd', width: 3 }, marker: { size: 6 },
                name: 'Z(μ)', hovertemplate: 'Bước %{x}<br>Z=%{y}<extra></extra>'
            },
            {
                x: conv.map(function (c) { return c.iter; }),
                y: conv.map(function (c) { return c.z; }).map(function (z, i) {
                    return z + (conv[i].mu > 0.01 ? conv[i].mu * 10 : 0);
                }),
                type: 'scatter', mode: 'markers',
                marker: { size: 4, color: '#e76f51', symbol: 'triangle-up' },
                name: 'Giới trên (Z + μ·10)', hoverinfo: 'skip', showlegend: false
            }
        ];
        // Thêm đường Z* mốc
        if (window.__lpCur && window.__lpCur.z_star) {
            traces.push({
                x: [1, conv.length], y: [window.__lpCur.z_star, window.__lpCur.z_star],
                type: 'scatter', mode: 'lines',
                line: { color: '#0a9396', width: 2, dash: 'dash' },
                name: 'Z*', hoverinfo: 'skip'
            });
        }
        Plotly.newPlot('ipmConvChart', traces, {
            margin: { t: 12, b: 40, l: 55, r: 15 },
            xaxis: { title: 'Bước barrier (outer)', zeroline: false },
            yaxis: { title: 'Z(μ)' },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: 'h', y: 1.12 },
            showlegend: true
        }, CNF);
    }

    /* ============================= GD / NEWTON ============================= */
    function getGDForm() {
        return {
            x0: parseFloat(document.getElementById('gd_x0').value) || 0,
            y0: parseFloat(document.getElementById('gd_y0').value) || 0,
            alpha: parseFloat(document.getElementById('gdAlpha').value) || 0.05
        };
    }

    function gdTrajectory(x0, y0, alpha, target, steps, k) {
        let x = x0, y = y0;
        const traj = []; let diverged = false;
        for (let i = 0; i < steps; i++) {
            traj.push([x, y]);
            const gx = 2 * k * (x - target[0]), gy = 2 * k * (y - target[1]);
            x -= alpha * gx; y -= alpha * gy;
            if (Math.abs(x) > 1e5 || Math.abs(y) > 1e5) { diverged = true; break; }
        }
        return { traj: traj, diverged: diverged, xf: x, yf: y };
    }

    const GD_K = 3.0;

    function gdSurface(target) {
        const R = 110;
        const n = 61;
        const xs = [], ys = [], zs = [];
        const xv = [], yv = [];
        for (let i = 0; i < n; i++) { xv.push(-R + (2 * R * i) / (n - 1)); yv.push(-R + (2 * R * i) / (n - 1)); }
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < n; j++) {
                row.push(GD_K * (Math.pow(xv[i] - target[0], 2) + Math.pow(yv[j] - target[1], 2)));
            }
            ys.push(row); xs.push(xv[i]);
        }
        return { x: xv, y: yv, z: ys };
    }

    function plotGDSurface(traj, nwp) {
        const target = [40, 60];
        const surf = gdSurface(target);
        const traces = [{
            type: 'surface', x: surf.x, y: surf.y, z: surf.z,
            colorscale: 'Viridis', opacity: 0.86, showscale: false,
            contours: { z: { show: true, usecolormap: true, highlightcolor: '#e9c46a', project: { z: true } } },
            hoverinfo: 'skip'
        }];
        if (traj && traj.length) {
            traces.push({
                type: 'scatter3d', mode: 'lines', x: traj.map(p => p[0]),
                y: traj.map(p => p[1]), z: traj.map(p => GD_K * (Math.pow(p[0] - 40, 2) + Math.pow(p[1] - 60, 2))),
                line: { color: '#e76f51', width: 6 }, hoverinfo: 'skip', name: 'Gradient Descent'
            });
        }
        if (nwp) {
            traces.push({
                type: 'scatter3d', mode: 'lines+markers',
                x: [nwp.from[0], target[0]], y: [nwp.from[1], target[1]],
                z: [GD_K * (Math.pow(nwp.from[0] - 40, 2) + Math.pow(nwp.from[1] - 60, 2)), 0],
                line: { color: '#9d4edd', width: 7, dash: 'dot' }, marker: { size: 5, color: '#9d4edd' },
                name: 'Newton (1 bước)', hoverinfo: 'skip'
            });
        }
        Plotly.newPlot('gdPlot', traces, {
            margin: { t: 10, b: 10, l: 10, r: 10 },
            scene: {
                xaxis: { title: 'x' }, yaxis: { title: 'y' }, zaxis: { title: 'f(x,y)' },
                camera: { eye: { x: 1.6, y: -1.6, z: 0.7 } }
            },
            paper_bgcolor: 'rgba(0,0,0,0)'
        }, CNF);
    }

    async function gdRun() {
        gdStop = false;
        const f = getGDForm();
        const target = [40, 60];
        const res = gdTrajectory(f.x0, f.y0, f.alpha, target, 200, GD_K);
        plotGDSurface([], null);
        const st = document.getElementById('gdStatus');
        st.classList.remove('hidden');

        // Animation: vẽ dần dần
        const n = res.traj.length;
        const chunk = Math.max(1, Math.floor(n / 40));
        for (let i = 5; i <= n; i += chunk) {
            if (gdStop) break;
            const seen = res.traj.slice(0, i);
            plotGDSurface(seen, null);
            await SLEEP(60);
        }
        const warn = document.getElementById('gdWarn');
        if (res.diverged) {
            warn.textContent = '🚨 PHÂN KỲ! α = ' + fmt(f.alpha) + ' quá lớn — bóng nhảy văng ra khỏi "bát" (giá trị f tăng vô hạn). Thử α nhỏ hơn (ví dụ 0,05).';
            warn.classList.remove('hidden');
            st.innerHTML = '💥 Hội tụ thất bại tại bước ' + res.traj.length;
        } else {
            warn.classList.add('hidden');
            st.innerHTML = '✅ Hội tụ về (' + fmt(res.xf) + ', ' + fmt(res.yf) + ') sau <b>' + res.traj.length + '</b> bước với α = ' + fmt(f.alpha);
        }
        document.getElementById('gdContent').classList.remove('hidden');
        document.querySelectorAll('.gd-result').forEach(function (el) { el.classList.remove('hidden'); });
        drawGdConvergence(res.traj, target);
        populateGDTable(res.traj, 'gd');
    }

    function drawGdConvergence(traj, target) {
        const fvals = traj.map(function (p) { return GD_K * (Math.pow(p[0] - target[0], 2) + Math.pow(p[1] - target[1], 2)); });
        const trace = {
            x: traj.map(function (_, i) { return i; }),
            y: fvals,
            type: 'scatter', mode: 'lines+markers',
            line: { color: '#0a9396', width: 3 }, marker: { size: 5 },
            name: 'f(x,y)'
        };
        Plotly.newPlot('gdConvChart', [trace], {
            margin: { t: 12, b: 40, l: 55, r: 15 },
            xaxis: { title: 'Bước lặp', zeroline: false },
            yaxis: { title: 'f(x,y)' },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: 'h', y: 1.12 },
            showlegend: true
        }, CNF);
    }

    function gdNewton() {
        const f = getGDForm();
        let from;
        const t = [40, 60];
        if (window.__NEWTON) {
            // dùng dữ liệu mặc định từ server; nếu user đổi x0,y0 thì tính lại
            if (Math.abs(window.__NEWTON.from[0] - f.x0) > 1e-6 || Math.abs(window.__NEWTON.from[1] - f.y0) > 1e-6) {
                const mx = f.x0 - (2 * GD_K * (f.x0 - t[0])) / (2 * GD_K), my = f.y0 - (2 * GD_K * (f.y0 - t[1])) / (2 * GD_K);
                from = [f.x0, f.y0]; t[0] = mx; t[1] = my;
            } else {
                from = window.__NEWTON.from; t[0] = 40; t[1] = 60;
            }
        } else {
            from = [f.x0, f.y0];
        }
        document.getElementById('gdContent').classList.remove('hidden');
        document.querySelectorAll('.gd-result').forEach(function (el) { el.classList.add('hidden'); });
        plotGDSurface([], { from: from, to: t });
        document.getElementById('gdStatus').classList.remove('hidden');
        document.getElementById('gdStatus').innerHTML =
            '🚁 Newton dùng <b>xấp xỉ bậc 2 (Hessian)</b>: chỉ cần <b>1 bước</b> để về đáy ' +
            '(' + fmt(from[0]) + ', ' + fmt(from[1]) + ') → (' + fmt(t[0]) + ', ' + fmt(t[1]) + '). Đây chính là "cái bát giả định" hoàn hảo vì f(x,y) là hàm toàn phương.';
        document.getElementById('gdWarn').classList.add('hidden');
        const fv = GD_K * (Math.pow(from[0] - 40, 2) + Math.pow(from[1] - 60, 2));
        const st = document.getElementById('gdStatus');
        st.innerHTML += '<br>📉 f(x₀,y₀) = ' + fmt(fv) + ' → f(x₁,y₁) = 0 sau đúng 1 bước Newton.';
    }

    function populateGDTable(traj, method) {
        const tbody = document.querySelector('#gdTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const k = 3.0;
        const isNewton = (method === 'newton');
        const last = traj.length - 1;
        traj.forEach(function (p, i) {
            const gx = 2 * k * (p[0] - 40);
            const gy = 2 * k * (p[1] - 60);
            const fv = k * (Math.pow(p[0] - 40, 2) + Math.pow(p[1] - 60, 2));
            const tr = document.createElement('tr');
            const methodLabel = isNewton
                ? (i === 0 ? 'Newton: khởi tạo' : 'Newton: kết quả (f=0)')
                : 'GD (α=' + document.getElementById('gdAlpha').value + ')';
            tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + fmt(p[0]) + '</td><td>' + fmt(p[1]) + '</td>' +
                '<td>' + fmt(gx) + '</td><td>' + fmt(gy) + '</td><td><b>' + fmt(fv) + '</b></td><td>' + methodLabel + '</td>';
            tbody.appendChild(tr);
        });
        if (isNewton && traj.length >= 2) {
            const tr = document.createElement('tr');
            tr.className = 'active-row';
            const p0 = traj[0], p1 = traj[last];
            const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
            tr.innerHTML = '<td>Δ</td><td>' + fmt(dx) + '</td><td>' + fmt(dy) + '</td>' +
                '<td>' + fmt(2 * k * (p1[0] - 40)) + '</td><td>' + fmt(2 * k * (p1[1] - 60)) + '</td>' +
                '<td>0</td><td>Δx = −H⁻¹∇f</td>';
            tbody.appendChild(tr);
        }
    }

    function gdInit() {
        document.getElementById('gdAlphaOut').textContent = parseFloat(document.getElementById('gdAlpha').value).toFixed(3).replace('0.', '0,');
        document.getElementById('gdAlpha').addEventListener('input', function () {
            document.getElementById('gdAlphaOut').textContent = parseFloat(this.value).toFixed(3).replace('0.', '0,');
        });
        const f = getGDForm();
        const res = gdTrajectory(f.x0, f.y0, f.alpha, [40, 60], 200, GD_K);
        plotGDSurface(res.traj.slice(0, 12), null);
        drawGdConvergence(res.traj, [40, 60]);
        populateGDTable(res.traj, 'gd');
    }

    /* ============================= DP ============================= */
    function dpMonthLabel(m) { return 'T' + String(m).padStart(2, '0'); }

    async function playBackward() {
        if (!window.__DP) return;
        dpStop = false;
        const d = window.__DP;
        const buttons = document.querySelectorAll('#dpTimeline button');
        const tbody = document.querySelector('#dpTable tbody');
        const readout = document.getElementById('dpReadout');
        tbody.innerHTML = '';

        // Điều kiện biên: tháng 12 (F_12)
        await SLEEP(300);
        // Tiến ngược 12 → 1
        for (let m = 11; m >= 0; m--) {
            if (dpStop) break;
            buttons.forEach(b => b.classList.remove('active'));
            buttons[m].classList.add('active');

            const row = d.sample[m];
            const Fsv = d.F[m][Math.min(Math.round(row.storage), d.states.length - 1)];
            const Ropt = d.policy[m][Math.min(Math.round(row.storage), d.states.length - 1)];

            readout.innerHTML =
                '🔁 <b>Bước truy hồi:</b> Tháng ' + (m + 1) + ' — biết F<sub>' + (m + 2) + '</sub>(S) từ lần lặp trước.<br>' +
                'Với mực nước S = <b>' + fmt(row.storage) + '</b>, dòng vào I = <b>' + fmt(row.inflow) + '</b>, ta chọn xả R* = <b>' + fmt(Ropt) + '</b> ' +
                'để tối đa B(R) + F<sub>' + (m + 2) + '</sub>(S + I − R).<br>' +
                '⇨ <b>F<sub>' + (m + 1) + '</sub>(S) = ' + fmt(Fsv) + '</b>';

            // cập nhật bảng: chèn hàng ngược từ trên → hiện đúng thứ tự tháng
            const tr = document.createElement('tr');
            tr.className = 'current';
            tr.innerHTML =
                '<td>' + (m + 1) + '</td><td>' + fmt(row.inflow) + '</td><td>' + fmt(row.storage) + '</td>' +
                '<td><b>' + fmt(row.release) + '</b></td><td>' + fmt(row.benefit) + '</td><td>' + fmt(Fsv) + '</td>';
            tbody.insertBefore(tr, tbody.firstChild);
            await SLEEP(720);
        }
        if (!dpStop) {
            buttons.forEach(b => b.classList.remove('active'));
            readout.innerHTML += '<br>✅ Xong truy hồi ngược. Tối ưu ban đầu: <b>F₁(S=0) = ' + fmt(d.F[0][0]) + '</b>. Cuộn lên để xem bảng <b>State → Decision → Reward</b>.';
        }
        drawDP();
    }

    function resetDP() {
        dpStop = true;
        document.querySelectorAll('#dpTimeline button').forEach(b => b.classList.remove('active'));
        document.querySelector('#dpTable tbody').innerHTML = '';
        document.getElementById('dpReadout').textContent = 'Sẵn sàng. Bấm ▶ Play Backward.';
        drawDP();
    }

    function drawDP() {
        const d = window.__DP;
        const months = d.months.map(dpMonthLabel);
        Plotly.newPlot('dpPlot', [
            {
                x: months, y: d.sample.map(r => r.release), type: 'bar',
                marker: { color: '#0a9396' }, name: 'Xả R (tỷ m³)', yaxis: 'y1'
            },
            {
                x: months, y: d.sample.map(r => r.inflow), type: 'scatter', mode: 'lines+markers',
                line: { color: '#e9c46a', width: 3 }, name: 'Dòng vào I', yaxis: 'y2'
            },
            {
                x: months, y: d.sample.map(r => r.storage), type: 'scatter', mode: 'lines+markers',
                line: { color: '#005f73', width: 3, dash: 'dash' }, name: 'Mực nước S', yaxis: 'y2'
            },
            {
                x: months, y: d.sample.map(r => r.benefit), type: 'scatter', mode: 'markers',
                marker: { size: 11, color: '#e76f51' }, name: 'Lợi ích B(R)', yaxis: 'y2'
            }
        ], {
            margin: { t: 12, b: 50, l: 55, r: 55 },
            xaxis: { title: 'Tháng' },
            yaxis: { title: 'Xả (tỷ m³)', gridcolor: 'rgba(0,0,0,0.06)' },
            yaxis2: { title: 'I / S / B', overlaying: 'y', side: 'right' },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: 'h', y: 1.15 }
        }, CNF);
    }

    function dpInit() {
        const d = window.__DP;
        const tl = document.getElementById('dpTimeline');
        d.months.forEach(function (m) {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = dpMonthLabel(m);
            b.dataset.month = m;
            b.addEventListener('click', function () { dpStop = true; resetDP(); });
            tl.appendChild(b);
        });
        drawDP();
        document.getElementById('dpReadout').textContent =
            '📋 Hồ chứa K = ' + d.K + ' tỷ m³, 12 tháng, giá trị nước cuối kỳ w = ' + d.w + ' tỷ đ/tỷ m³. Điều kiện biên F₁₂(S) = w·S.';
    }

    /* ============================= BOOT ============================= */
    document.addEventListener('DOMContentLoaded', function () {
        if (document.getElementById('lpPlot')) {
            window.__lpCur = window.__LP;
            plotLP(window.__LP, 0.6);
            document.getElementById('lpRun').addEventListener('click', lpSolveClick);
            document.getElementById('lpSimplex').addEventListener('click', lpSimplexClick);
            document.getElementById('lpInterior').addEventListener('click', lpInteriorClick);
        }
        if (document.getElementById('gdPlot')) {
            document.getElementById('gdRun').addEventListener('click', gdRun);
            document.getElementById('gdNewton').addEventListener('click', gdNewton);
            gdInit();
        }
        if (document.getElementById('dpPlot')) {
            document.getElementById('dpPlay').addEventListener('click', playBackward);
            document.getElementById('dpReset').addEventListener('click', resetDP);
            dpInit();
        }
    });
})();