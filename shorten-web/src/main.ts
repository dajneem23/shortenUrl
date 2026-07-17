import './style.css';
import { renderHome } from './pages/home';
import { renderDetail } from './pages/detail';
import { renderAnalytics } from './pages/analytics';

const app = document.getElementById('app')!;

function router() {
  const path = window.location.pathname;

  // /:code/analytics -> analytics page
  const analyticsMatch = path.match(/^\/([a-zA-Z0-9_-]+)\/analytics$/);
  if (analyticsMatch) {
    renderAnalytics(app, analyticsMatch[1]);
    return;
  }

  // /:code -> detail page (but skip root and known routes)
  const detailMatch = path.match(/^\/([a-zA-Z0-9_-]+)$/);
  if (detailMatch && detailMatch[1].length > 0) {
    renderDetail(app, detailMatch[1]);
    return;
  }

  // / -> home
  renderHome(app);
}

// SPA navigation: intercept link clicks
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest('a');
  if (target && target.host === window.location.host && target.pathname !== window.location.pathname) {
    e.preventDefault();
    history.pushState({}, '', target.href);
    router();
  }
});

window.addEventListener('popstate', router);
router();
