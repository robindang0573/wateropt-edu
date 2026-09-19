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
          marker: { size: feasible.map(r => 7 + 12 * r.storage_reliability), color: feasible.map(r => r.J_environment), colorscale: 'Viridis', showscale: true, colorbar: { title: 'J môi trường', x: 1.03 } },
          text: feasible.map(r => `ID=${r.id}<br>K=${r.K}<br>risk=${r.J_risk.toFixed(3)}`), hovertemplate: '%{text}<extra></extra>', name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), type: 'scatter', mode: 'markers', marker: { size: 13, symbol: 'diamond-open', line: { width: 2, color: '#b85c38' } }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#b8860b', line: { color: '#1f2f2f', width: 1 } }, name: 'Quản trị chọn' }
    ], Object.assign({}, transparent, { title: 'Không gian mục tiêu Ωᴶ: Kinh tế — Xã hội', height: 660, autosize: true, margin: plotMargin, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế · mục tiêu cần giảm' }, axisStyle), yaxis: Object.assign({ title: 'J xã hội · mục tiêu cần giảm' }, axisStyle), legend: horizontalLegend }), common);

    Plotly.newPlot('governanceObjective3d', [
        { x: feasible.map(r => r.J_economic), y: feasible.map(r => r.J_social), z: feasible.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 4, opacity: 0.45 }, name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), z: pareto.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 7, color: '#b85c38' }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], z: [selected.J_environment], type: 'scatter3d', mode: 'markers', marker: { size: 10, symbol: 'diamond', color: '#b8860b' }, name: 'Quản trị chọn' }
    ], Object.assign({}, transparent, { title: 'Không gian mục tiêu Ωᴶ: bốn chiều đánh giá', height: 660, autosize: true, margin: plotMargin3d, font: layoutText.font, titlefont: layoutText.titlefont,
        scene: { domain: { x: [0, 0.94], y: [0, 1] }, xaxis: Object.assign({ title: 'J kinh tế' }, axisStyle), yaxis: Object.assign({ title: 'J xã hội' }, axisStyle), zaxis: Object.assign({ title: 'J môi trường' }, axisStyle) },
        legend: horizontalLegend }), common);

    const mins = {}, maxs = {};
    ['J_economic', 'J_social', 'J_environment', 'J_risk'].forEach(function (key) {
        const values = feasible.map(r => r[key]);
        mins[key] = Math.min(...values); maxs[key] = Math.max(...values);
    });
    const norm = (key, value) => Math.abs(maxs[key] - mins[key]) < 1e-12 ? 0 : (value - mins[key]) / (maxs[key] - mins[key]);
    const econWeight = data.weights[0];
    const socialWeight = data.weights[1];
    const envRiskPart = data.weights[2] * norm('J_environment', selected.J_environment) + data.weights[3] * norm('J_risk', selected.J_risk);
    const selectedE = norm('J_economic', selected.J_economic);
    const selectedS = norm('J_social', selected.J_social);
    const paretoOrdered = pareto.slice().sort((a, b) => a.J_economic - b.J_economic);
    Plotly.newPlot('governanceParetoPlot', [
        { x: paretoOrdered.map(r => norm('J_economic', r.J_economic)), y: paretoOrdered.map(r => norm('J_social', r.J_social)),
          type: 'scatter', mode: 'lines+markers', line: { color: '#b85c38', width: 4 }, marker: { size: 11 },
          text: paretoOrdered.map(r => `ID=${r.id}<br>Điểm=${r.GovernanceScore.toFixed(3)}`), hovertemplate: '%{text}<extra></extra>', name: 'Pareto front' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#b8860b', line: { color: '#1f2f2f', width: 1 } }, name: 'J* được chọn' }
    ], Object.assign({}, transparent, { title: 'Pareto front trong không gian mục tiêu Ωᴶ', height: 660,
        autosize: true, margin: plotMargin, legend: horizontalLegend, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế chuẩn hóa — càng trái càng tốt', range: [0, 1] }, axisStyle),
        yaxis: Object.assign({ title: 'J xã hội chuẩn hóa — càng xuống càng tốt', range: [0, 1] }, axisStyle) }), common);
    const scoreLine = [];
    if (socialWeight > 1e-12) {
        const selectedLevel = data.weights[0] * selectedE + data.weights[1] * selectedS + envRiskPart;
        for (let x = 0; x <= 1.001; x += 0.02) scoreLine.push({ x: x, y: (selectedLevel - envRiskPart - econWeight * x) / socialWeight });
    }
    Plotly.newPlot('governancePreferencePlot', [
        { x: pareto.map(r => norm('J_economic', r.J_economic)), y: pareto.map(r => norm('J_social', r.J_social)), type: 'scatter', mode: 'markers', marker: { size: 9, color: '#b85c38', symbol: 'diamond' }, name: 'Pareto' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 15, color: '#b8860b', symbol: 'star', line: { color: '#1f2f2f', width: 1 } }, name: 'Quản trị chọn' },
        { x: scoreLine.map(p => p.x), y: scoreLine.map(p => p.y), type: 'scatter', mode: 'lines', line: { color: '#075e5f', width: 3, dash: 'dash' }, name: 'Đường giá trị quản trị' }
    ], Object.assign({}, transparent, { title: 'Quản trị chọn hướng trên Pareto bằng Vᴳ', height: 620, autosize: true, margin: plotMargin, font: layoutText.font, titlefont: layoutText.titlefont,
        xaxis: Object.assign({ title: 'J kinh tế chuẩn hóa', range: [0, 1] }, axisStyle), yaxis: Object.assign({ title: 'J xã hội chuẩn hóa', range: [0, 1] }, axisStyle), legend: horizontalLegend }), common);
    setTimeout(resizeGovernancePlots, 150);
}());
