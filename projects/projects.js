import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');

function updateTitle(count) {
  if (projectsTitle) {
    projectsTitle.textContent = `${count} Projects`;
  }
}

let query = '';
let selectedYear = null;

let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
let colors = d3.scaleOrdinal(d3.schemeTableau10);

let svg = d3.select('#projects-pie-plot');
let legend = d3.select('.legend');

function searchProjects() {
  return projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });
}

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

function renderPieChart(projectsGiven) {
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => String(d.year),
  );

  let data = rolledData
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => d3.descending(a.label, b.label));

  let sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  let arcData = sliceGenerator(data);

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

renderPieChart(projects);
renderVisibleProjects();

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  let searched = searchProjects();

  if (!searched.some((project) => String(project.year) === selectedYear)) {
    selectedYear = null;
  }

  renderPieChart(searched);
  renderVisibleProjects();
});
