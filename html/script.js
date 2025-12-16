const width = 2000;
const height = 700;
const defaultYear = 2022;
let primaryCountry = null;
let comparisonCountries = [];

const countryAliases = new Map([ //[GeoJSON name, csv name]
    ["United States of America", "United States"],
    ["Russia", "Russian Federation"],
    ["Vietnam", "Viet Nam"],
    ["Laos", "Lao PDR"],
    ["Taiwan", "China"],
    ["South Korea", "Korea, Rep."],
    ["North Korea", "Korea, Dem. People's Rep."],
    ["Egypt", "Egypt, Arab Rep."],
    ["Venezuela", "Venezuela, RB"],
    ["Bahamas", "Bahamas, The"],
    ["Gambia", "Gambia, The"],
    ["Democratic Republic of the Congo", "Congo, Dem. Rep."],
    ["Republic of the Congo", "Congo, Rep."],
    ["Iran", "Iran (Islamic Republic of)"],
    ["Dominican Rep.", "Dominican Republic"],
    ["Puerto Rico" , "Puerto Rico (US)"],
    ["Côte d'Ivoire" , "Cote d'Ivoire"],
    ["Central African Rep.", "Central African Republic"],
    ["Eq. Guinea", "Equatorial Guinea"],
    ["Congo", "Congo, Rep."],
    ["Dem. Rep. Congo", "Congo, Dem. Rep."],
    ["S. Sudan", "South Sudan"],
    ["Turkey", "Turkiye"],
    ["Iran", "Iran, Islamic Rep."],
    ["Kyrgyzstan", "Kyrgyz Republic"],
    ["Yemen", "Yemen, Rep."],
    ["Somaliland", "Somalia, Fed. Rep."],
    ["Somalia", "Somalia, Fed. Rep."],
    ["Solomon Is.", "Solomon Islands"],
    ["Slovakia", "Slovak Republic"],
    ["Bosnia and Herz.", "Bosnia and Herzegovina"],
    ["Macedonia", "North Macedonia"],
    ["Syria", "Syrian Arab Republic"]
]);


// =====================
// SVG & PROJECTION
// =====================
const projection = d3.geoMercator()
    .scale(180)
    .center([0, 20])
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

const svg = d3.select("#map-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const gMap = svg.append("g");      // zoomed map
const gLegend = svg.append("g");   // fixed legend

// =====================
// LEGEND SVG (HTML-BASED)
// =====================
const legendWidth = 300;
const legendHeight = 12;

const legendSvg = d3.select("#legend-svg")
    .attr("width", legendWidth + 40)
    .attr("height", 40);

const legendGroup = legendSvg.append("g")
    .attr("transform", "translate(20, 10)");

const legendScale = d3.scaleLinear()
    .range([0, legendWidth]);

const legendAxisGroup = legendGroup
    .append("g")
    .attr("transform", `translate(0, ${legendHeight})`);

const legendImage = legendGroup.append("image")
    .attr("width", legendWidth)
    .attr("height", legendHeight)
    .attr("preserveAspectRatio", "none");

// =====================
// ANIMATION STATE
// =====================
let animationTimer = null;
let isAnimating = false;

// =====================
// ZOOM
// =====================
const zoom = d3.zoom()
    .scaleExtent([1, 8])                 // min & max zoom
    .extent([[0, 0], [width, height]])   // visible area
    .translateExtent([[0, 0], [width, height]]) // pan limits
    .on("zoom", (event) => {
        gMap.attr("transform", event.transform);
        gMap.attr("stroke-width", 0.5 / event.transform.k);
    });

svg.call(zoom);



// =====================
// COLOR SCALE
// =====================
const colorScale = d3.scaleSequential(d3.interpolateRdYlGn);


// =====================
// DATA STORAGE
// =====================
let lifeExpectancyData = new Map();   // ISO-A3 → series
let currentYearData = new Map();      // ISO-A3 → value
let idToIso3 = new Map();             // numeric → ISO-A3
let geoFeatures;

// =====================
// DATA PROCESSING
// =====================
function processData(csvData) {
    const map = new Map();

    csvData.forEach(row => {
        const name = row["Country Name"]?.trim();
        if (!name) return;

        const series = [];
        for (let year = 1960; year <= 2023; year++) {
            const v = +row[year];
            if (!isNaN(v)) series.push({ year, value: v });
        }

        if (series.length > 0) {
            map.set(name, {
                name,
                series
            });
        }
    });

    return map;
}


// =====================
// MAP UPDATE
// =====================
function updateMap(year) {
    d3.select("#year-label").text(`Year: ${year}`);

    // Collect values for color scale
    const values = [];

    lifeExpectancyData.forEach(d => {
        const point = d.series.find(p => p.year === year);
        if (point && point.value > 0) {
            values.push(point.value);
        }
    });

    if (values.length > 0) {
        colorScale.domain(d3.extent(values));
    }
    // ===== Update legend =====
    legendScale.domain(colorScale.domain());

    const canvas = document.createElement("canvas");
    canvas.width = legendWidth;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");

    for (let i = 0; i < legendWidth; i++) {
        ctx.fillStyle = colorScale(legendScale.invert(i));
        ctx.fillRect(i, 0, 1, 1);
    }

    legendImage.attr("href", canvas.toDataURL());

    legendAxisGroup.call(
        d3.axisBottom(legendScale)
            .ticks(5)
    );

    // --- TEMPORARY DIAGNOSTIC BLOCK ---
    geoFeatures.forEach(d => {
        const rawName = d.properties.name;
        const name = countryAliases.get(rawName) || rawName;
        const data = lifeExpectancyData.get(name);
        
        // Only log failures for names that look like Vietnam
        if (rawName && rawName.includes("Viet") && !data) {
             console.error(`DIAGNOSTIC: Failed to find data for: "${rawName}"`);
             console.log(`- Mapped name used for lookup: "${name}"`);
             console.log(`- GeoJSON Name Character Codes:`, Array.from(rawName).map(c => c.charCodeAt(0)));
             console.log(`- Data Map Keys:`, Array.from(lifeExpectancyData.keys()).filter(k => k.includes("Viet")));
        }
    });
    // ------------------------------------

    gMap.selectAll("path")
    .transition()
    .duration(500)
    .attr("fill", d => {
        const rawName = d.properties.name;
        const name = countryAliases.get(rawName) || rawName;
        const data = lifeExpectancyData.get(name);
        const point = data?.series.find(p => p.year === year);

        return (point && point.value > 0)
            ? colorScale(point.value)
            : "#ccc";
    })

    .attr("stroke-dasharray", d => {
        const rawName = d.properties.name;
        const name = countryAliases.get(rawName) || rawName;
        return lifeExpectancyData.has(name) ? null : "2,2";
    })
    .attr("opacity", d => {
        const rawName = d.properties.name;
        const name = countryAliases.get(rawName) || rawName;
        return lifeExpectancyData.has(name) ? 1 : 0.5;
    })
    .selection()   // ⬅ REQUIRED
    .select("title")
    .text(d => {
        const rawName = d.properties.name;
        const name = countryAliases.get(rawName) || rawName;
        const data = lifeExpectancyData.get(name);
        const point = data?.series.find(p => p.year === year);

        return `${name}
Life Expectancy (${year}): ${point ? point.value.toFixed(2) : "N/A"}`;
    });
}


// =====================
//animate year
// =====================
function animateYears(fromYear, toYear, interval = 800) {
    // Stop existing animation if any
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
    }

    isAnimating = true;

    let currentYear = fromYear;

    // Sync slider immediately
    d3.select("#time-slider").property("value", currentYear);
    updateMap(currentYear);

    animationTimer = setInterval(() => {
        if (currentYear > toYear) {
            clearInterval(animationTimer);
            animationTimer = null;
            isAnimating = false;
            return;
        }

        updateMap(currentYear);
        d3.select("#time-slider").property("value", currentYear);

        currentYear++;
    }, interval);
}

// =====================
// open close chart
// =====================
function openChartModal(country) {
    d3.select("#modal-title").text(`Analysis: ${country}`);
    d3.select("#chart-modal").classed("hidden", false);

    populateCountryDropdown();
    updateSelectedCountriesUI();
}

function closeChartModal() {
    d3.select("#chart-modal").classed("hidden", true);
    d3.select("#chart-svg").selectAll("*").remove();
}

function populateCountryDropdown() {
    const select = d3.select("#compare-country");
    select.selectAll("option").remove();

    lifeExpectancyData.forEach((_, name) => {
        select.append("option").text(name).attr("value", name);
    });
}

d3.select("#add-country").on("click", () => {
    const c = d3.select("#compare-country").property("value");
    if (!comparisonCountries.includes(c) && c !== primaryCountry) {
        comparisonCountries.push(c);
        updateSelectedCountriesUI();
    }
});

function updateSelectedCountriesUI() {
    const div = d3.select("#selected-countries");
    div.selectAll("*").remove();

    comparisonCountries.forEach(c => {
        div.append("span").text(c);
    });
}

// =====================
// DRAW CHARTS IN MODAL
// =====================
function drawLineChartModal(primary, comparisons = []) {
    const countries = [primary, ...comparisons]
        .filter(c => lifeExpectancyData.has(c));

    if (countries.length === 0) return;

    const margin = { top: 40, right: 120, bottom: 40, left: 60 };
    const width = 750 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const allSeries = countries.flatMap(c => lifeExpectancyData.get(c).series);

    const x = d3.scaleLinear()
        .domain(d3.extent(allSeries, d => d.year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain(d3.extent(allSeries, d => d.value))
        .nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(countries)
        .range(d3.schemeTableau10);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    g.append("g")
        .call(d3.axisLeft(y));

    const line = d3.line()
        .x(d => x(d.year))
        .y(d => y(d.value));

    countries.forEach(country => {
        g.append("path")
            .datum(lifeExpectancyData.get(country).series)
            .attr("fill", "none")
            .attr("stroke", color(country))
            .attr("stroke-width", 2)
            .attr("d", line);
    });

    // Legend
    const legend = g.append("g")
        .attr("transform", `translate(${width + 20},0)`);

    countries.forEach((c, i) => {
        const row = legend.append("g")
            .attr("transform", `translate(0,${i * 20})`);

        row.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(c));

        row.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .text(c);
    });

    g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text("Life Expectancy Trend");
}
function drawBarChartModal(primary, comparisons = []) {
    const year = +d3.select("#time-slider").property("value");
    const countries = [primary, ...comparisons]
        .filter(c => lifeExpectancyData.has(c));

    const data = countries.map(c => {
        const p = lifeExpectancyData.get(c).series.find(d => d.year === year);
        return { country: c, value: p ? p.value : null };
    }).filter(d => d.value !== null);

    if (data.length === 0) return;

    const margin = { top: 40, right: 20, bottom: 80, left: 60 };
    const width = 700 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.country))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value)])
        .nice()
        .range([height, 0]);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");

    g.append("g")
        .call(d3.axisLeft(y));

    g.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.country))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value))
        .attr("fill", "#4daf4a");

    g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text(`Life Expectancy Comparison (${year})`);
}
function drawBoxPlotModal(primary, comparisons = []) {
    const countries = [primary, ...comparisons]
        .filter(c => lifeExpectancyData.has(c));

    if (countries.length === 0) return;

    const stats = countries.map(c => {
        const values = lifeExpectancyData.get(c).series
            .map(d => d.value)
            .sort(d3.ascending);

        return {
            country: c,
            min: d3.min(values),
            q1: d3.quantile(values, 0.25),
            median: d3.quantile(values, 0.5),
            q3: d3.quantile(values, 0.75),
            max: d3.max(values)
        };
    });

    const margin = { top: 40, right: 20, bottom: 80, left: 60 };
    const width = 700 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3.select("#chart-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(countries)
        .range([0, width])
        .padding(0.4);

    const y = d3.scaleLinear()
        .domain([
            d3.min(stats, d => d.min),
            d3.max(stats, d => d.max)
        ])
        .nice()
        .range([height, 0]);

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-40)")
        .style("text-anchor", "end");

    g.append("g")
        .call(d3.axisLeft(y));

    const boxWidth = x.bandwidth();

    stats.forEach(d => {
        const cx = x(d.country) + boxWidth / 2;

        // whiskers
        g.append("line")
            .attr("x1", cx).attr("x2", cx)
            .attr("y1", y(d.min)).attr("y2", y(d.max))
            .attr("stroke", "black");

        // box
        g.append("rect")
            .attr("x", x(d.country))
            .attr("y", y(d.q3))
            .attr("width", boxWidth)
            .attr("height", y(d.q1) - y(d.q3))
            .attr("fill", "#80b1d3")
            .attr("stroke", "black");

        // median
        g.append("line")
            .attr("x1", x(d.country))
            .attr("x2", x(d.country) + boxWidth)
            .attr("y1", y(d.median))
            .attr("y2", y(d.median))
            .attr("stroke", "black");
    });

    g.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text("Life Expectancy Distribution (All Years)");
}






// =====================
// INITIALIZE
// =====================
async function initialize() {
    const [world, csvData, countryCodes] = await Promise.all([
        d3.json("../datasets/countries-110m.json"),
        d3.csv("../datasets/global_life_expectancy.csv"),
        d3.tsv("../datasets/countries.tsv")
    ]);

    console.log("World loaded:", world);
    console.log("CSV rows:", csvData.length);
    console.log("Country codes:", countryCodes.length);

    // Build numeric → ISO-A3 lookup
    idToIso3 = new Map(countryCodes.map(d => [d.iso_n3, d.iso_a3]));

    // Process CSV
    lifeExpectancyData = processData(csvData);

    // Convert TopoJSON → GeoJSON
    geoFeatures = topojson.feature(
        world,
        world.objects.countries
    ).features;

    // Draw map
    gMap.selectAll("path")
        .data(geoFeatures)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", "#ccc")
        .attr("stroke", "#666")
        .on("click", (event, d) => {
            const rawName = d.properties.name;
            const name = countryAliases.get(rawName) || rawName;

            if (!lifeExpectancyData.has(name)) return;

            primaryCountry = name;
            comparisonCountries = [];

            openChartModal(name);
        })
        .append("title");



    // Lock initial view (centered, no pan)
    svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(0, 0).scale(1)
    );


    // Slider setup
    const slider = d3.select("#time-slider")
        .attr("min", 1960)
        .attr("max", 2023)
        .attr("value", defaultYear)
        .on("input", event => {
            if (animationTimer) {
                clearInterval(animationTimer);
                animationTimer = null;
                isAnimating = false;
            }
            updateMap(+event.target.value);
        });

    updateMap(defaultYear);
    // =====================
    // Animate button handler
    // =====================
    d3.select("#animate-btn").on("click", () => {
        const fromYear = +d3.select("#from-year").property("value");
        const toYear = +d3.select("#to-year").property("value");

        if (isNaN(fromYear) || isNaN(toYear)) {
            alert("Please enter valid years.");
            return;
        }

        if (fromYear < 1960 || toYear > 2023) {
            alert("Year must be between 1960 and 2023.");
            return;
        }

        if (fromYear > toYear) {
            alert("'From' year must be less than or equal to 'To' year.");
            return;
        }

        animateYears(fromYear, toYear, 100);
    });

    // =====================
    // Close modal handler
    // =====================
    d3.select("#close-modal").on("click", closeChartModal);

    d3.select("#finalize-chart").on("click", () => {
        const type = d3.select("#chart-type").property("value");

        const svg = d3.select("#chart-svg");
        svg.selectAll("*").remove();

        if (type === "line") {
            drawLineChartModal(primaryCountry, comparisonCountries);
        }else if (type === "bar") {
            drawBarChartModal(primaryCountry, comparisonCountries);
        } else if (type === "box") {
            drawBoxPlotModal(primaryCountry, comparisonCountries);
        }
    });



}

initialize();
