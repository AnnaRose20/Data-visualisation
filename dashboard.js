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

    // Find active axes
    let axes = [];
    d3.selectAll("#parcoordsAxesCheckboxes input[type='checkbox']").each(function() {
        if (d3.select(this).property("checked")) axes.push(this.value);
    });
    if (!axes || axes.length < 2) {
        d3.select("#chart1").append("div").text("Select two or more numeric columns!");
        return;
    }

    // Size
    const parent = document.getElementById('chart1').parentElement;
    const width = parent.clientWidth || 800;
    const height = Math.round(width * 0.65);
    const margin = {top: 100, right: 38, bottom: 60, left: 38};
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Scales
    const y = {};
    axes.forEach(axis => {
        y[axis] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[axis]))
            .range([h, 0]);
    });
    const x = d3.scalePoint()
        .range([0, w])
        .padding(1)
        .domain(axes);

    // Brush extents per axis (null: unbrushed)
    const brushes = {};

    // SVG
    const svg = d3.select("#chart1")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Polyline generator
    function path(d) {
        return d3.line()(axes.map(p => [x(p), y[p](d[p])]));
    }

    // Foreground lines
    const lines = g.append("g")
        .attr("class", "foreground")
        .selectAll("path")
        .data(data)
        .join("path")
        .attr("d", path)
        .attr("stroke", "#1f77b4")
        .attr("fill", "none")
        .attr("opacity", 0.3)
        .attr("class", "parcoord-line")
        .on("mouseover", function(event, d) {
            d3.selectAll(".parcoord-line").attr("stroke", "#bbb").attr("opacity", 0.1);
            d3.select(this).attr("stroke", "#d62728").attr("opacity", 1).raise();

            // Optional: tooltip (show individual id or all axis values)
            const tooltip = d3.select("body").append("div")
                .attr("class", "parcoords-tooltip")
                .style("position", "absolute")
                .style("background", "#fff")
                .style("border", "1px solid #aaa")
                .style("padding", "6px 10px")
                .style("border-radius", "6px")
                .style("box-shadow", "0 2px 8px rgba(0,0,0,0.13)")
                .style("pointer-events", "none")
                .style("font-size", "12px")
                .html(
                    Object.entries(d).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join("<br>")
                )
                .style("left", (event.pageX + 14) + "px")
                .style("top", (event.pageY - 40) + "px")
                .style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            d3.select(".parcoords-tooltip")
                .style("left", (event.pageX + 14) + "px")
                .style("top", (event.pageY - 40) + "px");
        })
        .on("mouseout", function() {
            d3.selectAll(".parcoord-line").attr("stroke", "#1f77b4").attr("opacity", 0.3);
            d3.select(".parcoords-tooltip").remove();
        });

    // Axes
    const axisG = g.selectAll(".axis")
        .data(axes)
        .join("g")
        .attr("class", "axis")
        .attr("transform", d => `translate(${x(d)})`)
        .each(function(d) { d3.select(this).call(d3.axisLeft(y[d])); });

    // Axis labels
    axisG.append("text")
        .attr("y", -4)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("font-size", 12)
        .attr("text-anchor", "end")
        .attr("transform", "rotate(45)")
        .text(d => d);

    // Brushing: one axis at a time
    axisG.append("g")
        .attr("class", "brush")
        .each(function(axis) {
            d3.select(this).call(
                d3.brushY()
                    .extent([[-10, 0], [10, h]])
                    .on("brush end", ({selection}) => {
                        if (selection) {
                            // Update this axis's brush
                            const [y0, y1] = selection;
                            brushes[axis] = [
                                y[axis].invert(y1),
                                y[axis].invert(y0)
                            ];
                        } else {
                            brushes[axis] = null;
                        }
                        updateLines();
                    })
            );
        });

    // Filtering lines based on brushes
    function updateLines() {
        lines.attr("display", d => {
            return axes.every(axis =>
                !brushes[axis] || (
                    d[axis] >= Math.min(...brushes[axis]) &&
                    d[axis] <= Math.max(...brushes[axis])
                )
            ) ? null : "none";
        });
    }
}

//////////////////////////////////////
// 2. SCATTERPLOT MATRIX (SPLOM)   //
//////////////////////////////////////
function createChart2(data) {
    d3.select("#chart2").selectAll("*").remove();
    d3.select("#splom-modal").remove();

    const { numerical, categorical } = detectColumnTypes(data);

    if (numerical.length < 2) {
        d3.select("#chart2").append("div").text("Not enough numeric columns!");
        return;
    }

    const container = document.getElementById('chart2');
    const width = container.clientWidth || 900;
    const containerPad = 48, topPad = 38, labelPad = 30, padding = 14, legendBoxSize = 18, legendWidth = 110;
    const n = numerical.length;
    const matrixWidth = width - legendWidth - padding * 3 - labelPad - containerPad;
    const size = Math.max(44, Math.min(90, Math.floor(matrixWidth / n)));
    const height = size * n + padding * 3 + topPad;
    const gridOriginX = labelPad + containerPad;

    const colorBy = d3.select("#splomColor").property("value") || categorical[0];
    const colorValues = Array.from(new Set(data.map(d => d[colorBy])));
    const colorScale = d3.scaleOrdinal()
        .domain(colorValues)
        .range(d3.schemeCategory10);

    // One scale per variable
    const scales = {};
    numerical.forEach(attr => {
        scales[attr] = d3.scaleLinear()
            .domain(d3.extent(data, d => +d[attr]))
            .nice()
            .range([padding, size - padding]);
    });

    const svg = d3.select("#chart2")
        .append("svg")
        .attr("width", "100%")
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    for (let row = 0; row < n; ++row) {
        for (let col = 0; col < n; ++col) {
            const cell = svg.append("g")
                .attr("transform", `translate(${col * size + padding*2 + gridOriginX},${row * size + padding*2 + topPad})`);

            if (row !== col) {
                const xAttr = numerical[col];
                const yAttr = numerical[row];
                const xScale = scales[xAttr];
                const yScale = scales[yAttr];

                // Grid lines
                cell.selectAll("grid-x")
                    .data(xScale.ticks(5))
                    .enter()
                    .append("line")
                    .attr("x1", d => xScale(d))
                    .attr("x2", d => xScale(d))
                    .attr("y1", padding)
                    .attr("y2", size - padding)
                    .attr("stroke", "#dddddd")
                    .attr("stroke-width", 1);

                cell.selectAll("grid-y")
                    .data(yScale.ticks(5))
                    .enter()
                    .append("line")
                    .attr("y1", d => yScale(d))
                    .attr("y2", d => yScale(d))
                    .attr("x1", padding)
                    .attr("x2", size - padding)
                    .attr("stroke", "#dddddd")
                    .attr("stroke-width", 1);

                // Points
                cell.selectAll("circle")
                    .data(data)
                    .join("circle")
                    .attr("cx", d => xScale(+d[xAttr]))
                    .attr("cy", d => yScale(+d[yAttr]))
                    .attr("r", 3)
                    .attr("fill", d => colorScale(d[colorBy]))
                    .attr("opacity", 0.7);

                // Click to modal: pass variable names!
                cell.append("rect")
                    .attr("class", "splom-cell-cover")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", size)
                    .attr("height", size)
                    .attr("fill", "transparent")
                    .style("cursor", "pointer")
                    .on("click", () => showModal(xAttr, yAttr, colorBy, scales[xAttr].domain(), scales[yAttr].domain()));
            } else {
                // Diagonal: attribute label
                const label = numerical[row];
                const split = label.split(" ");
                const textElem = cell.append("text")
                    .attr("x", size / 2)
                    .attr("y", size / 2 - (split.length > 1 ? 10 : -2))
                    .attr("text-anchor", "middle")
                    .attr("font-size", 13);
                split.forEach((line, i) => {
                    textElem.append("tspan")
                        .attr("x", size / 2)
                        .attr("dy", i === 0 ? 0 : 15)
                        .text(line);
                });
            }

            // X axis label (top row)
            if (row === 0) {
                const label = numerical[col];
                const split = label.split(" ");
                const textElem = cell.append("text")
                    .attr("x", size / 2)
                    .attr("y", -30)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "11px")
                    .attr("fill", "#555");
                split.forEach((line, i) => {
                    textElem.append("tspan")
                        .attr("x", size / 2)
                        .attr("dy", i === 0 ? 0 : 13)
                        .text(line);
                });
            }

            // Y axis label (left col)
            if (col === 0) {
                const label = numerical[row];
                const split = label.split(" ");
                const textElem = cell.append("text")
                    .attr("x", -labelPad + 13)
                    .attr("y", size / 2 - (split.length > 1 ? 26 : 18))
                    .attr("text-anchor", "end")
                    .attr("font-size", "13px")
                    .attr("fill", "#555")
                    .attr("alignment-baseline", "middle");
                split.forEach((line, i) => {
                    textElem.append("tspan")
                        .attr("x", -labelPad + 13)
                        .attr("dy", i === 0 ? 0 : 15)
                        .text(line);
                });
            }

            // Cell outline
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
        .attr("transform", `translate(${size * n + padding*2 + gridOriginX + 10},${padding*2 + topPad})`);
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

    // ---- MODAL logic ----
    function showModal(xField, yField, colorField, xDomain, yDomain) {
        d3.select("#splom-modal").remove();

        const modal = d3.select("body").append("div")
            .attr("id", "splom-modal");

        modal.append("div")
            .attr("id", "splom-modal-close")
            .html("&times;")
            .on("click", () => d3.select("#splom-modal").remove());

        const modalWidth = 680, modalHeight = 600, pad = 54;
        // Use the same domain as the small plot!
        const mx = d3.scaleLinear()
            .domain(xDomain)
            .range([pad, modalWidth - pad]);
        const my = d3.scaleLinear()
            .domain(yDomain)
            .range([modalHeight - pad, pad]);

        const msvg = modal.append("svg")
            .attr("width", modalWidth)
            .attr("height", modalHeight);

        // X axis
        msvg.append("g")
            .attr("transform", `translate(0,${modalHeight - pad})`)
            .call(d3.axisBottom(mx).ticks(8))
            .append("text")
            .attr("x", modalWidth / 2)
            .attr("y", 45)
            .attr("fill", "#000")
            .attr("font-weight", "bold")
            .attr("font-size", "18px")
            .attr("text-anchor", "middle")
            .text(xField);

        // Y axis
        msvg.append("g")
            .attr("transform", `translate(${pad},0)`)
            .call(d3.axisLeft(my).ticks(8))
            .append("text")
            .attr("x", -modalHeight/2)
            .attr("y", -36)
            .attr("transform", "rotate(-90)")
            .attr("fill", "#000")
            .attr("font-weight", "bold")
            .attr("font-size", "18px")
            .attr("text-anchor", "middle")
            .text(yField);

        // Points
        msvg.append("g")
            .selectAll("circle")
            .data(data)
            .join("circle")
            .attr("cx", d => mx(+d[xField]))
            .attr("cy", d => my(+d[yField]))
            .attr("r", 5)
            .attr("fill", d => colorScale(d[colorField]))
            .attr("opacity", 0.78);

        // Title
        msvg.append("text")
            .attr("x", modalWidth/2)
            .attr("y", 32)
            .attr("text-anchor", "middle")
            .attr("font-size", 24)
            .attr("font-weight", "bold")
            .text(`${yField} vs ${xField}`);

        // Legend
        const legendX = modalWidth - 140, legendY = 40;
        const modalLegend = msvg.append("g")
            .attr("transform", `translate(${legendX},${legendY})`);
        modalLegend.selectAll("legendEntry")
            .data(colorValues)
            .enter()
            .append("g")
            .attr("transform", (d, i) => `translate(0,${i * 26})`)
            .each(function(d, i) {
                d3.select(this).append("rect")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 16)
                    .attr("height", 16)
                    .attr("fill", colorScale(d));
                d3.select(this).append("text")
                    .attr("x", 26)
                    .attr("y", 13)
                    .attr("font-size", "15px")
                    .text(d);
            });
    }
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
        const cellSize = 32, margin = {top: 70, right: 10, bottom: 200, left: 120};
        const width = colVals.length * cellSize + margin.left + margin.right;
        const height = rowVals.length * cellSize + margin.top + margin.bottom;
        
        d3.select("#heatmap").selectAll("*").remove();

        const svg = d3.select("#heatmap").append("svg")
            .attr("width", width)
            .attr("height", height);

        // Color scale (domain based on agg function)
        const flat = matrix.flat().filter(x => x !== null && !isNaN(x));
        let color, colorInterp, cmin, cmax, colorTitle;
        if (agg === "count") {
            cmin = 0;
            cmax = d3.max(flat);
            colorInterp = d3.interpolateBlues;
            color = d3.scaleSequential(colorInterp).domain([cmin, cmax]);
            colorTitle = "Count";
        } else {
            cmin = d3.min(flat);
            cmax = d3.max(flat);
            colorInterp = d3.interpolateYlGnBu;
            color = d3.scaleSequential(colorInterp).domain([cmin, cmax]);
            colorTitle = agg === "median" ? `Median ${valueAttr}` : `Mean ${valueAttr}`;
        }

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

        // Col labels (moved below the heatmap)
        svg.append("g").attr("transform", `translate(${margin.left},${margin.top + rowVals.length * cellSize + 10})`)
            .selectAll("text")
            .data(colVals)
            .join("text")
            .attr("x", (_, j) => j * cellSize + cellSize / 2)
            .attr("y", 0)
            .attr("text-anchor", "start")
            .attr("transform", (_, j) => `rotate(45,${j * cellSize + cellSize / 2},0)`)
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

        // === Colorbar legend ===
        const legendBarWidth = Math.max(180, Math.min(350, colVals.length * cellSize));
        const legendBarHeight = 14;
        const legendSteps = 64;
        const legendX = margin.left;
        const legendY = height - 60;

        // Colorbar gradient
        const defs = svg.append("defs");
        const gradientId = "heatmap-color-gradient";
        const grad = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");
        for (let i = 0; i <= legendSteps; i++) {
            grad.append("stop")
                .attr("offset", `${(i/legendSteps)*100}%`)
                .attr("stop-color", color(cmin + (cmax-cmin)*i/legendSteps));
        }

        // Draw colorbar rect
        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", legendBarWidth)
            .attr("height", legendBarHeight)
            .style("fill", `url(#${gradientId})`)
            .attr("stroke", "#aaa");

        // Legend min, max labels
        svg.append("text")
            .attr("x", legendX)
            .attr("y", legendY + legendBarHeight + 17)
            .attr("font-size", 12)
            .attr("text-anchor", "middle")
            .attr("fill", "#555")
            .text(agg === "count" ? 0 : cmin.toFixed(2));
        svg.append("text")
            .attr("x", legendX + legendBarWidth)
            .attr("y", legendY + legendBarHeight + 17)
            .attr("font-size", 12)
            .attr("text-anchor", "middle")
            .attr("fill", "#555")
            .text(agg === "count" ? cmax : cmax.toFixed(2));
        // Legend title
        svg.append("text")
            .attr("x", legendX + legendBarWidth / 2)
            .attr("y", legendY - 8)
            .attr("font-size", 13)
            .attr("font-weight", "bold")
            .attr("text-anchor", "middle")
            .text(colorTitle);

    } // End drawHeatmap

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

    // Tooltip setup
    d3.select("#boxplot-tooltip").remove();
    const tooltip = d3.select("body").append("div")
        .attr("id", "boxplot-tooltip")
        .style("position", "absolute")
        .style("background", "#fff")
        .style("border", "1px solid #aaa")
        .style("padding", "6px 12px")
        .style("border-radius", "6px")
        .style("box-shadow", "0 2px 8px rgba(0,0,0,0.13)")
        .style("pointer-events", "none")
        .style("font-size", "13px")
        .style("visibility", "hidden");

    // X Axis
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("font-size", 14)
        .attr("text-anchor", "end")
        .attr("dx", "-0.6em")
        .attr("dy", "0.3em")
        .attr("transform", "rotate(35)");

    // Y Axis
    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .selectAll("text")
        .attr("font-size", 14);

    // Boxes (Q1 to Q3)
    svg.selectAll("rect.box")
        .data(grouped)
        .enter().append("rect")
        .attr("class", "box")
        .attr("x", d => x(d.key))
        .attr("y", d => y(d.q3))
        .attr("width", x.bandwidth())
        .attr("height", d => y(d.q1) - y(d.q3))
        .attr("fill", "#a6cee3")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#1f78b4").attr("stroke-width", 2);
            tooltip.html(
                `<strong>${catCol}: ${d.key}</strong><br>
                Q1: <b>${d.q1.toFixed(2)}</b><br>
                Q3: <b>${d.q3.toFixed(2)}</b>`
            ).style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 40) + "px")
                   .style("left", (event.pageX + 12) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", null);
            tooltip.style("visibility", "hidden");
        });

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
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#d62728");
            tooltip.html(
                `<strong>${catCol}: ${d.key}</strong><br>
                Median: <b>${d.median.toFixed(2)}</b>`
            ).style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 40) + "px")
                   .style("left", (event.pageX + 12) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#1f78b4");
            tooltip.style("visibility", "hidden");
        });

    // Whiskers (min to Q1)
    svg.selectAll("line.min")
        .data(grouped)
        .enter().append("line")
        .attr("class", "min-whisker")
        .attr("x1", d => x(d.key) + x.bandwidth()/2)
        .attr("x2", d => x(d.key) + x.bandwidth()/2)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.q1))
        .attr("stroke", "black")
        .attr("stroke-width", 1.2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#d62728");
            tooltip.html(
                `<strong>${catCol}: ${d.key}</strong><br>
                Min: <b>${d.min.toFixed(2)}</b>`
            ).style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 40) + "px")
                   .style("left", (event.pageX + 12) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "black");
            tooltip.style("visibility", "hidden");
        });

    // Whiskers (Q3 to max)
    svg.selectAll("line.max")
        .data(grouped)
        .enter().append("line")
        .attr("class", "max-whisker")
        .attr("x1", d => x(d.key) + x.bandwidth()/2)
        .attr("x2", d => x(d.key) + x.bandwidth()/2)
        .attr("y1", d => y(d.q3))
        .attr("y2", d => y(d.max))
        .attr("stroke", "black")
        .attr("stroke-width", 1.2)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#d62728");
            tooltip.html(
                `<strong>${catCol}: ${d.key}</strong><br>
                Max: <b>${d.max.toFixed(2)}</b>`
            ).style("visibility", "visible");
        })
        .on("mousemove", function(event) {
            tooltip.style("top", (event.pageY - 40) + "px")
                   .style("left", (event.pageX + 12) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "black");
            tooltip.style("visibility", "hidden");
        });

    // Title
    svg.append("text")
        .attr("x", width/2)
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .attr("font-size", 20)
        .attr("font-weight", "bold")
        .text(`${numCol} by ${catCol}`);
}

