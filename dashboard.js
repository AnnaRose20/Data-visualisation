// Don't declare width/height here if they're already defined in dataVis.js

// Helper to detect column types
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

// Main dashboard initializer
window.initDashboard = function(_data) {
    // Remove old charts if any
    d3.selectAll("#chart1 > *").remove();
    d3.selectAll("#chart2 > *").remove();
    d3.selectAll("#chart3 > *").remove();
    d3.selectAll("#chart4 > *").remove();

    // Use global width/height variables from dataVis.js
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

    createChart1(_data);
    createChart2(_data);
    createChart3(_data);
    createChart4(_data);
}

// --- SUNBURST CHART ---
function createChart1(data) {
    const { categorical } = detectColumnTypes(data);
    if (categorical.length < 2) {
        chart1.append("text").attr("x", 10).attr("y", 30).text("Not enough categorical columns!");
        return;
    }
    const nest = d3.group(data, d => d[categorical[0]], d => d[categorical[1]]);
    function buildNode([name, value]) {
        if (Array.isArray(value)) return { name, value: value.length };
        return { name, children: Array.from(value, buildNode) };
    }
    const root = { name: "root", children: Array.from(nest, buildNode) };
    const radius = Math.min(width, height) / 2 - 10;
    const partition = d3.partition().size([2 * Math.PI, radius]);
    const rootH = d3.hierarchy(root).sum(d => d.value);
    partition(rootH);
    chart1.attr("transform", `translate(${width/2},${height/2})`);
    chart1.selectAll("path")
        .data(rootH.descendants().filter(d => d.depth))
        .join("path")
        .attr("d", d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1))
        .attr("fill", d => d3.schemeCategory10[d.depth % 10])
        .attr("stroke", "#fff")
        .append("title")
        .text(d => `${d.ancestors().map(d => d.data.name).reverse().join("/")}: ${d.value}`);
}

// --- BAR CHART ---
function createChart2(data) {
    const { categorical, numerical } = detectColumnTypes(data);
    if (!categorical.length || !numerical.length) {
        chart2.append("text").attr("x", 10).attr("y", 30).text("Need one categorical and one numerical column!");
        return;
    }
    const counts = d3.rollups(data, v => d3.sum(v, d => +d[numerical[0]]), d => d[categorical[0]]);
    const x = d3.scaleBand().domain(counts.map(d => d[0])).range([40, width-20]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(counts, d => d[1])]).range([height-30, 10]);
    chart2.append("g").attr("transform", `translate(0,${height-30})`).call(d3.axisBottom(x));
    chart2.append("g").attr("transform", `translate(40,0)`).call(d3.axisLeft(y));
    chart2.selectAll("rect")
        .data(counts)
        .enter().append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d[1]))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0)-y(d[1]))
        .attr("fill", "#1f77b4");
}

// --- SCATTERPLOT ---
function createChart3(data) {
    const { numerical } = detectColumnTypes(data);
    if (numerical.length < 2) {
        chart3.append("text").attr("x", 10).attr("y", 30).text("Need at least 2 numerical columns!");
        return;
    }
    const x = d3.scaleLinear().domain(d3.extent(data, d => +d[numerical[0]])).nice().range([40, width-20]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => +d[numerical[1]])).nice().range([height-30, 10]);
    chart3.append("g").attr("transform", `translate(0,${height-30})`).call(d3.axisBottom(x));
    chart3.append("g").attr("transform", `translate(40,0)`).call(d3.axisLeft(y));
    chart3.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", d => x(+d[numerical[0]]))
        .attr("cy", d => y(+d[numerical[1]]))
        .attr("r", 4)
        .attr("fill", "#d62728")
        .attr("opacity", 0.6);
}

// --- HEATMAP ---
function createChart4(data) {
    const { categorical, numerical } = detectColumnTypes(data);
    if (categorical.length < 2 || !numerical.length) {
        chart4.append("text").attr("x", 10).attr("y", 30).text("Need two categorical and one numerical column!");
        return;
    }
    const xCats = Array.from(new Set(data.map(d => d[categorical[0]])));
    const yCats = Array.from(new Set(data.map(d => d[categorical[1]])));
    const matrix = [];
    yCats.forEach((yVal, yIdx) => {
        xCats.forEach((xVal, xIdx) => {
            const cellData = data.find(d => d[categorical[0]] === xVal && d[categorical[1]] === yVal);
            matrix.push({
                x: xVal,
                y: yVal,
                value: cellData ? +cellData[numerical[0]] : 0
            });
        });
    });
    const color = d3.scaleSequential(d3.interpolateYlGnBu)
        .domain([0, d3.max(matrix, d => d.value)]);
    const cellW = (width-60) / xCats.length;
    const cellH = (height-40) / yCats.length;
    chart4.selectAll("rect")
        .data(matrix)
        .join("rect")
        .attr("x", d => 50 + xCats.indexOf(d.x) * cellW)
        .attr("y", d => 20 + yCats.indexOf(d.y) * cellH)
        .attr("width", cellW)
        .attr("height", cellH)
        .attr("fill", d => color(d.value));
    chart4.append("g")
        .attr("transform", `translate(0,${20 + yCats.length*cellH})`)
        .call(d3.axisBottom(d3.scaleBand().domain(xCats).range([50, 50+xCats.length*cellW])));
    chart4.append("g")
        .attr("transform", `translate(50,0)`)
        .call(d3.axisLeft(d3.scaleBand().domain(yCats).range([20, 20+yCats.length*cellH])));
}
