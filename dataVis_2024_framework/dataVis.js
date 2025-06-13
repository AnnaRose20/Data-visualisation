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

// scatterplot axes
let xAxis, yAxis, xAxisLabel, yAxisLabel;
// radar chart axes
let radarAxes, radarAxesAngle;

let data;
let selectedIds = new Set(); // track clicked data row IDs



let dimensions = ["dimension 1", "dimension 2", "dimension 3", "dimension 4", "dimension 5", "dimension 6"];
//*HINT: the first dimension is often a label; you can simply remove the first dimension with
// dimensions.splice(0, 1);

// the visual channels we can use for the scatterplot
let channels = ["scatterX", "scatterY", "size"];

// size of the plots
let margin, width, height, radius;
// svg containers
let scatter, radar, dataTable;

// Add additional variables


function init() {
    margin = { top: 50, right: 50, bottom: 50, left: 50 };
    width = 400;
    height = 400;
    radius = Math.min(width, height) / 2 - 40;


    // Start default tab
    document.getElementById("defaultOpen").click();

    // Clear old content
    d3.select("#sp").selectAll("*").remove();
    d3.select("#radar").selectAll("*").remove();

    // Data table container
    dataTable = d3.select('#dataTable');

    // Scatterplot SVG
    scatter = d3.select("#sp").append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g");

    // Create the radar SVG with enough space
    radar = d3.select("#radar").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("background", "#fefefe") // optional
        .append("g")
        .attr("transform", `translate(${(width + margin.left + margin.right) / 2}, ${(height + margin.top + margin.bottom) / 2})`);

    // File upload handler
    const fileInput = document.getElementById("upload");

    const readFile = function () {
        clear();                // Clear existing drawings
        selectedIds.clear();    // ✅ Clear old selections

        let reader = new FileReader();
        reader.onloadend = function () {
            data = d3.csvParse(reader.result);
            data.forEach((d, i) => d._id = i); // assign unique ID

            initVis(data);         // render visuals
            CreateDataTable(data);
            initDashboard?.(null); // safe optional call
        };
        reader.readAsBinaryString(fileInput.files[0]);
    };

    fileInput.addEventListener('change', readFile);
}




function initVis(_data){

    // TODO: parse dimensions (i.e., attributes) from input file
    /*dimensions = Object.keys(_data[0]);
    dimensions.splice(0, 1);*/
    dimensions = Object.keys(_data[0]).filter(d =>
        d !== "Name" && d !== "Person ID" && d !== "_id" && !isNaN(parseFloat(_data[0][d]))
    );
    
    
    
    
    let selectedX = readMenu("scatterX") || dimensions[0];
    let selectedY = readMenu("scatterY") || dimensions[1];
    // y scalings for scatterplot
    // TODO: set y domain for each dimension
    let y = d3.scaleLinear()
    .domain(d3.extent(_data, d => +d[selectedY]))
    .range([height - margin.bottom - margin.top, margin.top]);

    // x scalings for scatter plot
    // TODO: set x domain for each dimension
    let x = d3.scaleLinear()
    .domain(d3.extent(_data, d => +d[selectedX]))
    .range([margin.left, width - margin.left - margin.right]);

    // radius scalings for radar chart
    // TODO: set radius domain for each dimension
    let r = d3.scaleLinear()
    .domain([0, d3.max(_data, d => d3.max(dimensions.map(dim => +d[dim])))])
    .range([0, radius]);

    // scatterplot axes
    yAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(" + margin.left + ")")
        .call(d3.axisLeft(y));

    yAxisLabel = yAxis.append("text")
        .style("text-anchor", "middle")
        .attr("y", margin.top / 2)
        .text("x");

    xAxis = scatter.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0, " + (height - margin.bottom - margin.top) + ")")
        .call(d3.axisBottom(x));

    xAxisLabel = xAxis.append("text")
        .style("text-anchor", "middle")
        .attr("x", width - margin.right)
        .text("y");

    // radar chart axes
    radarAxesAngle = Math.PI * 2 / dimensions.length;
    let axisRadius = d3.scaleLinear()
        .range([0, radius]);
    let maxAxisRadius = 0.75,
        textRadius = 0.8;
    gridRadius = 0.1;

    // radar axes
    radarAxes = radar.selectAll(".axis")
        .data(dimensions)
        .enter()
        .append("g")
        .attr("class", "axis");

    radarAxes.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", function(d, i){ return radarX(axisRadius(maxAxisRadius), i); })
        .attr("y2", function(d, i){ return radarY(axisRadius(maxAxisRadius), i); })
        .attr("class", "line")
        .style("stroke", "black");

    // TODO: render grid lines in gray
    let levels = 5;
    for (let i = 1; i <= levels; i++) {
        let levelFactor = radius * (i / levels);
        radar.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", levelFactor)
            .style("fill", "none")
            .style("stroke", "#ccc")
            .style("stroke-dasharray", "2,2");
    }

    // TODO: render correct axes labels
    radar.selectAll(".axisLabel")
        .data(dimensions)
        .enter()
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("x", function(d, i){ return radarX(axisRadius(textRadius), i); })
        .attr("y", function(d, i){ return radarY(axisRadius(textRadius), i); })
        .text(d => d);


    // init menu for the visual channels
    channels.forEach(function(c){
        initMenu(c, dimensions);
    });

    // refresh all select menus
    channels.forEach(function(c){
        refreshMenu(c);
    });
// Assign unique IDs to each data row for selection tracking
data = _data;
data.forEach((d, i) => {
    d._id = i;
});


    renderScatterplot();;
    renderRadarChart();
}


// clear visualizations before loading a new file
function clear(){
    scatter.selectAll("*").remove();
    radar.selectAll("*").remove();
    dataTable.selectAll("*").remove();
}

//Create Table
function CreateDataTable(_data) {
    if (!_data || !_data.length) return;

    // Clear previous table
    dataTable.selectAll("*").remove();

    // Create table and apply styles
    let table = dataTable.append("table")
        .attr("class", "data-table")
        .style("border-collapse", "collapse")
        .style("width", "100%")
        .style("font-family", "Arial, sans-serif");

    // Extract headers
    let headers = Object.keys(_data[0]);

    // Add headers
    let thead = table.append("thead");
    thead.append("tr")
        .selectAll("th")
        .data(headers)
        .enter()
        .append("th")
        .text(d => d)
        .style("border", "1px solid #91c2f7")
        .style("padding", "8px")
        .style("background-color", "#eaf3fb")
        .style("font-weight", "bold")
        .style("text-align", "left")
        .style("box-shadow", "0 2px 8px rgba(0, 0, 0, 0.1)");
    
    // Add rows and columns
    let tbody = table.append("tbody");
    let rows = tbody.selectAll("tr")
        .data(_data)
        .enter()
        .append("tr");

    rows.selectAll("td")
        .data(d => headers.map(key => d[key]))
        .enter()
        .append("td")
        .text(d => d)
        .style("border", "1px solid #dee2e6")
        .style("padding", "8px")
        // Mouseover effect
        .on("mouseover", function () {
            d3.select(this)
                .style("background-color", "#ddeff4");
            })
            .on("mouseout", function () {
            d3.select(this)
                .style("background-color", null);
            });
}




function renderScatterplot() {
    if (!data || data.length === 0) return;

    // Get selected visual dimensions from the menus
    const xDim = readMenu("scatterX");
    const yDim = readMenu("scatterY");
    const sizeDim = readMenu("size");

    // Create scales
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => +d[xDim]))
        .range([margin.left, width - margin.left - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => +d[yDim]))
        .range([height - margin.bottom - margin.top, margin.top]);

    const sizeScale = d3.scaleLinear()
        .domain(d3.extent(data, d => +d[sizeDim]))
        .range([4, 12]);

    // Update axes
    xAxis.transition().call(d3.axisBottom(x));
    yAxis.transition().call(d3.axisLeft(y));

    xAxisLabel.text(xDim);
    yAxisLabel.text(yDim);

    // Clear previous circles
    scatter.selectAll("circle").remove();

    // Tooltip div (must exist in your HTML)
    const tooltip = d3.select("#tooltip");

    // Draw circles with interactivity
    scatter.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(+d[xDim]))
        .attr("cy", d => y(+d[yDim]))
        .attr("r", d => sizeScale(+d[sizeDim]))
        .style("fill", "steelblue")
        .style("opacity", 0.7)
        .style("stroke", "black")
        .style("cursor", "pointer")
        .attr("data-id", d => d._id)
        .on("click", function(event, d) {
            if (selectedIds.has(d._id)) {
                selectedIds.delete(d._id); // Deselect
                d3.select(this).style("stroke", "black");
            } else {
                selectedIds.add(d._id); // Select
                d3.select(this).style("stroke", "orange");
            }
            renderRadarChart(); // Update radar
        })
        .on("mouseover", function(event, d) {
            const html = Object.entries(d)
                .filter(([k]) => k !== "_id")
                .map(([key, val]) => `<strong>${key}:</strong> ${val}`)
                .join("<br>");

            tooltip
                .style("display", "block")
                .html(html);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("display", "none");
        });
}


    // TODO: get domain names from menu and label x- and y-axis

    // TODO: re-render axes

    // TODO: render dots

    function renderRadarChart() {
        if (!data || !dimensions || dimensions.length === 0) return;
    
        // Clear radar chart and legend
        radar.selectAll(".radar-line").remove();
        radar.selectAll(".radar-dot").remove();
        d3.select("#legend").html("<strong>Legend:</strong>");
    
        // Find first non-numeric field for legend label
        const allKeys = Object.keys(data[0]);
        const labelField = allKeys.find(k => !dimensions.includes(k) && k !== "_id");
    
        // Scale each dimension to radius
        const axisScales = {};
        dimensions.forEach(dim => {
            const extent = d3.extent(data, d => +d[dim]);
            axisScales[dim] = d3.scaleLinear().domain(extent).range([0, radius * 0.85]);
        });
    
        const color = d3.scaleOrdinal(d3.schemeCategory10);
        const line = d3.lineRadial()
            .radius(d => d.value)
            .angle((d, i) => i * radarAxesAngle)
            .curve(d3.curveLinearClosed);
    
        let colorIndex = 0;
    
        data.forEach((d, i) => {
            if (!selectedIds.has(d._id)) return;
    
            const values = dimensions.map((dim, i) => {
                const raw = d[dim];
                const num = parseFloat(raw);
                const scaled = axisScales[dim];
                return {
                    axis: dim,
                    value: isFinite(num) ? scaled(num) : 0  // fallback to 0 if not a valid number
                };
            });
            
            
    
            // Draw polygon
            radar.append("path")
                .datum(values)
                .attr("class", "radar-line radar-id-" + d._id)
                .attr("d", line)
                .style("fill", color(colorIndex))
                .style("fill-opacity", 0.4)
                .style("stroke", color(colorIndex))
                .style("stroke-width", 2);
    
            // Dots on axes
            radar.selectAll(".radar-dot-" + d._id)
                .data(values)
                .enter()
                .append("circle")
                .attr("class", "radar-dot radar-dot-" + d._id)
                .attr("cx", (v, i) => radarX(v.value, i))
                .attr("cy", (v, i) => radarY(v.value, i))
                .attr("r", 3)
                .style("fill", color(colorIndex));
    
            // Legend entry using first column
            const label = d[labelField] || `Data ${d._id}`;
            // Create a container for the legend item
        const legendItem = d3.select("#legend")
            .append("div")
            .attr("class", "legend-item")
            .style("color", color(colorIndex))
            .style("font-weight", "bold")
            .style("margin", "4px 0")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px");

        // Label text
        legendItem.append("span")
            .text(label);

        // Remove button
        legendItem.append("span")
            .html("&times;")  // HTML for ×
            .style("cursor", "pointer")
            .style("margin-left", "6px")
            .on("click", function () {
                // Remove radar polygon and dots
                radar.selectAll(".radar-id-" + d._id).remove();
                radar.selectAll(".radar-dot-" + d._id).remove();
                // Remove from selected set and re-render
                selectedIds.delete(d._id);
                renderRadarChart();
    });

    
            colorIndex++;
        });
    }
    
    
    // TODO: show selected items in legend

    // TODO: render polylines in a unique color



function radarX(radius, index){
    return radius * Math.cos(radarAngle(index));
}

function radarY(radius, index){
    return radius * Math.sin(radarAngle(index));
}

function radarAngle(index){
    return radarAxesAngle * index - Math.PI / 2;
}

// init scatterplot select menu
function initMenu(id, entries) {
    $("select#" + id).empty();

    entries.forEach(function (d) {
        $("select#" + id).append("<option>" + d + "</option>");
    });

    $("#" + id).selectmenu({
        select: function () {
            renderScatterplot();
        }
    });
}

// refresh menu after reloading data
function refreshMenu(id){
    $( "#"+id ).selectmenu("refresh");
}

// read current scatterplot parameters
function readMenu(id){
    return $( "#" + id ).val();
}

// switches and displays the tabs
function openPage(pageName,elmnt,color) {
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablink");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].style.backgroundColor = "";
    }
    document.getElementById(pageName).style.display = "block";
    elmnt.style.backgroundColor = color;
}