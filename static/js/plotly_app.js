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
    function fmtSimplex(v) {
        return Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 4 });
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
                    line: { color: '#b85c38', width: 1.5, dash: 'dot' }, hoverinfo: 'skip', showlegend: false });
            } else if (Math.abs(r.a1) > 1e-9) {
                const xv = r.b / r.a1;
                traces.push({ x: [xv, xv], y: [0, ymax] , type: 'scatter', mode: 'lines',
                    line: { color: '#b85c38', width: 1.5, dash: 'dot' }, hoverinfo: 'skip', showlegend: false });
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

    function revealLPModel() {
        const model = document.getElementById('lpModel');
        if (!model || !model.classList.contains('hidden')) return;
        model.classList.remove('hidden');
        model.setAttribute('aria-hidden', 'false');
        model.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function lpSolveClick() {
        revealLPModel();
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

    function drawSimplexSlackChart(data) {
        const traces = buildLPTraces(data, 0.5);
        const iters = (data.simplex && data.simplex.iterations) || [];
        const rows = (data.rows || []).filter(function (r) { return r.b > 0; });
        const annotations = [];
        const xs = [], ys = [], labels = [];
        iters.forEach(function (it, i) {
            xs.push(it.point[0]); ys.push(it.point[1]); labels.push('#' + (i + 1));
        });
        traces.push({
            x: xs, y: ys, type: 'scatter', mode: 'lines+markers+text',
            line: { color: '#005f73', width: 3.5 },
            marker: { size: 11, color: '#0a9396', symbol: 'circle', line: { color: '#005f73', width: 1.5 } },
            text: labels, textposition: 'top right',
            name: 'Đường đi Simplex', hovertemplate: 'x₁=%{x}<br>x₂=%{y}<extra></extra>'
        });

        rows.forEach(function (r, j) {
            const na = r.a1 * r.a1 + r.a2 * r.a2;
            if (na < 1e-12) return;
            iters.forEach(function (it) {
                const p = it.point;
                const slack = r.b - (r.a1 * p[0] + r.a2 * p[1]);
                if (Math.abs(slack) < 1e-6) return;
                const foot = [p[0] + (slack / na) * r.a1, p[1] + (slack / na) * r.a2];
                traces.push({
                    x: [p[0], foot[0]], y: [p[1], foot[1]], type: 'scatter', mode: 'lines',
                    line: { color: '#8a7a48', width: 2, dash: 'dot' },
                    showlegend: false, hoverinfo: 'skip'
                });
                annotations.push({
                    x: (p[0] + foot[0]) / 2, y: (p[1] + foot[1]) / 2,
                    text: 's' + (j + 1) + '=' + fmt(slack),
                    xref: 'x', yref: 'y', showarrow: false,
                    font: { size: 10, color: '#8a7a48' },
                    bgcolor: 'rgba(255,255,255,0.75)', bordercolor: '#8a7a48', borderwidth: 0.5
                });
            });
            const X = Math.max(data.xmax, data.ymax);
            let lx, ly;
            if (Math.abs(r.a2) > 1e-9) {
                const xx = [0, X];
                const yy = xx.map(function (x) { return (r.b - r.a1 * x) / r.a2; });
                lx = xx[1]; ly = yy[1];
            } else {
                lx = r.b / r.a1; ly = X * 0.02;
            }
            annotations.push({
                x: lx, y: ly, text: 's' + (j + 1) + ' = 0 (biên)',
                xref: 'x', yref: 'y', showarrow: false,
                font: { size: 10, color: '#b85c38' },
                bgcolor: 'rgba(255,255,255,0.75)', bordercolor: '#b85c38', borderwidth: 0.5
            });
        });

        const Xmax = Math.max(data.xmax, data.ymax);
        Plotly.newPlot('lpSimplexChart', traces, {
            margin: { t: 12, b: 50, l: 60, r: 20 },
            xaxis: { title: 'x₁ (ha)', range: [0, Xmax * 1.08], zeroline: false },
            yaxis: { title: 'x₂ (ha)', range: [0, Xmax * 1.08], zeroline: false },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            annotations: annotations,
            showlegend: false
        }, CNF);
    }

    async function lpSimplexClick() {
        revealLPModel();
        try {
            const solved = await solveCurrentLP();
            if (!solved.solution.feasible) throw new Error(solved.solution.note || 'Miền khả thi rỗng.');
            document.getElementById('lpSimplexContent').classList.remove('hidden');
            drawSimplexSlackChart(solved.solution);
            populateSimplexTable(solved.solution.simplex);
            await animateLP(solved.solution.path || [], 'Simplex', '#005f73');
        } catch (error) {
            const status = document.getElementById('lpStatus');
            status.textContent = '⚠️ ' + error.message;
            status.classList.remove('hidden');
        }
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
            const title = 'Lặp ' + it.it + ' · đỉnh (x₁, x₂) = (' + fmt(it.point[0]) + '; ' + fmt(it.point[1]) + ')' +
                ' · Z = <b>' + fmt(it.z) + '</b>' + (it.optimal ? '  ✅ TỐI ƯU' : '');
            tbody.insertAdjacentHTML('beforeend',
                '<tr class="itr-hdr"><td colspan="' + cols + '">' + title + '</td></tr>');

            const enterIdx = it.entering ? names.indexOf(it.entering) : -1;
            const leaveRow = it.leaving ? it.basis.indexOf(it.leaving) : -1;
            const rows = it.tableau;
            const nrow = rows.length - 1;
            const zrow = rows[nrow];
            const currentBasis = '<span class="simplex-basis-chips">' + it.basis.map(function (nm) {
                return '<span class="simplex-basis-chip">' + nm + '</span>';
            }).join('') + '</span>';
            let nextBasis = it.basis.slice();
            if (leaveRow >= 0 && enterIdx >= 0) nextBasis[leaveRow] = it.entering;
            const nextBasisHtml = '<span class="simplex-basis-chips">' + nextBasis.map(function (nm) {
                return '<span class="simplex-basis-chip">' + nm + '</span>';
            }).join('') + '</span>';

            const ratioLines = [];
            if (enterIdx >= 0) {
                for (let i = 0; i < nrow; i++) {
                    const coefficient = rows[i][enterIdx];
                    if (coefficient > 1e-9 && it.ratios[i] != null) {
                        ratioLines.push(it.basis[i] + ': ' + fmtSimplex(rows[i][names.length]) + ' ÷ ' +
                            fmtSimplex(coefficient) + ' = ' + fmtSimplex(it.ratios[i]) + (i === leaveRow ? ' ✓' : ''));
                    }
                }
            }
            let decision = '<div class="simplex-decision-card">' +
                '<div class="simplex-decision-line"><b>📍 Đang ở:</b> (' + fmt(it.point[0]) + ', ' + fmt(it.point[1]) + '), Z = ' + fmt(it.z) + '</div>' +
                '<div class="simplex-decision-line"><b>🔵 Cơ sở hiện tại:</b> ' + currentBasis + '</div>';
            if (it.entering) {
                decision += '<div class="simplex-decision-line"><b>🟢 Biến vào:</b> ' + it.entering +
                    ' — hệ số hàng Z ' + fmtSimplex(zrow[enterIdx]) + ' âm nhất, chọn hướng cải thiện.</div>' +
                    '<div class="simplex-decision-line"><b>🟡 Tỷ số:</b> ' + (ratioLines.length ? ratioLines.join(' · ') : 'không có hàng có hệ số biến vào dương') + '</div>';
                if (it.leaving) {
                    decision += '<div class="simplex-decision-line"><b>🟠 Biến ra:</b> ' + it.leaving +
                        ' — tỷ số nhỏ nhất trong các hàng đủ điều kiện. <b>🟣 Pivot:</b> ' + fmtSimplex(it.pivot) +
                        ' — giao giữa hàng ' + it.leaving + ' và cột ' + it.entering + '.</div>' +
                        '<div class="simplex-decision-line"><b>➡️ Cơ sở mới:</b> ' + nextBasisHtml + '</div>';
                } else {
                    decision += '<div class="simplex-decision-line"><b>⚠️ Biến ra:</b> không có tỷ số dương; bài toán có thể không bị chặn.</div>';
                }
            } else {
                decision += '<div class="simplex-decision-line simplex-optimal-line"><b>✅ TỐI ƯU:</b> hàng Z không còn hệ số âm; không chọn biến vào. Cơ sở tối ưu: ' + currentBasis + '</div>';
            }
            decision += '</div>';
            tbody.insertAdjacentHTML('beforeend',
                '<tr class="itr-decision-row"><td colspan="' + cols + '">' + decision + '</td></tr>');

            let hdr = '<tr class="itr-colhdr"><th class="basis-head" title="Các biến cơ sở được xác định từ hệ phương trình và mô tả nghiệm hiện tại.">🔵 Cơ sở</th>';
            names.forEach(function (nm, j) {
                const isEntering = j === enterIdx;
                hdr += isEntering
                    ? '<th class="enter-col" title="Biến vào: được chọn để tăng Z theo tiêu chuẩn hàng Z.">🟢 ' + nm + ' → VÀO</th>'
                    : '<th>' + nm + '</th>';
            });
            hdr += '<th class="rhs-head" title="RHS – Right Hand Side: giá trị hiện tại của biến cơ sở khi các biến không cơ sở bằng 0.">🔷 Vế phải<small>Giá trị biến cơ sở</small></th>' +
                '<th class="ratio-head" title="Chỉ tính khi hệ số ở cột biến vào dương; chọn tỷ số nhỏ nhất trong các hàng đủ điều kiện.">🟡 Tỷ số<small>RHS ÷ hệ số cột vào</small></th></tr>';
            tbody.insertAdjacentHTML('beforeend', hdr);

            rows.forEach(function (row, i) {
                const isZ = (i === nrow);
                const isLeave = (i === leaveRow);
                const basisLabel = isZ
                    ? '<span title="Với bài Max theo quy ước tableau này, hệ số âm còn lại cho biết có thể cải thiện Z.">🟪 Z · KIỂM TRA TỐI ƯU</span>'
                    : (isLeave ? '<span class="leaving-label">🟠 ' + it.leaving + ' ← RA</span>' : '<span class="basis-label">🔵 ' + it.basis[i] + '</span>');
                let cells = '<td class="' + (isZ ? 'z-basis' : (isLeave ? 'leaving-basis' : 'basis-label-cell')) + '"><b>' + basisLabel + '</b></td>';
                for (let j = 0; j < names.length; j++) {
                    const isPivot = !isZ && isLeave && j === enterIdx;
                    const isSelectedEntering = isZ && j === enterIdx;
                    let cls = j === enterIdx ? 'enter-col' : '';
                    if (isPivot) cls = 'pivot-cell';
                    if (isSelectedEntering) cls = 'enter-selected';
                    const v = fmtSimplex(row[j]);
                    const content = isPivot
                        ? '<b>🟣 ' + v + ' PIVOT</b>'
                        : (isSelectedEntering ? '<b>→ ' + v + ' ✓</b><small>âm nhất · vào</small>' : v);
                    const pivotTitle = isPivot
                        ? 'Phần tử pivot: giao giữa hàng biến ra ' + it.leaving + ' và cột biến vào ' + it.entering + '.'
                        : '';
                    cells += '<td' + (cls ? ' class="' + cls + '"' : '') + (pivotTitle ? ' title="' + pivotTitle + '"' : '') + '>' + content + '</td>';
                }
                const rhs = row[names.length];
                cells += '<td class="rhs-cell" title="RHS là vế phải, tức giá trị hiện tại của biến cơ sở khi biến không cơ sở bằng 0.">' + fmtSimplex(rhs) + '</td>';
                if (isZ) {
                    cells += '<td class="ratio-na">—</td>';
                } else {
                    const coefficient = enterIdx >= 0 ? row[enterIdx] : 0;
                    if (coefficient > 1e-9 && it.ratios[i] != null) {
                        const selected = i === leaveRow;
                        const formula = fmtSimplex(rhs) + ' ÷ ' + fmtSimplex(coefficient) + ' = ' + fmtSimplex(it.ratios[i]);
                        cells += '<td class="ratio-cell' + (selected ? ' ratio-selected' : '') + '" title="Tỷ số = RHS ÷ hệ số ở cột biến vào; chỉ tính khi hệ số dương.">' +
                            '<b>' + fmtSimplex(it.ratios[i]) + (selected ? ' ✓' : '') + '</b><small>' + formula + '</small></td>';
                    } else {
                        cells += '<td class="ratio-na" title="Hệ số cột biến vào không dương nên không tính tỷ số.">—</td>';
                    }
                }
                const rowClass = [isZ ? 'itr-zrow' : '', isLeave ? 'itr-leave-row' : ''].filter(Boolean).join(' ');
                tbody.insertAdjacentHTML('beforeend',
                    '<tr' + (rowClass ? ' class="' + rowClass + '"' : '') + '>' + cells + '</tr>');
            });

            const solParts = [];
            for (let v = 0; v < names.length; v++) {
                const bi = it.basis.indexOf(names[v]);
                solParts.push(names[v] + ' = ' + fmtSimplex(bi >= 0 ? rows[bi][rows[bi].length - 1] : 0));
            }
            const optTag = it.optimal ? '  ★ Nghiệm tối ưu' : '';
            tbody.insertAdjacentHTML('beforeend',
                '<tr class="itr-sum"><td colspan="' + cols + '">Nghiệm hiện tại: ' +
                solParts.join('; ') + '  →  Z = <b>' + fmt(it.z) + '</b>' + optTag + '</td></tr>');
        });
    }

    async function lpInteriorClick() {
        revealLPModel();
        const f = readLPForm();
        const fd = new FormData();
        fd.append('c1', f.c1); fd.append('c2', f.c2);
        f.rows.forEach(function (r, i) {
            fd.append('a1_' + (i + 1), r.a1); fd.append('a2_' + (i + 1), r.a2); fd.append('b_' + (i + 1), r.b);
        });
        document.getElementById('ipmContent').classList.remove('hidden');
        document.getElementById('ipmStatus').textContent = 'Đang chạy phương pháp điểm trong...';
        document.getElementById('ipmStatus').classList.remove('hidden');
        try {
            await solveCurrentLP();
            const res = await fetch('/api/optimize/ipm', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.error) { document.getElementById('ipmStatus').textContent = '⚠️ ' + data.error; return; }
            if (!data.optimal) { document.getElementById('ipmStatus').textContent = '⚠️ ' + (data.note || 'Bài toán chưa có nghiệm tối ưu.'); return; }
            const ipm = data.ipm;
            const o = data.optimal;
            const st = document.getElementById('ipmStatus');
            st.textContent = 'Phương pháp điểm trong: x₁ = ' + fmt(o[0]) + ', x₂ = ' + fmt(o[1]) +
                '  ·  Z* = ' + fmt(data.z_star) + '  (sau ' + ipm.iterations + ' bước barrier)';
            populateIpmTable(ipm);
            if (ipm.path && ipm.path.length > 1) {
                await animateLP(ipm.path, 'Điểm trong', '#075e5f');
            }
            drawIpmConvergence(ipm.convergence || []);
        } catch (e) {
            document.getElementById('ipmStatus').textContent = '⚠️ ' + e.message;
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
            'Giai đoạn cuối: μ→0, nghiệm tiến gần nghiệm tối ưu của bài toán chung.'
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
                line: { color: '#075e5f', width: 3 }, marker: { size: 6 },
                name: 'Z(μ)', hovertemplate: 'Bước %{x}<br>Z=%{y}<extra></extra>'
            },
            {
                x: conv.map(function (c) { return c.iter; }),
                y: conv.map(function (c) { return c.z; }).map(function (z, i) {
                    return z + (conv[i].mu > 0.01 ? conv[i].mu * 10 : 0);
                }),
                type: 'scatter', mode: 'markers',
                marker: { size: 4, color: '#b85c38', symbol: 'triangle-up' },
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
            x0: parseFloat(document.getElementById('gd_x0').value),
            y0: parseFloat(document.getElementById('gd_y0').value),
            alpha: parseFloat(document.getElementById('gdAlpha').value) || 0.05
        };
    }

    async function solveCurrentLP() {
        const problem = readLPForm();
        const fd = new FormData();
        fd.append('c1', problem.c1); fd.append('c2', problem.c2);
        problem.rows.forEach(function (r, i) {
            fd.append('a1_' + (i + 1), r.a1); fd.append('a2_' + (i + 1), r.a2); fd.append('b_' + (i + 1), r.b);
        });
        const response = await fetch('/api/optimize/lp', { method: 'POST', body: fd });
        const data = await response.json();
        if (data.error || data.status !== 'optimal') throw new Error(data.error || data.note || 'Bài toán hiện tại chưa có nghiệm tối ưu.');
        window.__lpCur = data;
        plotLP(data, 0.6);
        populateVertexTable(data);
        document.getElementById('lpContent').classList.remove('hidden');
        return { problem: problem, solution: data };
    }

    function barrierEval(x, y, problem, mu) {
        if (!(x > 1e-9 && y > 1e-9)) return null;
        const slacks = [{ value: x, dx: 1, dy: 0 }, { value: y, dx: 0, dy: 1 }];
        problem.rows.forEach(function (r) {
            slacks.push({ value: r.b - r.a1 * x - r.a2 * y, dx: -r.a1, dy: -r.a2 });
        });
        if (slacks.some(s => !(s.value > 1e-9))) return null;

        let value = problem.c1 * x + problem.c2 * y;
        let gx = problem.c1, gy = problem.c2;
        let hxx = 0, hxy = 0, hyy = 0;
        slacks.forEach(function (s) {
            value += mu * Math.log(s.value);
            gx += mu * s.dx / s.value;
            gy += mu * s.dy / s.value;
            const scale = mu / (s.value * s.value);
            hxx -= scale * s.dx * s.dx;
            hxy -= scale * s.dx * s.dy;
            hyy -= scale * s.dy * s.dy;
        });
        return { value: value, z: problem.c1 * x + problem.c2 * y, gx: gx, gy: gy, hxx: hxx, hxy: hxy, hyy: hyy };
    }

    function barrierMus() {
        return [100, 30, 9, 2.7, 0.81, 0.243, 0.0729, 0.02187, 0.006561, 0.0019683, 0.00059049];
    }

    function gdBarrierTrajectory(problem, start, alpha) {
        let x = start[0], y = start[1];
        const first = barrierEval(x, y, problem, barrierMus()[0]);
        const traj = [{ iteration: 0, outer: 1, x: x, y: y, mu: barrierMus()[0], gx: -first.gx, gy: -first.gy, z: first.z, step_length: null, backtracks: null }];
        barrierMus().forEach(function (mu, outerIndex) {
            for (let iter = 0; iter < 500; iter++) {
                const current = barrierEval(x, y, problem, mu);
                if (!current) break;
                const norm2 = current.gx * current.gx + current.gy * current.gy;
                if (norm2 < 1e-10) break;
                let step = alpha;
                let accepted = false;
                let backtracks = 0;
                for (let ls = 0; ls < 40; ls++) {
                    const nx = x + step * current.gx, ny = y + step * current.gy;
                    const next = barrierEval(nx, ny, problem, mu);
                    if (next && next.value >= current.value + 1e-4 * step * norm2) {
                        x = nx; y = ny; accepted = true;
                        backtracks = ls;
                        traj.push({ iteration: traj.length, outer: outerIndex + 1, x: x, y: y, mu: mu,
                            gx: -next.gx, gy: -next.gy, z: next.z, step_length: step, backtracks: backtracks });
                        break;
                    }
                    step *= 0.5;
                }
                if (!accepted) break;
            }
        });
        return { traj: traj, xf: x, yf: y };
    }

    function newtonBarrierTrajectory(problem, start) {
        let x = start[0], y = start[1];
        const first = barrierEval(x, y, problem, barrierMus()[0]);
        const traj = [{ iteration: 0, outer: 1, x: x, y: y, mu: barrierMus()[0], gx: -first.gx, gy: -first.gy, z: first.z, step_length: null, backtracks: null }];
        barrierMus().forEach(function (mu, outerIndex) {
            for (let iter = 0; iter < 80; iter++) {
                const current = barrierEval(x, y, problem, mu);
                if (!current) break;
                if (current.gx * current.gx + current.gy * current.gy < 1e-10) break;
                const det = current.hxx * current.hyy - current.hxy * current.hxy;
                if (!(det > 1e-20)) break;
                const dx = (-current.hyy * current.gx + current.hxy * current.gy) / det;
                const dy = (current.hxy * current.gx - current.hxx * current.gy) / det;
                const ascent = current.gx * dx + current.gy * dy;
                let step = 1, accepted = false;
                let backtracks = 0;
                for (let ls = 0; ls < 40; ls++) {
                    const nx = x + step * dx, ny = y + step * dy;
                    const next = barrierEval(nx, ny, problem, mu);
                    if (next && next.value >= current.value + 1e-4 * step * ascent) {
                        x = nx; y = ny; accepted = true;
                        backtracks = ls;
                        traj.push({ iteration: traj.length, outer: outerIndex + 1, x: x, y: y, mu: mu,
                            gx: -next.gx, gy: -next.gy, z: next.z, step_length: step, backtracks: backtracks });
                        break;
                    }
                    step *= 0.5;
                }
                if (!accepted) break;
            }
        });
        return { traj: traj, xf: x, yf: y };
    }

    function interiorStart(form, problem) {
        const isInside = function (x, y) {
            return Boolean(barrierEval(x, y, problem, 1));
        };
        if (isInside(form.x0, form.y0)) return [form.x0, form.y0];
        const vertices = window.__lpCur.vertices || [];
        if (vertices.length) {
            const center = vertices.reduce((sum, p) => [sum[0] + p[0] / vertices.length, sum[1] + p[1] / vertices.length], [0, 0]);
            if (isInside(center[0], center[1])) return center;
        }
        throw new Error('Không tìm thấy điểm khởi tạo nằm nghiêm ngặt trong miền khả thi. Hãy dùng một miền có diện tích và kiểm tra lại các ràng buộc.');
    }

    function plotGDSurface(traj, nwp, lp) {
        const xmax = Math.max(lp.xmax || 100, 1), ymax = Math.max(lp.ymax || 100, 1);
        const n = 30;
        const xs = Array.from({ length: n }, (_, i) => xmax * 1.05 * i / (n - 1));
        const ys = Array.from({ length: n }, (_, i) => ymax * 1.05 * i / (n - 1));
        const z = ys.map(y => xs.map(x => lp.obj[0] * x + lp.obj[1] * y));
        const traces = [{
            type: 'surface', x: xs, y: ys, z: z, colorscale: 'Viridis', opacity: 0.72,
            showscale: false, contours: { z: { show: true, usecolormap: true, project: { z: true } } },
            hoverinfo: 'skip', name: 'Mặt phẳng lợi nhuận Z'
        }];
        if (lp.vertices && lp.vertices.length) {
            const boundary = lp.vertices.concat([lp.vertices[0]]);
            traces.push({
                type: 'scatter3d', mode: 'lines', x: boundary.map(p => p[0]), y: boundary.map(p => p[1]),
                z: boundary.map(p => lp.obj[0] * p[0] + lp.obj[1] * p[1]),
                line: { color: '#005f73', width: 4 }, name: 'Biên miền khả thi'
            });
        }
        if (traj && traj.length) {
            traces.push({
                type: 'scatter3d', mode: 'lines+markers', x: traj.map(p => p.x), y: traj.map(p => p.y), z: traj.map(p => p.z),
                line: { color: nwp ? '#8a7a48' : '#b85c38', width: 6 }, marker: { size: 2 },
                name: nwp ? 'Newton' : 'Hạ dốc'
            });
        }
        Plotly.newPlot('gdPlot', traces, {
            margin: { t: 10, b: 10, l: 10, r: 10 },
            scene: {
                xaxis: { title: 'x₁ (ha)', range: [0, xmax * 1.05] },
                yaxis: { title: 'x₂ (ha)', range: [0, ymax * 1.05] },
                zaxis: { title: 'Z (triệu đồng)' }, camera: { eye: { x: 1.6, y: -1.6, z: 0.7 } }
            }, paper_bgcolor: 'rgba(0,0,0,0)'
        }, CNF);
    }

    function drawGdConvergence(traj, lp) {
        const traces = [{
            x: traj.map(p => p.iteration), y: traj.map(p => p.z), type: 'scatter', mode: 'lines',
            line: { color: '#0a9396', width: 3 }, name: 'Z tại điểm lặp'
        }, {
            x: [0, Math.max(1, traj[traj.length - 1].iteration)], y: [lp.z_star, lp.z_star], type: 'scatter', mode: 'lines',
            line: { color: '#b85c38', dash: 'dash' }, name: 'Z* (Simplex/đồ thị)'
        }];
        Plotly.newPlot('gdConvChart', traces, {
            margin: { t: 12, b: 40, l: 55, r: 15 }, xaxis: { title: 'Bước nhận' },
            yaxis: { title: 'Lợi nhuận Z' }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            legend: { orientation: 'h', y: 1.12 }, showlegend: true
        }, CNF);
    }

    function populateGDTable(traj, problem, method) {
        const table = document.getElementById('gdTable');
        const tbody = document.querySelector('#gdTable tbody');
        const head = table.querySelector('thead');
        const rows = problem.rows || [];
        const stepName = method === 'gd' ? 'α đã nhận' : 'λ đã nhận';
        head.innerHTML = '<tr><th>k · Bước</th><th>Giai đoạn μ</th><th>x₁</th><th>x₂</th>' +
            rows.map(function (_, i) { return '<th title="Độ dư của ràng buộc ' + (i + 1) + '">s' + (i + 1) + ' · dư #' + (i + 1) + '</th>'; }).join('') +
            '<th title="Tham số rào cản đang cố định trong giai đoạn nội bộ này.">μ</th>' +
            '<th title="Gradient của fμ = −φμ tại điểm hiện tại.">∂fμ/∂x₁</th><th title="Gradient của fμ = −φμ tại điểm hiện tại.">∂fμ/∂x₂</th>' +
            '<th title="Độ dài bước thực tế dùng để tới điểm ở hàng này; α cho hạ dốc, λ cho Newton.">' + stepName + '</th>' +
            '<th title="Số lần line search chia đôi bước trước khi chấp nhận.">Giảm bước</th><th title="Giá trị hàm mục tiêu gốc, không bao gồm số hạng rào cản.">Z gốc</th></tr>';
        tbody.innerHTML = traj.map(function (p, i) {
            const slacks = rows.map(function (r) { return r.b - r.a1 * p.x - r.a2 * p.y; });
            const slackCells = slacks.map(function (s) { return '<td>' + fmtSimplex(s) + '</td>'; }).join('');
            return '<tr' + (i === traj.length - 1 ? ' class="active-row"' : '') + '><td>' + p.iteration + '</td>' +
                '<td>' + p.outer + '</td><td>' + fmtSimplex(p.x) + '</td><td>' + fmtSimplex(p.y) + '</td>' + slackCells +
                '<td>' + fmtSimplex(p.mu) + '</td><td>' + fmtSimplex(p.gx) + '</td><td>' + fmtSimplex(p.gy) + '</td>' +
                '<td>' + (p.step_length == null ? '—' : fmtSimplex(p.step_length)) + '</td>' +
                '<td>' + (p.backtracks == null ? '—' : p.backtracks) + '</td><td><b>' + fmtSimplex(p.z) + '</b></td></tr>';
        }).join('');
    }

    async function runBarrierMethod(method) {
        revealLPModel();
        const form = getGDForm();
        const st = document.getElementById('gdStatus');
        st.classList.remove('hidden');
        st.textContent = 'Đang giải bài toán chung bằng ' + (method === 'gd' ? 'hạ dốc' : 'Newton') + '...';
        try {
            const solved = await solveCurrentLP();
            const start = interiorStart(form, solved.problem);
            const res = method === 'gd'
                ? gdBarrierTrajectory(solved.problem, start, form.alpha)
                : newtonBarrierTrajectory(solved.problem, start);
            if (!res.traj.length) throw new Error('Phương pháp không tìm được bước đi khả thi.');
            const stride = Math.max(1, Math.ceil(res.traj.length / 250));
            const shown = res.traj.filter((_, i) => i % stride === 0);
            if (shown[shown.length - 1] !== res.traj[res.traj.length - 1]) shown.push(res.traj[res.traj.length - 1]);
            document.getElementById('gdWarn').classList.add('hidden');
            document.getElementById('gdContent').classList.remove('hidden');
            document.querySelectorAll('.gd-result').forEach(el => el.classList.remove('hidden'));
            document.getElementById('gdTableTitle').textContent = method === 'gd'
                ? 'Quá trình hội tụ — Hạ dốc'
                : 'Quá trình hội tụ — Newton';
            plotGDSurface(shown, method === 'newton' ? true : null, solved.solution);
            drawGdConvergence(shown, solved.solution);
            populateGDTable(res.traj, solved.problem, method);
            const label = method === 'gd' ? 'Hạ dốc' : 'Newton';
            st.innerHTML = '✅ ' + label + ' trên hàm rào cản tiến tới (' + fmt(res.xf) + ', ' + fmt(res.yf) + '), Z = ' +
                fmt(solved.problem.c1 * res.xf + solved.problem.c2 * res.yf) + '. Nghiệm Simplex/đồ thị: (' +
                fmt(solved.solution.optimal[0]) + ', ' + fmt(solved.solution.optimal[1]) + '), Z* = ' + fmt(solved.solution.z_star) + '.';
        } catch (error) {
            st.textContent = '⚠️ ' + error.message;
        }
    }

    function gdRun() { gdStop = false; return runBarrierMethod('gd'); }
    function gdNewton() { gdStop = false; return runBarrierMethod('newton'); }

    function gdInit() {
        document.getElementById('gdAlphaOut').textContent = parseFloat(document.getElementById('gdAlpha').value).toFixed(3).replace('0.', '0,');
        document.getElementById('gdAlpha').addEventListener('input', function () {
            document.getElementById('gdAlphaOut').textContent = parseFloat(this.value).toFixed(3).replace('0.', '0,');
        });
        plotGDSurface([], null, window.__LP);
    }

    /* ============================= DP ============================= */
    function dpMonthLabel(m) { return 'T' + String(m).padStart(2, '0'); }

    function dpTableInit() {
        const d = window.__DP;
        const tbody = document.querySelector('#dpTable tbody');
        tbody.innerHTML = d.sample.map(function (row, m) {
            const step = d.sample_steps[m];
            return '<tr data-month="' + (m + 1) + '">' +
                '<td>' + (m + 1) + '</td><td>' + fmt(row.storage) + '</td><td>' + fmt(row.inflow) + '</td>' +
                '<td>' + fmt(row.hydro) + '</td><td>' + fmt(row.irrigation) + '</td>' +
                '<td>' + fmt(row.domestic) + '</td><td>' + fmt(row.s_next) + '</td>' +
                '<td>' + fmt(row.benefit) + '</td>' +
                '<td>' + fmt(step.value) + '</td></tr>';
        }).join('');
    }

    function showDPMonth(month) {
        const d = window.__DP;
        const step = d.sample_steps[month - 1];
        if (!step) return;

        document.querySelectorAll('#dpTimeline button').forEach(function (button) {
            button.classList.toggle('active', Number(button.dataset.month) === month);
        });
        document.querySelectorAll('#dpTable tbody tr').forEach(function (tr) {
            tr.classList.toggle('current', Number(tr.dataset.month) === month);
        });

        const nextMonth = step.next_month;
        const equation = 'F<sub>' + month + '</sub>(' + fmt(step.state) + ') = max<sub>Hₜ,Aₜ,Dₜ khả thi</sub> ' +
            '[B<sub>H</sub>(Hₜ) + B<sub>A</sub>(Aₜ) + B<sub>D</sub>(Dₜ) + F<sub>' + nextMonth + '</sub>(S<sub>' + nextMonth + '</sub>)]';
        const options = step.options.map(function (option) {
            return '<tr class="' + (option.optimal ? 'dp-best-option' : '') + '">' +
                '<td>' + fmt(option.hydro) + (option.optimal ? ' ★' : '') + '</td>' +
                '<td>' + fmt(option.irrigation) + '</td><td>' + fmt(option.domestic) + '</td>' +
                '<td>' + fmt(option.s_next) + '</td>' +
                '<td>' + fmt(option.benefit_hydro) + '</td><td>' + fmt(option.benefit_irrigation) + '</td>' +
                '<td>' + fmt(option.benefit_domestic) + '</td><td>' + fmt(option.benefit) + '</td>' +
                '<td>' + fmt(option.future_value) + '</td><td><b>' + fmt(option.total) + '</b></td></tr>';
        }).join('');
        const benefitCoefficients = d.benefit_coefficients;
        function sectorBenefit(name, quantity) {
            const coeff = benefitCoefficients[name];
            return coeff[0] * quantity - coeff[1] * quantity * quantity;
        }
        const policyRows = d.states.map(function (state, stateIndex) {
            const action = d.sector_policy[month - 1][stateIndex];
            const hydro = action.hydro;
            const irrigation = action.irrigation;
            const domestic = action.domestic;
            const release = hydro + irrigation + domestic;
            const nextIndex = stateIndex + Math.round(step.inflow * 10) - Math.round(release * 10);
            if (nextIndex < 0 || nextIndex >= d.states.length) return '';
            const nextState = d.states[nextIndex];
            const benefitHydro = sectorBenefit('hydro', hydro);
            const benefitIrrigation = sectorBenefit('irrigation', irrigation);
            const benefitDomestic = sectorBenefit('domestic', domestic);
            const currentBenefit = benefitHydro + benefitIrrigation + benefitDomestic;
            const futureValue = month === 12 ? d.F_last[nextIndex] : d.F[month][nextIndex];
            const totalValue = currentBenefit + futureValue;
            const value = d.F[month - 1][stateIndex];
            return '<tr class="' + (Math.abs(state - step.state) < 1e-9 ? 'dp-current-state' : '') + '">' +
                '<td>' + fmt(state) + '</td><td>' + fmt(hydro) + '</td><td>' + fmt(irrigation) + '</td>' +
                '<td>' + fmt(domestic) + '</td><td>' + fmt(nextState) + '</td>' +
                '<td>' + fmt(benefitHydro) + '</td><td>' + fmt(benefitIrrigation) + '</td>' +
                '<td>' + fmt(benefitDomestic) + '</td><td>' + fmt(currentBenefit) + '</td>' +
                '<td>' + fmt(futureValue) + '</td><td><b>' + fmt(totalValue) + '</b></td>' +
                '<td><b>' + fmt(value) + '</b></td></tr>';
        }).join('');
        const futureRule = month === 12
            ? 'Tháng 12 dùng điều kiện cuối kỳ: F<sub>13</sub>(S<sub>13</sub>) = ' + fmt(d.w) + ' × S<sub>13</sub>.'
            : 'F<sub>' + nextMonth + '</sub> là giá trị tối ưu đã tính ở bước trước khi truy hồi ngược.';
        const detail = document.getElementById('dpMonthSolution');
        detail.innerHTML = '<h3>Lời giải tháng ' + month + '</h3>' +
            '<p>Trạng thái hồ trên lưới 0,1 tỷ m³ là <b>S<sub>' + month + '</sub> = ' + fmt(step.state) +
            '</b>. Dòng vào I<sub>' + month + '</sub> = <b>' + fmt(step.inflow) + '</b>; trạng thái kế tiếp được tính chính xác trên cùng lưới.</p>' +
            '<p class="dp-equation">' + equation + '</p>' +
            '<p>Thay B<sub>H</sub> = 6H − 1,5H²; B<sub>A</sub> = 8A − 2,5A²; B<sub>D</sub> = 12D − 10D²; ' +
            'S<sub>' + nextMonth + '</sub> = S<sub>' + month + '</sub> + I<sub>' + month + '</sub> − H<sub>' + month + '</sub> − A<sub>' + month + '</sub> − D<sub>' + month + '</sub>. ' + futureRule + '</p>' +
            '<h4>So sánh quyết định tại trạng thái đang xét S<sub>' + month + '</sub> = ' + fmt(step.state) + '</h4>' +
            '<div class="table-responsive"><table class="dp-table dp-options-table"><thead>' +
            '<tr class="dp-column-groups"><th colspan="3">Quyết định phân bổ</th><th>Trạng thái mới</th>' +
            '<th colspan="4">Lợi ích hiện tại B<sub>' + month + '</sub></th>' +
            '<th>Giá trị tương lai</th><th>Tổng giá trị</th></tr><tr>' +
            '<th>Nước phát điện H<sub>' + month + '</sub></th><th>Nước tưới A<sub>' + month + '</sub></th>' +
            '<th>Nước sinh hoạt D<sub>' + month + '</sub></th><th>Nước còn lại S<sub>' + nextMonth + '</sub></th>' +
            '<th>Lợi ích phát điện B<sub>H</sub></th><th>Lợi ích tưới B<sub>A</sub></th>' +
            '<th>Lợi ích sinh hoạt B<sub>D</sub></th><th>Lợi ích tháng B<sub>' + month + '</sub></th>' +
            '<th>F<sub>' + nextMonth + '</sub>(S<sub>' + nextMonth + '</sub>)</th><th>Tổng giá trị phương án J<sub>' + month + '</sub></th>' +
            '</tr></thead><tbody>' + options + '</tbody></table></div>' +
            '<h4>Bảng chính sách tối ưu cho mọi trạng thái có thể xảy ra</h4>' +
            '<p>Mỗi dòng ứng với một S<sub>' + month + '</sub> trên lưới 0,1 tỷ m³. Dòng được tô màu là trạng thái trên lịch vận hành từ S₁ = 0.</p>' +
            '<div class="table-responsive"><table class="dp-table dp-options-table dp-policy-table"><thead>' +
            '<tr class="dp-column-groups"><th>Trạng thái</th><th colspan="3">Quyết định tối ưu</th><th>Trạng thái mới</th>' +
            '<th colspan="4">Lợi ích hiện tại B<sub>' + month + '</sub></th><th>Giá trị tương lai</th>' +
            '<th>Tổng phương án</th><th>Giá trị tối ưu</th></tr><tr>' +
            '<th>S<sub>' + month + '</sub></th><th>Nước phát điện H<sub>' + month + '</sub></th>' +
            '<th>Nước tưới A<sub>' + month + '</sub></th><th>Nước sinh hoạt D<sub>' + month + '</sub></th>' +
            '<th>Nước còn lại S<sub>' + nextMonth + '</sub></th><th>Lợi ích phát điện B<sub>H</sub></th>' +
            '<th>Lợi ích tưới B<sub>A</sub></th><th>Lợi ích sinh hoạt B<sub>D</sub></th>' +
            '<th>Lợi ích tháng B<sub>' + month + '</sub></th><th>F<sub>' + nextMonth + '</sub>(S<sub>' + nextMonth + '</sub>)</th>' +
            '<th>J<sub>' + month + '</sub></th><th>F<sub>' + month + '</sub>(S<sub>' + month + '</sub>)</th>' +
            '</tr></thead><tbody>' + policyRows + '</tbody></table></div>' +
            '<p class="dp-answer">Đáp án tháng ' + month + ': H<sub>' + month + '</sub>* = <b>' + fmt(step.optimal_hydro) + '</b>, ' +
            'A<sub>' + month + '</sub>* = <b>' + fmt(step.optimal_irrigation) + '</b>, D<sub>' + month + '</sub>* = <b>' + fmt(step.optimal_domestic) + '</b> tỷ m³; ' +
            'tổng lợi ích tháng = <b>' + fmt(step.benefit_hydro + step.benefit_irrigation + step.benefit_domestic) + '</b>; ' +
            'F<sub>' + month + '</sub>(' + fmt(step.state) + ') = <b>' + fmt(step.value) + '</b>, bằng giá trị lớn nhất trong cột J<sub>' + month + '</sub>. ' +
            '★ đánh dấu phương án đạt cực đại.</p>';

        document.getElementById('dpReadout').innerHTML =
            '🔁 <b>Truy hồi ngược — tháng ' + month + ':</b> xét trạng thái lưới S<sub>' + month + '</sub> = ' + fmt(step.state) +
            ', I<sub>' + month + '</sub> = ' + fmt(step.inflow) + '. Chọn bộ phân bổ (H*, A*, D*) có tổng lợi ích và giá trị tương lai lớn nhất.';
    }

    async function playBackward() {
        if (!window.__DP) return;
        dpStop = false;
        const d = window.__DP;
        // Hiện từng phép tính theo thứ tự truy hồi: tháng 12 → tháng 1.
        for (let m = 11; m >= 0; m--) {
            if (dpStop) break;
            showDPMonth(m + 1);
            await SLEEP(720);
        }
        if (!dpStop) document.getElementById('dpReadout').innerHTML +=
            '<br>✅ Hoàn tất. Giá trị tối ưu ban đầu: <b>F₁(S₁ = 0) = ' + fmt(d.F[0][0]) + '</b>.';
        drawDP();
    }

    function resetDP() {
        dpStop = true;
        document.querySelectorAll('#dpTimeline button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#dpTable tbody tr').forEach(tr => tr.classList.remove('current'));
        document.getElementById('dpReadout').textContent = 'Sẵn sàng. Bấm “Chạy truy hồi ngược”.';
        document.getElementById('dpMonthSolution').innerHTML =
            '<h3>Lời giải theo tháng</h3><p>Chọn tháng 1–12 ở trên để hiện phép tính chi tiết.</p>';
        drawDP();
    }

    function drawDP() {
        const d = window.__DP;
        const months = d.months.map(dpMonthLabel);
        Plotly.newPlot('dpPlot', [
            {
                x: months, y: d.sample.map(r => r.hydro), type: 'bar',
                marker: { color: '#0a9396' }, name: 'Phát điện H', yaxis: 'y1'
            },
            {
                x: months, y: d.sample.map(r => r.irrigation), type: 'bar',
                marker: { color: '#94b447' }, name: 'Tưới A', yaxis: 'y1'
            },
            {
                x: months, y: d.sample.map(r => r.domestic), type: 'bar',
                marker: { color: '#e9a23b' }, name: 'Sinh hoạt D', yaxis: 'y1'
            },
            {
                x: months, y: d.sample.map(r => r.inflow), type: 'scatter', mode: 'lines+markers',
                line: { color: '#8a7a48', width: 3 }, name: 'Dòng vào I', yaxis: 'y2'
            },
            {
                x: months, y: d.sample.map(r => r.storage), type: 'scatter', mode: 'lines+markers',
                line: { color: '#005f73', width: 3, dash: 'dash' }, name: 'Mực nước S', yaxis: 'y2'
            }
        ], {
            margin: { t: 12, b: 50, l: 55, r: 55 },
            xaxis: { title: 'Tháng' },
            barmode: 'stack',
            yaxis: { title: 'Phân bổ nước (tỷ m³)', gridcolor: 'rgba(0,0,0,0.06)' },
            yaxis2: { title: 'Dòng vào / trữ lượng (tỷ m³)', overlaying: 'y', side: 'right' },
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
            b.addEventListener('click', function () { dpStop = true; showDPMonth(m); });
            tl.appendChild(b);
        });
        dpTableInit();
        drawDP();
        document.getElementById('dpReadout').textContent =
            '📋 Hồ chứa K = ' + d.K + ' tỷ m³, 12 tháng, giá trị nước cuối kỳ w = ' + d.w + ' tỷ đ/tỷ m³. Điều kiện biên F₁₃(S₁₃) = w·S₁₃.';
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
