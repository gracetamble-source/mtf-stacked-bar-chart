const svg = d3.select("#stacked-bar-chart");
const tooltip = d3.select(".tooltip");

const maxCountries = 10;
const dataFile = "stacked_bar_2023.csv";

const tierColumns = [
  "Tier_0_1_Percent",
  "Tier_2_Percent",
  "Tier_3_Percent",
  "Tier_4_Percent",
  "Tier_5_Percent"
];

const tierLabels = {
  Tier_0_1_Percent: "Tier 0/1",
  Tier_2_Percent: "Tier 2",
  Tier_3_Percent: "Tier 3",
  Tier_4_Percent: "Tier 4",
  Tier_5_Percent: "Tier 5"
};

const tierColors = {
  Tier_0_1_Percent: "#de2d26",
  Tier_2_Percent: "#f46d43",
  Tier_3_Percent: "#fed976",
  Tier_4_Percent: "#91cf60",
  Tier_5_Percent: "#1a9850"
};

let rows = [];
let years = [];
let selectedYear;
let selectedCountries = [];
let countrySearchTerm = "";

function inferYearFromFilename() {
  const match = dataFile.match(/(19|20)\d{2}/);
  return match ? +match[0] : new Date().getFullYear();
}

function getCountryKey(d) {
  return d.country_code || d.iso_code || d.slug || d.country_name;
}

function getCountryLabel(d) {
  return d.country_name || d.country || getCountryKey(d);
}

function getRowYear(d) {
  return +(d.year || d.Year || d.YEAR || inferYearFromFilename());
}

function normalizeTierShares(d) {
  const rawValues = tierColumns.map(column => Math.max(0, +d[column] || 0));
  const total = d3.sum(rawValues);
  const maxValue = d3.max(rawValues) || 0;
  const hasFractionValues = maxValue <= 1 && total <= 1.05;

  if (hasFractionValues) {
    return rawValues.map(value => value * 100);
  }

  if (total > 101) {
    return rawValues.map(value => (value / total) * 100);
  }

  return rawValues;
}

function renderCountryOptions() {
  const availableKeys = new Set(rows
    .filter(d => d.year === selectedYear)
    .map(d => d.countryKey));

  const isAtLimit = selectedCountries.length >= maxCountries;
  const countries = isAtLimit ? [] : rows
    .filter(d => availableKeys.has(d.countryKey))
    .filter((d, index, array) => array.findIndex(item => item.countryKey === d.countryKey) === index)
    .filter(d => !selectedCountries.includes(d.countryKey))
    .filter(d => d.countryName.toLowerCase().includes(countrySearchTerm.toLowerCase()))
    .sort((a, b) => d3.ascending(a.countryName, b.countryName))
    .slice(0, 8);

  d3.select("#country-search")
    .property("disabled", false)
    .property("value", countrySearchTerm);

  const options = d3.select("#country-results")
    .selectAll(".country-option-button")
    .data(countries, d => d.countryKey);

  options.exit().remove();

  options.enter()
    .append("button")
    .attr("type", "button")
    .attr("class", "country-option-button")
    .on("click", (event, d) => {
      event.preventDefault();
      event.stopPropagation();

      if (selectedCountries.length >= maxCountries || selectedCountries.includes(d.countryKey)) return;

      selectedCountries = [...selectedCountries, d.countryKey];
      countrySearchTerm = "";
      update();
    })
    .merge(options)
    .text(d => d.countryName);
}

function renderLegend() {
  const legendItems = d3.select("#tier-legend")
    .selectAll(".legend-item")
    .data(tierColumns);

  legendItems.exit().remove();

  const enter = legendItems.enter()
    .append("li");

  enter.append("span")
    .attr("class", "legend-swatch");

  enter.append("span");

  legendItems.merge(enter)
    .select(".legend-swatch")
    .style("background", d => tierColors[d]);

  legendItems.merge(enter)
    .select("span:last-child")
    .text(d => ({
      Tier_0_1_Percent: "Tier 0/1 (0.9 kWh)",
      Tier_2_Percent: "Tier 2 (14.6 kWh)",
      Tier_3_Percent: "Tier 3 (73 kWh)",
      Tier_4_Percent: "Tier 4 (250 kWh)",
      Tier_5_Percent: "Tier 5 (600+ kWh)"
    })[d]);
}

function renderSelectedCountries() {
  const selectedRows = selectedCountries
    .map(countryKey => rows.find(d => d.countryKey === countryKey))
    .filter(Boolean);

  const chips = d3.select("#selected-countries")
    .selectAll(".country-chip")
    .data(selectedRows, d => d.countryKey);

  chips.exit().remove();

  const enter = chips.enter()
    .append("div")
    .attr("class", "country-chip");

  enter.append("span");

  enter.append("button")
    .attr("type", "button")
    .attr("class", "remove-country")
    .attr("aria-label", d => `Remove ${d.countryName}`)
    .text("×")
    .on("click", (event, d) => {
      event.preventDefault();
      event.stopPropagation();

      selectedCountries = selectedCountries.filter(countryKey => countryKey !== d.countryKey);
      update();
    });

  chips.merge(enter)
    .select("span")
    .text(d => d.countryName);
}

function updateStatusText(missingCount = 0) {
  const status = missingCount
    ? `${missingCount} selected ${missingCount === 1 ? "country has" : "countries have"} no data for ${selectedYear}.`
    : selectedCountries.length >= maxCountries
      ? "Maximum of 10 countries selected."
      : "";

  d3.select("#selection-status").text(status);
}

function drawChart(chartData) {
  svg.selectAll("*:not(title)").remove();

  const rowHeight = 40;
  const width = 900;
  const margin = { top: 34, right: 18, bottom: 18, left: 132 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = Math.max(72, chartData.length * rowHeight);
  const height = margin.top + chartHeight + margin.bottom;

  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  if (!chartData.length) {
    svg.append("text")
      .attr("class", "no-data-message")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No data available for the selected year and countries.");
    return;
  }

  const tickValues = [0, 25, 50, 75, 100];
  const x = d3.scaleLinear()
    .domain([0, 100])
    .range([0, chartWidth]);

  const y = d3.scaleBand()
    .domain(chartData.map(d => d.countryName))
    .range([0, chartHeight])
    .padding(0.14);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  g.append("g")
    .attr("class", "axis x-axis")
    .call(
      d3.axisTop(x)
        .tickValues(tickValues)
        .tickFormat(d => `${d}%`)
        .tickSize(10)
    )
    .call(axis => axis.select(".domain").remove());

  g.append("g")
    .attr("class", "axis y-axis")
    .call(d3.axisLeft(y).tickSize(0))
    .call(axis => axis.selectAll("text")
      .attr("class", "country-label")
      .attr("dx", "-0.45em"));

  const stackedData = d3.stack()
    .keys(tierColumns)
    .value((d, key) => d.tiers[key])(chartData)
    .map(layer => layer.map(d => {
      const segment = [Math.min(d[0], d[1]), Math.max(d[0], d[1])];
      segment.key = layer.key;
      segment.data = d.data;
      return segment;
    }));

  g.selectAll("g.layer")
    .data(stackedData)
    .join("g")
    .attr("class", "layer")
    .selectAll("rect")
    .data(d => d)
    .join("rect")
    .attr("class", "tier-segment")
    .attr("fill", d => tierColors[d.key])
    .attr("x", d => x(d[0]))
    .attr("y", d => y(d.data.countryName))
    .attr("width", d => Math.max(0, x(d[1]) - x(d[0])))
    .attr("height", y.bandwidth())
    .on("mouseover", (event, d) => {
      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.data.countryName}</strong><br>
          ${tierLabels[d.key]}: ${d3.format(".1f")(d.data.tiers[d.key])}%
        `);
    })
    .on("mousemove", event => {
      tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });
}

function update() {
  const yearRows = rows.filter(d => d.year === selectedYear);
  const availableCountries = new Set(yearRows.map(d => d.countryKey));
  const missingCount = selectedCountries.filter(countryKey => !availableCountries.has(countryKey)).length;
  const chartData = selectedCountries
    .filter(countryKey => availableCountries.has(countryKey))
    .map(countryKey => yearRows.find(d => d.countryKey === countryKey))
    .filter(Boolean);

  renderSelectedCountries();
  renderCountryOptions();
  updateStatusText(missingCount);
  drawChart(chartData);
}

d3.csv(dataFile).then(data => {
  rows = data.map(d => {
    const values = normalizeTierShares(d);
    const tiers = Object.fromEntries(tierColumns.map((column, index) => [column, values[index]]));

    return {
      ...d,
      // The current stacked-bar CSV has no year column, so the year is inferred from stacked_bar_2023.csv.
      year: getRowYear(d),
      countryKey: getCountryKey(d),
      countryName: getCountryLabel(d),
      tiers
    };
  });

  years = Array.from(new Set(rows.map(d => d.year))).sort((a, b) => a - b);
  selectedYear = d3.max(years);
  selectedCountries = rows
    .filter(d => d.year === selectedYear)
    .slice(0, maxCountries)
    .map(d => d.countryKey);

  d3.select("#year-select")
    .selectAll("option")
    .data(years)
    .join("option")
    .attr("value", d => d)
    .text(d => d);

  d3.select("#year-select")
    .property("value", selectedYear)
    .on("change", event => {
      selectedYear = +event.target.value;
      update();
    });

  d3.select("#country-search")
    .on("input", event => {
      countrySearchTerm = event.target.value;
      renderCountryOptions();
    });

  renderLegend();
  update();
}).catch(error => {
  d3.select(".chart-stage").html(`<p class="helper-text">Unable to load ${dataFile}.</p>`);
  console.error(error);
});
