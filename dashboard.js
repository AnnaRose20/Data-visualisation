function detectColumnTypes(data) {
    const keys = Object.keys(data[0]);
    const ignoreCols = ["Person ID", "_id", "ID", "Index"]; // Add more as needed
    const numerical = [];
    const categorical = [];
    keys.forEach(k => {
        if (ignoreCols.includes(k)) return; // <-- Ignore these columns
        const values = data.map(d => d[k]);
        const isNumeric = values.every(v => !isNaN(parseFloat(v)) && isFinite(v));
        (isNumeric ? numerical : categorical).push(k);
    });
    return { numerical, categorical };
}


// Global data cache for listeners
let dashData = [];

window.initDashboard = function(_data) {
    dashData = _data;
    d3.selectAll("#chart1 > *").remove();
    d3.selectAll("#chart2 > *").remove();
    d3.selectAll("#chart3 > *").remove();
    d3.selectAll("#chart4 > *").remove();

    const {numerical, categorical} = detectColumnTypes(_data);

    // === PARALLEL COORDS AXIS DROPDOWNS (multi-select) ===
    fillMultiDropdown("#parcoordsAxes", numerical, numerical.slice(0, 5));
    fillParcoordsCheckboxes(numerical, numerical.slice(0, 5));

    // === SPLOM DROPDOWNS ===
    //fillDropdown("#splomX", numerical);
    //fillDropdown("#splomY", numerical);
    //setDropdown("#splomX", numerical[0]);
    //setDropdown("#splomY", numerical[1]);
    // Populate and set event for the color-by dropdown
    fillDropdown("#splomColor", categorical);
    setDropdown("#splomColor", categorical[0]);
    d3.select("#splomColor").on("change", () => createChart2(dashData));


    // === SUNBURST DROPDOWNS ===
    fillDropdown("#sunCat1", categorical);
    fillDropdown("#sunCat2", categorical);
    fillDropdown("#sunCat3", categorical);
    setDropdown("#sunCat1", categorical[0]);
    setDropdown("#sunCat2", categorical[1]);
    setDropdown("#sunCat3", categorical[2] || categorical[1] || categorical[0]);

    // === BOX PLOT DROPDOWNS ===
    fillDropdown("#boxNum", numerical);
    fillDropdown("#boxCat", categorical);
    setDropdown("#boxNum", numerical[0]);
    setDropdown("#boxCat", categorical[0]);

    // Listeners
    d3.select("#parcoordsAxes").on("change", () => createChart1(dashData));
    d3.select("#splomX").on("change", () => createChart2(dashData));
    d3.select("#splomY").on("change", () => createChart2(dashData));
    d3.select("#sunCat1").on("change", () => createChart3(dashData));
    d3.select("#sunCat2").on("change", () => createChart3(dashData));
    d3.select("#sunCat3").on("change", () => createChart3(dashData));
    d3.select("#boxNum").on("change", () => createChart4(dashData));
    d3.select("#boxCat").on("change", () => createChart4(dashData));

    // Draw initial charts
    createChart1(_data);
    createChart2(_data);
    createChart3(_data);
    createChart4(_data);
};

function fillDropdown(sel, values) {
    const selNode = d3.select(sel);
    selNode.selectAll("option").remove();
    if (!values) return;
    selNode.selectAll("option")
        .data(values)
        .enter()
        .append("option")
        .attr("value", d => d)
        .text(d => d);
}
function setDropdown(sel, value) {
    d3.select(sel).property("value", value);
}
function fillMultiDropdown(sel, values, selected=[]) {
    const selNode = d3.select(sel);
    selNode.selectAll("option").remove();
    if (!values) return;
    selNode.attr("multiple", true);
    selNode.selectAll("option")
        .data(values)
        .enter()
        .append("option")
        .attr("value", d => d)
        .attr("selected", d => selected.includes(d) ? "selected" : null)
        .text(d => d);
}
function fillParcoordsCheckboxes(numerical, selected=[]) {
    const container = d3.select("#parcoordsAxesCheckboxes");
    container.selectAll("*").remove();
    numerical.forEach(axis => {
        const label = container.append("label").style("margin-right", "15px");
        label.append("input")
            .attr("type", "checkbox")
            .attr("value", axis)
            .property("checked", selected.includes(axis))
            .on("change", () => createChart1(dashData));
        label.append("span").text(axis);
    });
}


//////////////////////////////////////
// 1. PARALLEL COORDINATES PLOT    //
//////////////////////////////////////
function createChart1(data) {
    d3.select("#chart1").selectAll("*").remove();

    // Read checked axes
    let axes = [];
    d3.selectAll("#parcoordsAxesCheckboxes input[type='checkbox']").each(function() {
        if (d3.select(this).property("checked")) axes.push(this.value);
    });

    if (!axes || axes.length < 2) {
        d3.select("#chart1").append("div").text("Select two or more numeric columns!");
        return;
    }

    // Larger dimensions!
    const container = document.getElementById('chart1');
    const width = container.clientWidth || 800;   // fallback to 800 if needed
    const height = Math.round(width * 0.7);       // aspect ratio, can adjust

    const margin = {top: 40, right: 40, bottom: 40, left: 40};
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;


    const svg = d3.select("#chart1")
        .append("svg")
        .attr("width", "100%")    // let SVG fill the div
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);  // scales all drawing commands


    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);


    // Y scale per axis
    const y = {};
    axes.forEach(axis => {
        y[axis] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[axis]))
            .range([h, 0]);
    });

    // X scale for axes
    const x = d3.scalePoint()
        .range([0, w])
        .padding(1)
        .domain(axes);

    // Draw lines
    g.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .join("path")
        .attr("d", d => d3.line()(axes.map(p => [x(p), y[p](d[p])])))
        .attr("stroke", "#1f77b4")
        .attr("fill", "none")
        .attr("opacity", 0.3);

    // Draw axes
    const axisG = g.selectAll(".axis")
        .data(axes)
        .join("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)})`)
        .each(function(d) { d3.select(this).call(d3.axisLeft(y[d])); });

    // Axis labels
    const fontSize = Math.max(7, Math.min(10, Math.floor(w / axes.length / 4)));

    axisG.append("text")
        .attr("y", -10)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("font-size", fontSize)
        .attr("text-anchor", axes.length > 7 ? "end" : "middle")
        .attr("transform", axes.length > 7 ? "rotate(-40)" : null)
        .text(d => d);


}


//////////////////////////////////////
// 2. SCATTERPLOT MATRIX (SPLOM)   //
//////////////////////////////////////
function createChart2(data) {
    d3.select("#chart2").selectAll("*").remove();
    const { numerical, categorical } = detectColumnTypes(data);
    
    if (numerical.length < 2) {
        d3.select("#chart2").append("div").text("Not enough numeric columns!");
        return;
    }
    const container = document.getElementById('chart2');
    const width = container.clientWidth || 700;

    const colorBy = d3.select("#splomColor").property("value") || categorical[0];
    const colorValues = Array.from(new Set(data.map(d => d[colorBy])));
    const colorScale = d3.scaleOrdinal()
        .domain(colorValues)
        .range(d3.schemeCategory10);

    // --- Layout
    const n = numerical.length;
    const padding = 18;
    const legendBoxSize = 22;
    const legendWidth = 130;

    // Figure out how much space is left for each cell:
    const matrixWidth = width - legendWidth - padding * 3;
    const size = Math.max(50, Math.min(110, Math.floor(matrixWidth / n))); // adjust as needed
    const height = size * n + padding * 3;

    const svg = d3.select("#chart2")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

    // Scales for each variable
    const scales = {};
    numerical.forEach(attr => {
        scales[attr] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[attr]))
            .nice()
            .range([padding, size - padding]);
    });

    // Grid cell plotting
    for (let row = 0; row < n; ++row) {
        for (let col = 0; col < n; ++col) {
            const cell = svg.append("g")
                .attr("transform", `translate(${col * size + padding*2},${row * size + padding*2})`);

            // === Draw grid background ===
            const xTicks = scales[numerical[col]].ticks(5);
            const yTicks = scales[numerical[row]].ticks(5);

            // Vertical grid lines
            cell.selectAll("grid-x")
                .data(xTicks)
                .enter()
                .append("line")
                .attr("x1", d => scales[numerical[col]](d))
                .attr("x2", d => scales[numerical[col]](d))
                .attr("y1", padding)
                .attr("y2", size - padding)
                .attr("stroke", "#dddddd")
                .attr("stroke-width", 1);

            // Horizontal grid lines
            cell.selectAll("grid-y")
                .data(yTicks)
                .enter()
                .append("line")
                .attr("y1", d => scales[numerical[row]](d))
                .attr("y2", d => scales[numerical[row]](d))
                .attr("x1", padding)
                .attr("x2", size - padding)
                .attr("stroke", "#dddddd")
                .attr("stroke-width", 1);

            // === Data points ===
            if (row !== col) {
                cell.selectAll("circle")
                    .data(data)
                    .join("circle")
                    .attr("cx", d => scales[numerical[col]](+d[numerical[col]]))
                    .attr("cy", d => scales[numerical[row]](+d[numerical[row]]))
                    .attr("r", 3)
                    .attr("fill", d => colorScale(d[colorBy]))
                    .attr("opacity", 0.7);
            } else {
                cell.append("text")
                    .attr("x", size/2)
                    .attr("y", size/2)
                    .attr("text-anchor", "middle")
                    .attr("font-weight", "bold")
                    .attr("font-size", "13px")
                    .text(numerical[row]);
            }

            // X axis attribute label (top row)
            if (row === 0) {
                cell.append("text")
                    .attr("x", size/2)
                    .attr("y", -6)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "11px")
                    .attr("fill", "#555")
                    .text(numerical[col]);
            }
            // Y axis attribute label (left col)
            if (col === 0) {
                cell.append("text")
                    .attr("x", -size * 0.17)    // Move label further left (adjust as needed)
                    .attr("y", size / 2)
                    .attr("text-anchor", "end")
                    .attr("font-size", "13px")
                    .attr("fill", "#555")
                    .attr("transform", `rotate(-90, ${-size * 0.17}, ${size / 2})`)
                    .text(numerical[row]);
            }

            // Cell outline (optional, to match your image)
            cell.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", size)
                .attr("height", size)
                .attr("fill", "none")
                .attr("stroke", "#bbb");
        }
    }

    // Legend at right
    const legend = svg.append("g")
        .attr("transform", `translate(${size * n + padding*2 + 25},${padding*2})`);
    legend.selectAll("legendEntry")
        .data(colorValues)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(0,${i * legendBoxSize})`)
        .each(function(d, i) {
            d3.select(this).append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 14)
                .attr("height", 14)
                .attr("fill", colorScale(d));
            d3.select(this).append("text")
                .attr("x", 22)
                .attr("y", 11)
                .attr("font-size", "13px")
                .text(d);
        });
    legend.append("text")
        .attr("x", 0)
        .attr("y", -10)
        .attr("font-weight", "bold")
        .attr("font-size", "13px")
        .text(colorBy);

}

//////////////////////////////////////
// 3. HEATMAP  //
//////////////////////////////////////

function createChart3(data) {
    // Helper: get categorical and numeric columns
    const maxUniques = 20;
    const columns = Object.keys(data[0]);
    const cats = columns.filter(
        col => (new Set(data.map(d => d[col])).size > 1) &&
               (new Set(data.map(d => d[col])).size <= maxUniques) &&
               !col.match(/id/i)
    );
    const nums = columns.filter(
        col => data.every(d => !isNaN(+d[col]))
    );

    // Populate dropdowns
    function populateDropdown(id, options, defaultVal) {
        const select = d3.select(id);
        select.selectAll("option").remove();
        select.selectAll("option")
            .data(options)
            .enter().append("option")
            .attr("value", d => d)
            .text(d => d);
        if (defaultVal) select.property("value", defaultVal);
    }
    populateDropdown("#heatmap-row", cats, cats[0]);
    populateDropdown("#heatmap-col", cats, cats[1] || cats[0]);
    populateDropdown("#heatmap-value", nums, nums[0] || "");
    d3.select("#heatmap-agg").property("value", "mean");

    // Heatmap drawing function
    function drawHeatmap() {
        const rowAttr = d3.select("#heatmap-row").property("value");
        const colAttr = d3.select("#heatmap-col").property("value");
        const valueAttr = d3.select("#heatmap-value").property("value");
        const agg = d3.select("#heatmap-agg").property("value");
        if (!(rowAttr && colAttr && valueAttr)) return;

        // Aggregation function
        let aggFunc = d3.mean;
        if (agg === "median") aggFunc = d3.median;
        if (agg === "count") aggFunc = vals => vals.length;

        // Unique row/col labels
        const rowVals = Array.from(new Set(data.map(d => d[rowAttr]))).sort();
        const colVals = Array.from(new Set(data.map(d => d[colAttr]))).sort();

        // Compute matrix
        const matrix = rowVals.map(row =>
            colVals.map(col => {
                const vals = data.filter(d => d[rowAttr] === row && d[colAttr] === col)
                                 .map(d => +d[valueAttr]);
                return vals.length ? aggFunc(vals) : null;
            })
        );

        // Set up SVG
        const cellSize = 32, margin = {top: 60, right: 10, bottom: 70, left: 120};
        const width = colVals.length * cellSize + margin.left + margin.right;
        const height = rowVals.length * cellSize + margin.top + margin.bottom;

        d3.select("#heatmap").selectAll("*").remove();

        const svg = d3.select("#heatmap").append("svg")
            .attr("width", width)
            .attr("height", height);

        // Color scale
        const flat = matrix.flat().filter(x => x !== null);
        const color = agg === "count"
            ? d3.scaleSequential(d3.interpolateBlues).domain([0, d3.max(flat)])
            : d3.scaleSequential(d3.interpolateYlGnBu).domain([d3.min(flat), d3.max(flat)]);

        // Draw cells
        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        g.selectAll("g")
            .data(matrix)
            .join("g")
            .attr("transform", (_, i) => `translate(0,${i*cellSize})`)
            .selectAll("rect")
            .data(d => d)
            .join("rect")
            .attr("x", (_, j) => j * cellSize)
            .attr("width", cellSize)
            .attr("height", cellSize)
            .attr("fill", d => d !== null ? color(d) : "#eee")
            .attr("stroke", "#fff");

        // Row labels
        svg.append("g").attr("transform", `translate(${margin.left-5},${margin.top})`)
            .selectAll("text")
            .data(rowVals)
            .join("text")
            .attr("y", (_, i) => i*cellSize + cellSize/2)
            .attr("x", -8)
            .attr("dy", ".32em")
            .attr("text-anchor", "end")
            .text(d => d)
            .style("font-size", "13px");

        // Col labels
        svg.append("g").attr("transform", `translate(${margin.left},${margin.top-8})`)
            .selectAll("text")
            .data(colVals)
            .join("text")
            .attr("x", (_, j) => j*cellSize + cellSize/2)
            .attr("y", 0)
            .attr("text-anchor", "middle")
            .attr("transform", (_, j) => `rotate(-45,${j*cellSize + cellSize/2},0)`)
            .text(d => d)
            .style("font-size", "13px");

        // Tooltip
        d3.select("#heatmap-tooltip").remove();
        const tooltip = d3.select("body").append("div")
            .attr("id", "heatmap-tooltip")
            .style("position", "absolute")
            .style("background", "#fff")
            .style("border", "1px solid #aaa")
            .style("padding", "5px 10px")
            .style("border-radius", "6px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.13)")
            .style("pointer-events", "none")
            .style("visibility", "hidden");

        g.selectAll("rect")
            .on("mouseover", function(event, d) {
                if (d !== null) {
                    d3.select(this).attr("stroke", "#222");
                    const i = d3.select(this.parentNode).datum();
                    const rowIdx = matrix.indexOf(i);
                    const colIdx = Array.from(d3.select(this.parentNode).selectAll("rect").nodes()).indexOf(this);
                    tooltip.html(`<strong>${rowAttr}:</strong> ${rowVals[rowIdx]}<br><strong>${colAttr}:</strong> ${colVals[colIdx]}<br><strong>${agg === "count" ? "Count" : valueAttr}:</strong> ${d.toFixed(2)}`)
                        .style("visibility", "visible");
                }
            })
            .on("mousemove", function(event) {
                tooltip.style("top", (event.pageY - 40) + "px")
                       .style("left", (event.pageX + 12) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", "#fff");
                tooltip.style("visibility", "hidden");
            });

        // Title
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", 28)
            .attr("text-anchor", "middle")
            .attr("font-size", "18px")
            .attr("font-weight", "bold")
            .text(`${agg === "count" ? "Count" : valueAttr} by ${rowAttr} vs ${colAttr}`);
    }

    // Draw once, and whenever any dropdown changes
    drawHeatmap();
    d3.selectAll("#heatmap-row,#heatmap-col,#heatmap-value,#heatmap-agg").on("change", drawHeatmap);
}

//////////////////////////////////////
// 4. BOX PLOT BY GROUP            //
//////////////////////////////////////
function createChart4(data) {
    d3.select("#chart4").selectAll("*").remove();
    const numCol = d3.select("#boxNum").property("value");
    const catCol = d3.select("#boxCat").property("value");
    if (!numCol || !catCol) {
        d3.select("#chart4").append("div").text("Please select both a numeric and categorical column!");
        return;
    }
    // Increase visualization size!
    const width = 700;
    const height = 700;
    const margin = {top: 40, right: 30, bottom: 70, left: 70};

    // Group data
    const grouped = Array.from(d3.group(data, d => d[catCol]), ([key, values]) => {
        const vals = values.map(d => +d[numCol]).filter(v => !isNaN(v));
        vals.sort(d3.ascending);
        return {
            key,
            min: d3.min(vals),
            q1: d3.quantile(vals, 0.25),
            median: d3.quantile(vals, 0.5),
            q3: d3.quantile(vals, 0.75),
            max: d3.max(vals)
        };
    });

    const x = d3.scaleBand()
        .domain(grouped.map(d => d.key))
        .range([margin.left, width - margin.right])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([
            d3.min(grouped, d => d.min), 
            d3.max(grouped, d => d.max)
        ])
        .nice()
        .range([height - margin.bottom, margin.top]);

    const svg = d3.select("#chart4")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // X Axis
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("font-size", 14)
        .attr("text-anchor", "end")
        .attr("dx", "-0.6em")
        .attr("dy", "0.3em")
        .attr("transform", "rotate(-35)");


    // Y Axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .selectAll("text")
        .attr("font-size", 14);

    // Boxes
    svg.selectAll("rect.box")
        .data(grouped)
        .enter().append("rect")
        .attr("class", "box")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.q3))
        .attr("width", x.bandwidth())
        .attr("height", d => y(d.q1) - y(d.q3))
        .attr("fill", "#a6cee3");

    // Medians
    svg.selectAll("line.median")
        .data(grouped)
        .enter().append("line")
        .attr("class", "median")
        .attr("x1", d => x(d.key))
        .attr("x2", d => x(d.key) + x.bandwidth())
        .attr("y1", d => y(d.median))
        .attr("y2", d => y(d.median))
        .attr("stroke", "#1f78b4")
        .attr("stroke-width", 2);

    // Whiskers
    svg.selectAll("line.min")
        .data(grouped)
        .enter().append("line")
        .attr("x1", d => x(d.key) + x.bandwidth()/2)
        .attr("x2", d => x(d.key) + x.bandwidth()/2)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.q1))
        .attr("stroke", "black");

    svg.selectAll("line.max")
        .data(grouped)
        .enter().append("line")
        .attr("x1", d => x(d.key) + x.bandwidth()/2)
        .attr("x2", d => x(d.key) + x.bandwidth()/2)
        .attr("y1", d => y(d.q3))
        .attr("y2", d => y(d.max))
        .attr("stroke", "black");

    // Optionally add titles
    svg.append("text")
        .attr("x", width/2)
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 20)
        .attr("font-weight", "bold")
        .text(`${numCol} by ${catCol}`);
}

