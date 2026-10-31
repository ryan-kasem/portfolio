import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

// Lab 4 Step 1.6: show how many projects are on screen
function updateTitle(count) {
  if (projectsTitle) {
    projectsTitle.textContent = `${count} Projects`;
  }
}

// Lab 5 Step 4: search query and selected pie wedge. Both filters live in
// module state so either one can be applied on top of the other (Step 5.4).
let query = '';
let selectedYear = null; // null means no wedge is selected

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
let colors = d3.scaleOrdinal(d3.schemeTableau10);

let svg = d3.select('#projects-pie-plot');
let legend = d3.select('.legend');

// Lab 5 Step 4.3: case-insensitive search across all project metadata
function searchProjects() {
  return projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

// Lab 5 Step 5.3: apply the year filter on top of the search results
function getVisibleProjects() {
  let searched = searchProjects();
  if (selectedYear === null) {
    return searched;
  }
  return searched.filter((project) => String(project.year) === selectedYear);
}

function renderVisibleProjects() {
  let visible = getVisibleProjects();
  renderProjects(visible, projectsContainer, 'h2');
  updateTitle(visible.length);
}

// Lab 5 Step 5.2: highlight the selected wedge and its legend entry
function updateSelection() {
  svg
    .selectAll('path')
    .attr('class', (d) => (d.data.label === selectedYear ? 'selected' : null))
    .attr('aria-pressed', (d) => d.data.label === selectedYear);

  legend
    .selectAll('li')
    .attr('class', (d) =>
      d.label === selectedYear ? 'legend-item selected' : 'legend-item',
    );
}

function toggleYear(year) {
  selectedYear = selectedYear === year ? null : year;
  updateSelection();
  renderVisibleProjects();
}

// Lab 5 Step 4.4: all plotting in one function so it can re-run on search
function renderPieChart(projectsGiven) {
  // Step 3.1: count projects per year
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => String(d.year),
  );

  let data = rolledData
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => d3.descending(a.label, b.label));

  // Step 1.4: let d3.pie() compute the start and end angles
  let sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  let arcData = sliceGenerator(data);

  // clear the old wedges and legend before drawing the new ones
  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  arcData.forEach((d, i) => {
    let label = `${d.data.label}: ${d.data.value} project${d.data.value === 1 ? '' : 's'}`;

    svg
      .append('path')
      .datum(d)
      .attr('d', arcGenerator(d))
      .attr('fill', colors(i))
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', label)
      .on('click', () => toggleYear(d.data.label))
      .on('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleYear(d.data.label);
        }
      })
      .append('title')
      .text(label);
  });

  // Step 2.2: legend built with D3
  data.forEach((d, idx) => {
    legend
      .append('li')
      .datum(d)
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => toggleYear(d.label));
  });

  updateSelection();
}

// first render on page load
renderPieChart(projects);
renderVisibleProjects();

// Lab 5 Step 4.2: search as you type
let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  let searched = searchProjects();

  // drop the year selection if the search removed every project from that year
  if (!searched.some((project) => String(project.year) === selectedYear)) {
    selectedYear = null;
  }

  // the pie shows the search results, so every year stays clickable
  renderPieChart(searched);
  renderVisibleProjects();
});
