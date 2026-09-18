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
    const transparent = { paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)' };
    const plotMargin = { l: 80, r: 130, t: 95, b: 85 };
    const plotMargin3d = { l: 30, r: 145, t: 95, b: 35 };
    const horizontalLegend = {
        orientation: 'h',
        x: 0,
        y: 1.12,
        xanchor: 'left',
        yanchor: 'bottom',
        bgcolor: 'rgba(255,255,255,0.82)',
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
        title: 'Sₜ → Sₜ₊₁ dưới tác động của Uₜ, X và ξₜ', height: 840, autosize: true, margin: plotMargin,
        xaxis: { title: 'V — Trữ lượng hồ (Mm³)' }, yaxis: { title: 'Q — Dòng chảy hạ du (m³/s)' },
        shapes: [
            { type: 'rect', x0: config.vcrit, x1: selected.K, y0: config.qeco,
              y1: Math.max(...states.map(r => r.Q)) * 1.15, fillcolor: 'rgba(42,157,143,0.12)', line: { width: 0 }, layer: 'below' },
            { type: 'line', x0: config.vcrit, x1: config.vcrit, y0: 0, y1: 1, yref: 'paper', line: { dash: 'dash', color: '#e76f51' } },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.qeco, y1: config.qeco, line: { dash: 'dash', color: '#e76f51' } }
        ]
    }), common);

    Plotly.newPlot('governanceTimePlot', [
        { x: states.map(r => r.t), y: states.map(r => r.V), type: 'scatter', mode: 'lines+markers', name: 'V(t)', line: { color: '#005f73', width: 3 } },
        { x: states.map(r => r.t), y: states.map(r => r.Q), type: 'scatter', mode: 'lines+markers', name: 'Q(t)', yaxis: 'y2', line: { color: '#e76f51', width: 2 } }
    ], Object.assign({}, transparent, {
        title: 'Quỹ đạo trạng thái theo thời gian', height: 840, autosize: true, margin: plotMargin, legend: horizontalLegend,
        xaxis: { title: 'Thời gian t' }, yaxis: { title: 'V (Mm³)', color: '#005f73' },
        yaxis2: { title: 'Q (m³/s)', overlaying: 'y', side: 'right', color: '#e76f51' },
        shapes: [
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.vcrit, y1: config.vcrit, line: { dash: 'dash', color: '#005f73' } },
            { type: 'line', x0: 0, x1: 1, xref: 'paper', y0: config.qeco, y1: config.qeco, yref: 'y2', line: { dash: 'dot', color: '#e76f51' } }
        ]
    }), common);

    Plotly.newPlot('governanceDecisionPlot', [
        { x: candidates.filter(r => !r.feasible).map(r => r.K), y: candidates.filter(r => !r.feasible).map(r => r.release_bias), z: candidates.filter(r => !r.feasible).map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 4, opacity: 0.20, color: '#8b9aa0' }, name: 'Bị Governance loại', hovertemplate: 'Phương án bị loại<extra></extra>' },
        { x: feasible.map(r => r.K), y: feasible.map(r => r.release_bias), z: feasible.map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 5, opacity: 0.70, color: feasible.map(r => r.storage_reliability), colorscale: 'Viridis', showscale: true, colorbar: { title: 'Storage reliability', x: 1.02 } },
          text: feasible.map(r => `ID=${r.id}<br>K=${r.K}<br>release=${r.release_bias}<br>supply=${(r.supply_fraction * 100).toFixed(0)}%`),
          hovertemplate: '%{text}<extra></extra>', name: 'Khả thi' },
        { x: pareto.map(r => r.K), y: pareto.map(r => r.release_bias), z: pareto.map(r => r.supply_fraction),
          type: 'scatter3d', mode: 'markers', marker: { size: 8, symbol: 'diamond', color: '#e76f51' }, name: 'Pareto' },
        { x: [selected.K], y: [selected.release_bias], z: [selected.supply_fraction],
          type: 'scatter3d', mode: 'markers', marker: { size: 12, symbol: 'star', color: '#e9c46a', line: { color: '#26343a', width: 1 } }, name: 'Governance chọn' }
    ], Object.assign({}, transparent, {
        title: 'Không gian quyết định Ωᴰ', height: 840, autosize: true, margin: plotMargin3d,
        scene: { domain: { x: [0, 0.90], y: [0, 1] }, xaxis: { title: 'X = K (Mm³)' }, yaxis: { title: 'Release bias' }, zaxis: { title: 'Supply fraction', tickformat: '.0%' } },
        legend: horizontalLegend
    }), common);

    Plotly.newPlot('governanceObjectivePlot', [
        { x: feasible.map(r => r.J_economic), y: feasible.map(r => r.J_social), type: 'scatter', mode: 'markers',
          marker: { size: feasible.map(r => 7 + 12 * r.storage_reliability), color: feasible.map(r => r.J_environment), colorscale: 'Viridis', showscale: true, colorbar: { title: 'Environment', x: 1.03 } },
          text: feasible.map(r => `ID=${r.id}<br>K=${r.K}<br>risk=${r.J_risk.toFixed(3)}`), hovertemplate: '%{text}<extra></extra>', name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), type: 'scatter', mode: 'markers', marker: { size: 13, symbol: 'diamond-open', line: { width: 2, color: '#e76f51' } }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#e9c46a', line: { color: '#26343a', width: 1 } }, name: 'Governance chọn' }
    ], Object.assign({}, transparent, { title: 'Kinh tế — Xã hội', height: 840, autosize: true, margin: plotMargin,
        xaxis: { title: 'J economic' }, yaxis: { title: 'J social' }, legend: horizontalLegend }), common);

    Plotly.newPlot('governanceObjective3d', [
        { x: feasible.map(r => r.J_economic), y: feasible.map(r => r.J_social), z: feasible.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 4, opacity: 0.45 }, name: 'Khả thi' },
        { x: pareto.map(r => r.J_economic), y: pareto.map(r => r.J_social), z: pareto.map(r => r.J_environment), type: 'scatter3d', mode: 'markers', marker: { size: 7, color: '#e76f51' }, name: 'Pareto' },
        { x: [selected.J_economic], y: [selected.J_social], z: [selected.J_environment], type: 'scatter3d', mode: 'markers', marker: { size: 10, symbol: 'diamond', color: '#e9c46a' }, name: 'Governance chọn' }
    ], Object.assign({}, transparent, { title: 'Không gian mục tiêu 3D', height: 840, autosize: true, margin: plotMargin3d,
        scene: { domain: { x: [0, 0.94], y: [0, 1] }, xaxis: { title: 'Economic' }, yaxis: { title: 'Social' }, zaxis: { title: 'Environment' } },
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
          type: 'scatter', mode: 'lines+markers', line: { color: '#e76f51', width: 4 }, marker: { size: 11 },
          text: paretoOrdered.map(r => `ID=${r.id}<br>Score=${r.GovernanceScore.toFixed(3)}`), hovertemplate: '%{text}<extra></extra>', name: 'Pareto front' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 18, symbol: 'star', color: '#e9c46a', line: { color: '#26343a', width: 1 } }, name: 'J* được chọn' }
    ], Object.assign({}, transparent, { title: 'Pareto front trong không gian mục tiêu chuẩn hóa', height: 840,
        autosize: true, margin: plotMargin, legend: horizontalLegend,
        xaxis: { title: 'J economic chuẩn hóa — càng trái càng tốt', range: [0, 1] },
        yaxis: { title: 'J social chuẩn hóa — càng xuống càng tốt', range: [0, 1] } }), common);
    const scoreLine = [];
    if (socialWeight > 1e-12) {
        const selectedLevel = data.weights[0] * selectedE + data.weights[1] * selectedS + envRiskPart;
        for (let x = 0; x <= 1.001; x += 0.02) scoreLine.push({ x: x, y: (selectedLevel - envRiskPart - econWeight * x) / socialWeight });
    }
    Plotly.newPlot('governancePreferencePlot', [
        { x: pareto.map(r => norm('J_economic', r.J_economic)), y: pareto.map(r => norm('J_social', r.J_social)), type: 'scatter', mode: 'markers', marker: { size: 9, color: '#e76f51', symbol: 'diamond' }, name: 'Pareto' },
        { x: [selectedE], y: [selectedS], type: 'scatter', mode: 'markers', marker: { size: 15, color: '#e9c46a', symbol: 'star', line: { color: '#26343a', width: 1 } }, name: 'Governance chọn' },
        { x: scoreLine.map(p => p.x), y: scoreLine.map(p => p.y), type: 'scatter', mode: 'lines', line: { color: '#7b2cbf', width: 3, dash: 'dash' }, name: 'Đường giá trị Governance' }
    ], Object.assign({}, transparent, { title: 'Governance chọn hướng trên Pareto', height: 720, autosize: true, margin: plotMargin,
        xaxis: { title: 'J economic chuẩn hóa', range: [0, 1] }, yaxis: { title: 'J social chuẩn hóa', range: [0, 1] }, legend: horizontalLegend }), common);
    setTimeout(resizeGovernancePlots, 150);
}());
