import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let xScale;
let yScale;
let rScale;
let colorScale;

// Lab 8 Step 2.4: one color per technology (css, html, js)
const typeColors = d3.scaleOrdinal(d3.schemeTableau10);

const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 20 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/ryan-kasem/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: false,
        writable: false,
        enumerable: false,
      });

      return ret;
    })
    // Lab 8 Step 3.3: keep commits in time order so the story reads top to bottom
    .sort((a, b) => a.datetime - b.datetime);
}

// Lab 8 Step 1.2 exercise: stats are recomputed from the filtered commits
function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');
  container.selectAll('*').remove();
  const dl = container.append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  const numFiles = d3.group(data, (d) => d.file).size;
  dl.append('dt').text('Files');
  dl.append('dd').text(numFiles);

  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (v) => v.line),
    (d) => d.file,
  );
  const longestFile = d3.greatest(fileLengths, (d) => d[1]);
  dl.append('dt').text('Longest file');
  dl.append('dd')
    .attr('title', longestFile?.[0])
    .text(`${longestFile?.[1] ?? 0} lines`);

  const avgLineLength = d3.mean(data, (d) => d.length) ?? 0;
  dl.append('dt').text('Avg line length');
  dl.append('dd').text(`${d3.format('.1f')(avgLineLength)} chars`);

  const maxDepth = d3.max(data, (d) => d.depth) ?? 0;
  dl.append('dt').text('Max depth');
  dl.append('dd').text(maxDepth);

  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  dl.append('dt').text('Peak time of day');
  dl.append('dd').text(maxPeriod ?? 'n/a');

  const workByDay = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { weekday: 'long' }),
  );
  const maxDay = d3.greatest(workByDay, (d) => d[1])?.[0];
  dl.append('dt').text('Busiest day');
  dl.append('dd').text(maxDay ?? 'n/a');
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-clock');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

// Shared by render + update: draws (or redraws) the dots for a set of commits
function drawDots(svg, commits) {
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  svg
    .select('g.dots')
    .selectAll('circle')
    // Lab 8 Step 1.3: key by commit id so each commit keeps its own circle
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => colorScale(d.hourFrac))
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function renderScatterPlot(data, commits) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Radius scale is built from ALL commits so a commit's size never changes
  const [minLines, maxLines] = d3.extent(allCommits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Night hours lean blue, daytime leans orange
  colorScale = d3
    .scaleLinear()
    .domain([0, 6, 12, 18, 24])
    .range(['#1f4e9c', '#4a90d9', '#f4a63a', '#e8743b', '#1f4e9c'])
    .interpolate(d3.interpolateHcl);

  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Lab 8 Step 1.2: tag the axes so updateScatterPlot can find them
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  svg.append('g').attr('class', 'dots');
  drawDots(svg, commits);

  createBrushSelector(svg);
}

// Lab 8 Step 1.2: update the existing chart instead of appending a new svg
function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');

  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime)).nice();

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  drawDots(svg, commits);

  // Clear any brush so the selection never points at hidden commits
  svg.call(d3.brush().clear);
}

function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('#chart circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Lab 8 Step 2: unit visualization, one dot per line of code, grouped by file
function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // This code only runs when the div is initially rendered
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').append('code');
          div.append('dd');
        }),
    )
    // Re-append in sorted order so the biggest file is always on top
    .order();

  filesContainer
    .select('dt > code')
    .html((d) => `${d.name}<small>${d.lines.length} lines</small>`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${typeColors(d.type)}`);
}

function renderTypeLegend() {
  const types = Array.from(new Set(allData.map((d) => d.type))).sort();
  d3.select('#type-legend')
    .selectAll('li')
    .data(types)
    .join('li')
    .attr('style', (d) => `--color: ${typeColors(d)}`)
    .html((d) => `<span class="swatch"></span>${d}`);
}

let allData = await loadData();
let allCommits = processCommits(allData);

// Lab 8 Step 1.1: slider state, as a 0-100 percentage of the full time span
let commitProgress = 100;
let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(allCommits, (d) => d.datetime),
    d3.max(allCommits, (d) => d.datetime),
  ])
  .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

// Will get updated as user changes slider or scrolls
let filteredCommits = allCommits;

const slider = document.getElementById('commit-progress');
const timeLabel = document.getElementById('commit-time');

// Every update path (slider, scatter scroll, files scroll) goes through here
function applyMaxTime(maxTime) {
  commitMaxTime = maxTime;
  commitProgress = timeScale(commitMaxTime);
  slider.value = commitProgress;

  timeLabel.dateTime = commitMaxTime.toISOString();
  timeLabel.textContent = commitMaxTime.toLocaleString('en', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  filteredCommits = allCommits.filter((d) => d.datetime <= commitMaxTime);
  const filteredData = filteredCommits.flatMap((d) => d.lines);

  renderCommitInfo(filteredData, filteredCommits);
  updateScatterPlot(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onTimeSliderChange() {
  commitProgress = Number(slider.value);
  applyMaxTime(timeScale.invert(commitProgress));
}

renderScatterPlot(allData, allCommits);
renderTypeLegend();
slider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();

// Lab 8 Step 3.2: one story step per commit
function commitStory(d, i) {
  const fileCount = d3.rollups(
    d.lines,
    (D) => D.length,
    (d) => d.file,
  ).length;
  const when = d.datetime.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const linkText =
    i > 0 ? 'another commit' : 'my first commit, and it was glorious';
  return `
    <p>
      On ${when}, I made <a href="${d.url}" target="_blank">${linkText}</a>.
      I edited ${d.totalLines} lines across ${fileCount} file${fileCount === 1 ? '' : 's'}.
      Then I looked over all I had made, and I saw that it was very good.
    </p>
  `;
}

d3.select('#scatter-story')
  .selectAll('.step')
  .data(allCommits)
  .join('div')
  .attr('class', 'step')
  .html(commitStory);

// Lab 8 Step 4: same story again, this time driving the file unit viz
d3.select('#files-story')
  .selectAll('.step')
  .data(allCommits)
  .join('div')
  .attr('class', 'step')
  .html((d, i) => {
    const byFile = d3.rollups(
      d.lines,
      (D) => D.length,
      (d) => d.file,
    );
    const [topFile, topCount] = d3.greatest(byFile, (f) => f[1]);
    const when = d.datetime.toLocaleString('en', { dateStyle: 'long' });
    return `
      <p>
        On ${when}, <a href="${d.url}" target="_blank">this commit</a> added
        ${d.totalLines} lines that are still around today, and ${topCount} of them
        went into <code>${topFile}</code>. Watch the leaderboard on the left reshuffle.
      </p>
    `;
  });

// Lab 8 Step 3.3: scrolling a step past the middle of the screen moves time forward
function markActive(response) {
  d3.select(response.element.parentNode)
    .selectAll('.step')
    .classed('is-active', (d, i, nodes) => nodes[i] === response.element);
}

function onStepEnter(response) {
  markActive(response);
  applyMaxTime(response.element.__data__.datetime);
}

const scatterScroller = scrollama();
scatterScroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

const filesScroller = scrollama();
filesScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .step',
  })
  .onStepEnter(onStepEnter);

window.addEventListener('resize', () => {
  scatterScroller.resize();
  filesScroller.resize();
});
