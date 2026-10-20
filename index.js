import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// Step 2.1: the three most recent projects on the home page
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects.slice(0, 3);

const projectsContainer = document.querySelector('.projects');
renderProjects(latestProjects, projectsContainer, 'h2');

// Step 3: GitHub profile stats
const githubData = await fetchGitHubData('ryan-kasem');
const profileStats = document.querySelector('#profile-stats');

if (profileStats) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public repos</dt><dd>${githubData.public_repos}</dd>
      <dt>Public gists</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers</dt><dd>${githubData.followers}</dd>
      <dt>Following</dt><dd>${githubData.following}</dd>
    </dl>`;
}
