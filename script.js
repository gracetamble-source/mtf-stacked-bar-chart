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
  Tier_0_1_Percent: "#d73027",
  Tier_2_Percent: "#f46d43",
  Tier_3_Percent: "#f2cf63",
  Tier_4_Percent: "#8fd05a",
  Tier_5_Percent: "#1f9448"
};

let rows = [];
let years = [];
let selectedYear;
let selectedCountries = [];

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
  const rawValues = tierColumns.map(column => +d[column] || 0);
  const total = d3.sum(rawValues);
  const hasFractionValues = d3.max(rawValues) <= 1 && total <= 1.05;

  if (hasFractionValues) {
    return rawValues.map(value => value * 100);
  }

  if (total > 101) {
    return rawValues.map(value => (value / total) * 100);
  }

  return rawValues;
}

function buildCountryOptions() {
  const availableKeys = new Set(rows
    .filter(d => d.year === selectedYear)
    .map(d => d.countryKey));

  const countries = rows
    .filter(d => availableKeys.has(d.countryKey))
    .filter((d, index, array) => array.findIndex(item => item.countryKey === d.countryKey) === index);

  const select = d3.select("#country-select");
  const options = select.selectAll("option.country-option")
    .data(countries, d => d.countryKey);

  options.exit().remove();

  options.enter()
    .append("option")
    .attr("class", "country-option")
    .merge(options)
    .attr("value", d => d.countryKey)
    .property("disabled", d => selectedCountries.includes(d.countryKey))
    .text(d => d.countryName);

  select.property("value", "");
  select.property("disabled", selectedCountries.length >= maxCountries);
}

function renderLegend() {
  const legendItems = d3.select("#tier-legend")
    .selectAll(".legend-item")
    .data(tierColumns);

  const enter = legendItems.enter()
    .append("div")
    .attr("class", "legend-item");

  enter.append("span")
    .attr("class", "legend-swatch");

  enter.append("span");

  legendItems.merge(enter)
    .select(".legend-swatch")
    .style("background", d => tierColors[d]);

  legendItems.merge(enter)
    .select("span:last-child")
    .text(d => tierLabels[d]);
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
        .tickValues([0, 25, 50, 75, 100])
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
    .value((d, key) => d.tiers[key])(chartData);

  g.selectAll("g.layer")
    .data(stackedData)
    .join("g")
    .attr("class", "layer")
    .attr("fill", d => tierColors[d.key])
    .selectAll("rect")
    .data(d => d.map(value => ({ ...value, key: d.key })))
    .join("rect")
    .attr("class", "tier-segment")
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

  d3.select("#chart-subtitle").text(`Latest year available: ${d3.max(years)}`);
  renderSelectedCountries();
  buildCountryOptions();
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

  d3.select("#country-select")
    .on("change", event => {
      const countryKey = event.target.value;

      if (!countryKey) return;

      if (selectedCountries.length >= maxCountries) {
        updateStatusText();
        event.target.value = "";
        return;
      }

      if (!selectedCountries.includes(countryKey)) {
        selectedCountries = [...selectedCountries, countryKey];
      }

      update();
    });

  renderLegend();
  update();
}).catch(error => {
  d3.select(".chart-stage").html(`<p class="helper-text">Unable to load ${dataFile}.</p>`);
  console.error(error);
});
