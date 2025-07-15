/*
* Data Visualization - Framework
* Copyright (C) University of Passau
*   Faculty of Computer Science and Mathematics
*   Chair of Cognitive sensor systems
* Maintenance:
*   2025, Alexander Gall <alexander.gall@uni-passau.de>
*
* All rights reserved.
*/

let chart1, chart2, chart3, chart4;
let dashboardData;
const width = 400;
const height = 300;

function initDashboard(_data) {
    if (!_data || !_data.length) return;

    dashboardData = _data;

    // Clear old charts
    d3.selectAll("#chart1 > *").remove();
    d3.selectAll("#chart2 > *").remove();
    d3.selectAll("#chart3 > *").remove();
    d3.selectAll("#chart4 > *").remove();

    chart1 = d3.select("#chart1").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    chart2 = d3.select("#chart2").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    chart3 = d3.select("#chart3").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    chart4 = d3.select("#chart4").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    createChart1(dashboardData);
    createChart2(dashboardData);
    createChart3(dashboardData);
    createChart4(dashboardData);
}

function detectColumnTypes(data) {
    const keys = Object.keys(data[0]);
    const numerical = [];
    const categorical = [];

    keys.forEach(k => {
        const values = data.map(d => d[k]);
        const isNumeric = values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
        (isNumeric ? numerical : categorical).push(k);
    });

    return { numerical, categorical };
}
