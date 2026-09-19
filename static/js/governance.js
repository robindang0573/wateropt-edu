(function () {
    'use strict';
    const data = window.WATER_GOVERNANCE;
    if (!data || data.error || !window.Plotly) return;
    const config = data.config;
    const selected = data.selected;
    const candidates = data.candidates || [];
    const states = data.states || [];
    const feasible = data.feasible || [];
    const pareto = data.pareto || [];
    const common = { responsive: true, displaylogo: false, displayModeBar: false };
    const interactiveCommon = Object.assign({}, common, {
        displayModeBar: true,
        scrollZoom: true,
        doubleClick: 'reset',
        modeBarButtonsToRemove: ['select2d', 'lasso2d']
    });
    const transparent = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fbfdfc' };
    const plotMargin = { l: 88, r: 128, t: 90, b: 82 };
    const plotMargin3d = { l: 30, r: 145, t: 90, b: 35 };
    const layoutText = {
        font: { family: 'Segoe UI, Roboto, system-ui, sans-serif', size: 16, color: '#1f2f2f' },
        titlefont: { size: 22, color: '#075e5f' }
    };
    const axisStyle = {
        titlefont: { size: 17, color: '#075e5f' },
        tickfont: { size: 14, color: '#1f2f2f' },
        gridcolor: '#d4dfdc',
        zerolinecolor: '#d4dfdc'
    };
    const horizontalLegend = {
        orientation: 'h',
        x: 0,
        y: 1.12,
        xanchor: 'left',
        yanchor: 'bottom',
        bgcolor: 'rgba(255,255,255,0.92)',
        bordercolor: '#d5dee2',
        borderwidth: 1
    };

    function resizeGovernancePlots() {
        ['governanceStatePlot', 'governanceTimePlot', 'governanceDecisionPlot', 'governanceObjectivePlot',
            'governanceObjective3d', 'governanceParetoPlot', 'governancePreferencePlot']
            .forEach(id => { const node = document.getElementById(id); if (node && window.Plotly) Plotly.Plots.resize(node); });
    }
    window.addEventListener('resize', resizeGovernancePlots);

    Plotly.newPlot('governanceStatePlot', [{
        x: states.map(r => r.V), y: states.map(r => r.Q), type: 'scatter', mode: 'lines+markers',
        marker: { size: 8, color: states.map(r => r.t), colorscale: 'Viridis', showscale: true, colorbar: { title: 't', x: 1.03 } },
        text: states.map(r => `t=${r.t}<br>V=${r.V.toFixed(1)}<br>Q=${r.Q.toFixed(1)}`),
        hovertemplate: '%{text}<extra></extra>', name: 'Quỹ đạo Sₜ'
    }], Object.assign({}, transparent, {
        title: 'Không gian trạng thái Ωˢ: Sₜ → Sₜ₊₁', height: 660, autosize: true, margin: plotMargin, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'V — Trữ lượng hồ (Mm³)' }, axisStyle), yaxis: Object.assign({ title: 'Q — Dòng chảy hạ du (m³/s)' }, axisStyle),
        shapes: [
            { type: 'rect', x0: config.vcrit, x1: selected.K, y0: config.qeco,
              y1: Math.max(...states.map(r => r.Q)) * 1.15, fillcolor: 'rgba(42,157,143,0.12)', line: { width: 0 }, layer: 'below' },
            { type: 'line', x0: config.vcrit, x1: config.vcrit, y0: 0, y1: 1, yref: 'paper', line: { dash: 'dash', color: '#b85c38' } },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.qeco, y1: config.qeco, line: { dash: 'dash', color: '#b85c38' } }
        ]
    }), common);

    Plotly.newPlot('governanceTimePlot', [
        { x: states.map(r => r.t), y: states.map(r => r.V), type: 'scatter', mode: 'lines+markers', name: 'V(t)', line: { color: '#075e5f', width: 3 } },
        { x: states.map(r => r.t), y: states.map(r => r.Q), type: 'scatter', mode: 'lines+markers', name: 'Q(t)', yaxis: 'y2', line: { color: '#b85c38', width: 2 } }
    ], Object.assign({}, transparent, {
        title: 'Vận hành: quỹ đạo trạng thái theo thời gian', height: 660, autosize: true, margin: plotMargin, legend: horizontalLegend, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'Thời gian t' }, axisStyle), yaxis: Object.assign({ title: 'V (Mm³)', color: '#075e5f' }, axisStyle),
        yaxis2: Object.assign({ title: 'Q (m³/s)', overlaying: 'y', side: 'right', color: '#b85c38' }, axisStyle),
        shapes: [
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.vcrit, y1: config.vcrit, line: { dash: 'dash', color: '#075e5f' } },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.qeco, y1: config.qeco, yref: 'y2', line: { dash: 'dot', color: '#b85c38' } }
        ]
    }), common);

    Plotly.newPlot('governanceDecisionPlot', [
        { x: candidates.filter(r => !r.feasible).map(r => r.K), y: candidates.filter(r => !r.feasible).map(r => r.release_bias), z: candidates.filter(r => !r.feasible).map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 4, opacity: 0.20, color: '#8b9aa0' }, name: 'Bị quản trị loại', hovertemplate: 'Phương án bị loại<extra></extra>' },
        { x: feasible.map(r => r.K), y: feasible.map(r => r.release_bias), z: feasible.map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 5, opacity: 0.70, color: feasible.map(r => r.storage_reliability), colorscale: 'Viridis', showscale: true, colorbar: { title: 'Độ tin cậy lưu trữ', x: 1.02 } },
          text: feasible.map(r => `ID=${r.id}<br>K=${r.K}<br>release=${r.release_bias}<br>supply=${(r.supply_fraction * 100).toFixed(0)}%`),
          hovertemplate: '%{text}<extra></extra>', name: 'Khả thi' },
        { x: pareto.map(r => r.K), y: pareto.map(r => r.release_bias), z: pareto.map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 8, symbol: 'diamond', color: '#b85c38' }, name: 'Pareto' },
        { x: [selected.K], y: [selected.release_bias], z: [selected.supply_fraction],
          type: 'scatter3d', mode: 'markers', marker: { size: 12, symbol: 'star', color: '#b8860b', line: { color: '#1f2f2f', width: 1 } }, name: 'Quản trị chọn' }
    ], Object.assign({}, transparent, {
        title: 'Không gian phương án Ωᴰ = (X,U)', height: 660, autosize: true, margin: plotMargin3d, font: layoutText.font, titlefont: layoutText.titlefont,
        scene: { domain: { x: [0, 0.90], y: [0, 1] }, xaxis: Object.assign({ title: 'X = K (Mm³) · Quy hoạch' }, axisStyle), yaxis: Object.assign({ title: 'U = release bias · Vận hành' }, axisStyle), zaxis: Object.assign({ title: 'U = supply fraction', tickformat: '.0%' }, axisStyle) },
        legend: horizontalLegend
    }), common);

    Plotly.newPlot('governanceObjectivePlot', [
        { x: feasible.map(r => r.J_economic), y: feasible.map(r => r.J_social), type: 'scatter', mode: 'markers',
          marker: { size: feasible.map(r => 7 + 12 * r.storage_reliability), color: feasible.map(r => r.J_environment), colorscale: 'Viridis', showscale: true, colorbar: { title: 'J môi trường (%)', x: 1.03 } },
          text: feasible.map(r => `ID=${r.id}<br>K=${r.K}<br>J kinh tế=${r.J_economic.toFixed(2)} tỷ VND<br>J xã hội=${r.J_social.toFixed(2)}%<br>J môi trường=${r.J_environment.toFixed(2)}%`), hovertemplate: '%{text}<extra></extra>', name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), type: 'scatter', mode: 'markers', marker: { size: 13, symbol: 'diamond-open', line: { width: 2, color: '#b85c38' } }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#b8860b', line: { color: '#1f2f2f', width: 1 } }, name: 'Quản trị chọn' }
    ], Object.assign({}, transparent, { title: 'Không gian mục tiêu Ωᴶ: chi phí — thiếu nước', height: 660, autosize: true, margin: plotMargin, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế (tỷ VND) · càng nhỏ càng tốt' }, axisStyle), yaxis: Object.assign({ title: 'J xã hội (% thiếu nước) · càng nhỏ càng tốt' }, axisStyle), legend: horizontalLegend }), common);

    Plotly.newPlot('governanceObjective3d', [
        { x: feasible.map(r => r.J_economic), y: feasible.map(r => r.J_social), z: feasible.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 4, opacity: 0.45 }, name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), z: pareto.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 7, color: '#b85c38' }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], z: [selected.J_environment], type: 'scatter3d', mode: 'markers', marker: { size: 10, symbol: 'diamond', color: '#b8860b' }, name: 'Quản trị chọn' }
    ], Object.assign({}, transparent, { title: 'Không gian mục tiêu Ωᴶ: ba chỉ tiêu đánh giá', height: 660, autosize: true, margin: plotMargin3d, font: layoutText.font, titlefont: layoutText.titlefont,
        scene: { domain: { x: [0, 0.94], y: [0, 1] }, xaxis: Object.assign({ title: 'J kinh tế (tỷ VND)' }, axisStyle), yaxis: Object.assign({ title: 'J xã hội (%)' }, axisStyle), zaxis: Object.assign({ title: 'J môi trường (%)' }, axisStyle) },
        legend: horizontalLegend }), common);

    const mins = {}, maxs = {};
    ['J_economic', 'J_social', 'J_environment'].forEach(function (key) {
        const values = feasible.map(r => r[key]);
        mins[key] = Math.min(...values); maxs[key] = Math.max(...values);
    });
    const norm = (key, value) => Math.abs(maxs[key] - mins[key]) < 1e-12 ? 0 : (value - mins[key]) / (maxs[key] - mins[key]);
    const econWeight = data.weights[0];
    const socialWeight = data.weights[1];
    const envPart = data.weights[2] * norm('J_environment', selected.J_environment);
    const selectedE = norm('J_economic', selected.J_economic);
    const selectedS = norm('J_social', selected.J_social);
    const paretoOrdered = pareto.slice().sort((a, b) => a.J_economic - b.J_economic);
    function formatObjectivePoint(row, includeNormalized) {
        const normalized = includeNormalized ? `<br>Chuẩn hóa: (${norm('J_economic', row.J_economic).toFixed(3)}, ${norm('J_social', row.J_social).toFixed(3)}, ${norm('J_environment', row.J_environment).toFixed(3)})` : '';
        return `ID=${row.id}<br>K=${row.K} Mm³ · release=${row.release_bias} · supply=${(row.supply_fraction * 100).toFixed(0)}%<br>J kinh tế=${row.J_economic.toFixed(2)} tỷ VND<br>J xã hội=${row.J_social.toFixed(2)}%<br>J môi trường=${row.J_environment.toFixed(2)}%<br>Vᴳ=${row.GovernanceScore.toFixed(3)}${normalized}`;
    }

    function pointSummary(row, includeScore) {
        const normalizedEconomic = norm('J_economic', row.J_economic);
        const normalizedSocial = norm('J_social', row.J_social);
        const normalizedEnvironment = norm('J_environment', row.J_environment);
        const score = data.weights[0] * normalizedEconomic + data.weights[1] * normalizedSocial + data.weights[2] * normalizedEnvironment;
        const scoreLine = includeScore ? `<div class="selection-value"><b>Vᴳ</b><strong>${score.toFixed(3)}</strong></div>` : '';
        return `<h3>Phương án ID ${row.id}</h3><div class="selection-grid"><div><span>Quy hoạch X</span><strong>K = ${row.K.toFixed(0)} Mm³</strong></div><div><span>Vận hành U</span><strong>${row.release_bias.toFixed(0)} · ${(row.supply_fraction * 100).toFixed(0)}%</strong></div><div><span>J kinh tế</span><strong>${row.J_economic.toFixed(2)} tỷ VND</strong></div><div><span>J xã hội</span><strong>${row.J_social.toFixed(2)}%</strong></div><div><span>J môi trường</span><strong>${row.J_environment.toFixed(2)}%</strong></div><div><span>Chuẩn hóa (eco, soc, env)</span><strong>${normalizedEconomic.toFixed(3)} · ${normalizedSocial.toFixed(3)} · ${normalizedEnvironment.toFixed(3)}</strong></div>${scoreLine}</div>`;
    }

    function bindPointSelection(plotId, rows, detailId, includeScore) {
        const plot = document.getElementById(plotId);
        const detail = document.getElementById(detailId);
        if (!plot || !detail) return;
        plot.on('plotly_click', function (event) {
            const point = event && event.points && event.points[0];
            if (!point || point.curveNumber !== 0 || !rows[point.pointIndex]) return;
            detail.innerHTML = pointSummary(rows[point.pointIndex], includeScore);
        });
    }

    const paretoPlotPromise = Plotly.newPlot('governanceParetoPlot', [
        { x: paretoOrdered.map(r => norm('J_economic', r.J_economic)), y: paretoOrdered.map(r => norm('J_social', r.J_social)),
          type: 'scatter', mode: 'lines+markers', line: { color: '#b85c38', width: 4 }, marker: { size: 11 },
          text: paretoOrdered.map(r => formatObjectivePoint(r, true)), hovertemplate: '%{text}<extra></extra>', name: 'Pareto front' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#b8860b', line: { color: '#1f2f2f', width: 1 } }, name: 'J* được chọn' }
    ], Object.assign({}, transparent, { title: 'Pareto front trong không gian mục tiêu Ωᴶ', height: 660,
        autosize: true, margin: plotMargin, legend: horizontalLegend, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế chuẩn hóa — càng trái càng tốt', range: [0, 1] }, axisStyle),
        yaxis: Object.assign({ title: 'J xã hội chuẩn hóa — càng xuống càng tốt', range: [0, 1] }, axisStyle), dragmode: 'zoom' }), interactiveCommon);
    paretoPlotPromise.then(function () {
        bindPointSelection('governanceParetoPlot', paretoOrdered, 'pareto-point-detail', true);
        const detail = document.getElementById('pareto-point-detail');
        if (detail) detail.innerHTML = pointSummary(selected, true);
    });
    const scoreLine = [];
    if (socialWeight > 1e-12) {
        const selectedLevel = data.weights[0] * selectedE + data.weights[1] * selectedS + envPart;
        for (let x = 0; x <= 1.001; x += 0.02) scoreLine.push({ x: x, y: (selectedLevel - envPart - econWeight * x) / socialWeight });
    }
    const preferencePlotPromise = Plotly.newPlot('governancePreferencePlot', [
        { x: pareto.map(r => norm('J_economic', r.J_economic)), y: pareto.map(r => norm('J_social', r.J_social)), type: 'scatter', mode: 'markers', marker: { size: 9, color: '#b85c38', symbol: 'diamond' }, text: pareto.map(r => formatObjectivePoint(r, true)), hovertemplate: '%{text}<extra></extra>', name: 'Pareto' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 15, color: '#b8860b', symbol: 'star', line: { color: '#1f2f2f', width: 1 } }, name: 'Quản trị chọn' },
        { x: scoreLine.map(p => p.x), y: scoreLine.map(p => p.y), type: 'scatter', mode: 'lines', line: { color: '#075e5f', width: 3, dash: 'dash' }, name: 'Đường giá trị quản trị' }
    ], Object.assign({}, transparent, { title: 'Quản trị chọn hướng trên Pareto bằng Vᴳ', height: 620, autosize: true, margin: plotMargin, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế chuẩn hóa', range: [0, 1] }, axisStyle), yaxis: Object.assign({ title: 'J xã hội chuẩn hóa', range: [0, 1] }, axisStyle), legend: horizontalLegend, dragmode: 'zoom' }), interactiveCommon);
    preferencePlotPromise.then(function () {
        bindPointSelection('governancePreferencePlot', pareto, 'governance-choice-detail', true);
        const detail = document.getElementById('governance-choice-detail');
        if (detail) detail.innerHTML = pointSummary(selected, true);
    });
    setTimeout(resizeGovernancePlots, 150);
}());
