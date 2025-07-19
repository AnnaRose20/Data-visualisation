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
    const width = 1000, height = 800;
    const margin = {top: 40, right: 40, bottom: 40, left: -10},
          w = width - margin.left - margin.right,
          h = height - margin.top - margin.bottom;

    const svg = d3.select("#chart1")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

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
    axisG.append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("font-size", "14px")
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
    
    const colorBy = d3.select("#splomColor").property("value") || categorical[0];
    const colorValues = Array.from(new Set(data.map(d => d[colorBy])));
    const colorScale = d3.scaleOrdinal()
        .domain(colorValues)
        .range(d3.schemeCategory10);

    // --- Layout
    const n = numerical.length;
    const maxCanvas = 700;
    const size = Math.max(70, Math.min(110, Math.floor(maxCanvas / n))); // not too tiny

    const padding = 18;
    const legendBoxSize = 22;
    const legendWidth = 130;

    const svg = d3.select("#chart2")
        .append("svg")
        .attr("width", size * n + padding * 3 + legendWidth)
        .attr("height", size * n + padding * 3);

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
                    .attr("x", -6)
                    .attr("y", size/2)
                    .attr("text-anchor", "end")
                    .attr("font-size", "11px")
                    .attr("fill", "#555")
                    .attr("transform", `rotate(-90,-6,${size/2})`)
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
// 3. SUNBURST (CATEGORICAL TREE)  //
//////////////////////////////////////

function createChart3(data) {
    // 1. Find categorical columns (with ≤20 unique values, no id-like cols)
    const maxLevels = 4, maxUniques = 20;
    const allKeys = Object.keys(data[0]);
    const cats = allKeys.filter(col => {
        const unique = new Set(data.map(d => d[col])).size;
        return unique > 1 && unique <= maxUniques && !col.match(/id/i);
    });

    // Remove existing controls and chart SVG
    d3.select("#chart3-controls").selectAll("*").remove();
    d3.select("#chart3").selectAll("*").remove();

    // If not enough categories, show a message and exit.
    if (cats.length < 2) {
        d3.select("#chart3").append("div").text("Not enough categorical columns for sunburst!");
        return;
    }

    // --- Controls container OUTSIDE the SVG
    function addDropdown(id, label, defaultVal) {
        d3.select("#chart3-controls")
            .append("label")
            .attr("for", id)
            .style("margin-right", "3px")
            .text(label);
        d3.select("#chart3-controls")
            .append("select")
            .attr("id", id)
            .style("margin-right", "12px")
            .selectAll("option")
            .data([""].concat(cats))
            .enter()
            .append("option")
            .attr("value", d => d)
            .text(d => d ? d : "None");
        d3.select(`#${id}`).property("value", defaultVal);
    }

    // Four dropdowns for hierarchy levels
    addDropdown("sunburst-level-1", "Level 1:", cats[0]);
    addDropdown("sunburst-level-2", "Level 2:", cats[1]);
    addDropdown("sunburst-level-3", "Level 3:", cats[2]);
    addDropdown("sunburst-level-4", "Level 4:", cats[3]);

    function getLevels() {
        return [
            d3.select("#sunburst-level-1").property("value"),
            d3.select("#sunburst-level-2").property("value"),
            d3.select("#sunburst-level-3").property("value"),
            d3.select("#sunburst-level-4").property("value"),
        ].filter(d => d);
    }

    function drawSunburst() {
        d3.select("#chart3").selectAll("*").remove();

        const levels = getLevels();
        if (levels.length < 2) {
            d3.select("#chart3").append("div").text("Select at least 2 categorical columns for the sunburst!");
            return;
        }

        // Convert data to hierarchy
        function nestData(rows, levels) {
            if (!levels.length) return rows.length;
            const [level, ...rest] = levels;
            return Array.from(d3.group(rows, d => d[level]), ([k, v]) => ({
                name: k,
                children: nestData(v, rest)
            }));
        }
        const rootData = { name: "root", children: nestData(data, levels) };

        const width = 500, radius = width / 2;

        const partition = data => d3.partition()
            .size([2 * Math.PI, radius])
            (d3.hierarchy(data)
            .sum(d => d.value || (d.children ? 0 : 1)));

        const root = partition(rootData);
        root.each(d => d.current = d);

        // Rainbow palette
        const color = d3.scaleOrdinal()
            .domain(root.children.map(d => d.data.name))
            .range(d3.quantize(t => d3.interpolateRainbow(t * 0.8 + 0.1), root.children.length + 1));

        const svg = d3.select("#chart3")
            .append("svg")
            .attr("width", width)
            .attr("height", width)
            .attr("viewBox", [0, 0, width, width])
            .style("font", "12px sans-serif")
            .style("display", "block");

        const g = svg.append("g")
            .attr("transform", `translate(${width / 2},${width / 2})`);

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .innerRadius(d => d.y0)
            .outerRadius(d => d.y1 - 1);

        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("id", "chart3-tooltip")
            .style("position", "absolute")
            .style("z-index", 10)
            .style("visibility", "hidden")
            .style("background", "#fff")
            .style("border", "1px solid #aaa")
            .style("padding", "5px 10px")
            .style("border-radius", "6px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.13)");

        // Draw arcs
        const path = g.append("g")
            .selectAll("path")
            .data(root.descendants().filter(d => d.depth))
            .join("path")
            .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
            .attr("d", arc)
            .on("mouseover", function(event, d) {
                d3.select(this).attr("stroke", "#222");
                tooltip.html(
                    `<strong>${d.ancestors().map(d => d.data.name).reverse().slice(1).join(" / ")}</strong><br>Count: ${d.value}`
                ).style("visibility", "visible");
            })
            .on("mousemove", function(event) {
                tooltip.style("top", (event.pageY - 40) + "px")
                    .style("left", (event.pageX + 12) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke", null);
                tooltip.style("visibility", "hidden");
            })
            .on("click", clicked);

        // Draw labels on arcs
        const label = g.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants().filter(d => d.depth))
            .join("text")
            .attr("transform", d => labelTransform(d, radius))
            .attr("display", d => labelVisible(d) ? null : "none")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .text(d => d.data.name);

        // Center label for zoom out
        g.append("text")
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-weight", "bold")
            .attr("font-size", 16)
            .style("pointer-events", "auto")
            .style("cursor", "pointer")
            .text("Zoom out")
            .on("click", (event) => clicked(event, root));

        // Zoom transition
        function clicked(event, p) {
            root.each(d => d.target = {
                x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
                y0: Math.max(0, d.y0 - p.y0),
                y1: Math.max(0, d.y1 - p.y0)
            });

            const t = g.transition().duration(750);

            path.transition(t)
                .tween("data", d => {
                    const i = d3.interpolate(d.current, d.target);
                    return t => d.current = i(t);
                })
                .attrTween("d", d => () => arc(d.current));

            label.transition(t)
                .attr("display", d => labelVisible(d.target) ? null : "none")
                .attrTween("transform", d => () => labelTransform(d.current, radius));
        }

        function labelVisible(d) {
            return d.y1 <= radius && d.y0 >= 0 && (d.x1 - d.x0) > 0.03;
        }
        function labelTransform(d, radius) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        }
    }

    // Draw once at load, and whenever any dropdown changes
    drawSunburst();
    d3.selectAll("#chart3-controls select").on("change", drawSunburst);
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

    const x = d3.scaleBand().domain(grouped.map(d => d.key)).range([40, width-20]).padding(0.2);
    const y = d3.scaleLinear().domain([
        d3.min(grouped, d => d.min), d3.max(grouped, d => d.max)
    ]).nice().range([height-30, 10]);

    const svg = d3.select("#chart4")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height-30})`)
        .call(d3.axisBottom(x));
    svg.append("g")
        .attr("transform", `translate(40,0)`)
        .call(d3.axisLeft(y));

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
}
