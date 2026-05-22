const svg = d3.select("svg"),
      margin = {top: 130, right: 40, bottom: 30, left: 170},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom;

const g = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const tooltip = d3.select(".tooltip");

const keys = [
  "Tier_0_1_Percent",
  "Tier_2_Percent",
  "Tier_3_Percent",
  "Tier_4_Percent",
  "Tier_5_Percent"
];

const labels = {
  Tier_0_1_Percent: "Tier 0/1",
  Tier_2_Percent: "Tier 2",
  Tier_3_Percent: "Tier 3",
  Tier_4_Percent: "Tier 4",
  Tier_5_Percent: "Tier 5"
};

const colors = {
  Tier_0_1_Percent: "#d73027",
  Tier_2_Percent: "#f46d43",
  Tier_3_Percent: "#fdd96a",
  Tier_4_Percent: "#9bd765",
  Tier_5_Percent: "#2f944f"
};

d3.csv("stacked_bar_2023.csv").then(data => {

  data.forEach(d => {
    keys.forEach(k => d[k] = +d[k]);
  });

  const stackedData = d3.stack()
    .keys(keys)(data);

  const y = d3.scaleBand()
    .domain(data.map(d => d.country_name))
    .range([0, height])
    .padding(0.08);

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([0, width]);

  // Legend
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${margin.left}, 35)`);

  const legendItemWidth = 100;

  keys.forEach((key, i) => {
    const item = legend.append("g")
      .attr("transform", `translate(${i * legendItemWidth}, 0)`);

    item.append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", colors[key]);

    item.append("text")
      .attr("x", 28)
      .attr("y", 14)
      .text(labels[key]);
  });

  // Axis label
  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", margin.left)
    .attr("y", 78)
    .text("% of population");

  // Top axis
  g.append("g")
    .attr("class", "axis x-axis")
    .call(
      d3.axisTop(x)
        .tickValues([0, 0.25, 0.5, 0.75, 1])
        .tickFormat(d3.format(".0%"))
        .tickSize(14)
    );

  // Country labels
  g.append("g")
    .attr("class", "axis y-axis")
    .call(d3.axisLeft(y).tickSize(0))
    .selectAll("text")
    .attr("class", "country-label")
    .attr("dx", "-0.5em");

  // Bars
  g.selectAll("g.layer")
    .data(stackedData)
    .join("g")
    .attr("fill", d => colors[d.key])
    .selectAll("rect")
    .data(d => d.map(v => ({...v, key: d.key})))
    .join("rect")
    .attr("class", "tier-segment")
    .attr("y", d => y(d.data.country_name))
    .attr("x", d => x(d[0]))
    .attr("width", d => x(d[1]) - x(d[0]))
    .attr("height", y.bandwidth())
    .on("mouseover", function(event, d) {
      const value = d[1] - d[0];

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.data.country_name}</strong><br>
          ${labels[d.key]}: ${d3.format(".1%")(value)}
        `);
    })
    .on("mousemove", function(event) {
      tooltip
        .style("left", (event.pageX + 12) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
    });

});