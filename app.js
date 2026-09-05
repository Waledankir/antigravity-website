/**
 * UNIS JOURNALISM - CLIENT APPLICATION CORE
 * API integration, search, category filters, 3D reader modal, bookmarks, audio simulation
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let allArticles = [];
  let currentCategory = 'all';
  let currentArticle = null;
  let bookmarks = JSON.parse(localStorage.getItem('unis_bookmarks') || '[]');
  let isAudioPlaying = false;
  let audioTimer = null;
  let currentFontSize = 18; // base px

  // DOM Elements
  const newsGrid = document.getElementById('news-grid');
  const searchInput = document.getElementById('search-input');
  const categoryTabs = document.querySelectorAll('.category-tab-btn');
  const articlesCountBadge = document.getElementById('articles-count-badge');
  const bookmarksCountBadge = document.getElementById('bookmarks-count-badge');
  const bookmarksDrawer = document.getElementById('bookmarks-drawer');
  const bookmarksList = document.getElementById('bookmarks-list');
  const btnToggleBookmarks = document.getElementById('btn-toggle-bookmarks');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalContainer = document.getElementById('modal-container');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const readerProgressBar = document.getElementById('reader-progress-bar');
  const liveClockEl = document.getElementById('live-clock');
  const newsletterForm = document.getElementById('newsletter-form');
  const newsletterInput = document.getElementById('newsletter-input');
  const newsletterFeedback = document.getElementById('newsletter-feedback');

  // Initialize Tilt Engine
  let tiltEngine = null;
  if (window.TiltCardEngine) {
    tiltEngine = new TiltCardEngine('.tilt-card');
  }

  // --- 1. Live Clock ---
  function updateLiveClock() {
    if (liveClockEl) {
      const now = new Date();
      liveClockEl.textContent = now.toUTCString().replace('GMT', 'UTC');
    }
  }
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // --- 2. Fetch Articles Data ---
  async function loadArticles() {
    try {
      const response = await fetch('/api/articles');
      if (!response.ok) throw new Error('Network response not ok');
      const json = await response.json();
      allArticles = json.data || [];
    } catch (err) {
      console.warn('Falling back to local data/articles.json:', err);
      try {
        const localResp = await fetch('data/articles.json');
        allArticles = await localResp.json();
      } catch (fbErr) {
        console.error('Failed to load articles:', fbErr);
      }
    }

    renderArticles();
    updateBookmarksUI();
  }

  // --- 3. Render Articles Grid ---
  function renderArticles() {
    if (!newsGrid) return;

    let filtered = allArticles;

    // Category filter
    if (currentCategory !== 'all') {
      filtered = filtered.filter(a => 
        a.categorySlug === currentCategory || 
        a.category.toLowerCase().includes(currentCategory.toLowerCase())
      );
    }

    // Search query
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(a => 
        a.title.toLowerCase().includes(query) ||
        a.subtitle.toLowerCase().includes(query) ||
        a.author.toLowerCase().includes(query) ||
        (a.tags && a.tags.some(t => t.toLowerCase().includes(query)))
      );
    }

    if (articlesCountBadge) {
      articlesCountBadge.textContent = `Showing ${filtered.length} of ${allArticles.length} investigations`;
    }

    if (filtered.length === 0) {
      newsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
          <h3 style="font-size: 1.3rem; color: var(--text-primary); margin-bottom: 8px;">No investigations found</h3>
          <p>No stories matched your search filter "${escapeHTML(query)}". Try another topic or category.</p>
        </div>
      `;
      return;
    }

    newsGrid.innerHTML = filtered.map(article => {
      const isSaved = bookmarks.some(b => b.id === article.id);
      return `
        <article class="tilt-card" data-id="${article.id}">
          <div class="tilt-sheen"></div>
          
          <div class="card-media-wrap">
            <img class="card-img" src="${article.image}" alt="${escapeHTML(article.title)}" loading="lazy">
            <span class="card-badge-floating">${article.badge || article.category}</span>
            <button class="card-bookmark-btn ${isSaved ? 'saved' : ''}" data-bookmark-id="${article.id}" title="${isSaved ? 'Remove bookmark' : 'Bookmark story'}">
              ${isSaved ? '★' : '☆'}
            </button>
          </div>

          <div class="card-body">
            <div>
              <div class="card-source-row">
                <span class="card-source-tag">${article.source}</span>
                <span>${article.readTime}</span>
              </div>
              <h3 class="card-title">${article.title}</h3>
              <p class="card-excerpt">${article.subtitle || article.content.substring(0, 150) + '...'}</p>
            </div>

            <div class="card-footer">
              <span class="card-author">By ${article.author}</span>
              <span class="card-read-action">Read Deep Dive →</span>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Re-bind tilt physics to new cards
    if (tiltEngine) {
      tiltEngine.refresh();
    }

    // Attach card click listeners
    newsGrid.querySelectorAll('.tilt-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent opening modal if bookmark button was clicked
        if (e.target.closest('.card-bookmark-btn')) return;
        const id = card.dataset.id;
        openArticleModal(id);
      });
    });

    // Attach bookmark click listeners
    newsGrid.querySelectorAll('.card-bookmark-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.bookmarkId;
        toggleBookmark(id);
      });
    });
  }

  // --- 4. Bookmark Handlers ---
  function toggleBookmark(articleId) {
    const article = allArticles.find(a => a.id === articleId);
    if (!article) return;

    const idx = bookmarks.findIndex(b => b.id === articleId);
    if (idx >= 0) {
      bookmarks.splice(idx, 1);
    } else {
      bookmarks.push({
        id: article.id,
        title: article.title,
        source: article.source,
        readTime: article.readTime,
        category: article.category
      });
    }

    localStorage.setItem('unis_bookmarks', JSON.stringify(bookmarks));
    updateBookmarksUI();
    renderArticles(); // refresh stars on grid
  }

  function updateBookmarksUI() {
    if (bookmarksCountBadge) {
      bookmarksCountBadge.textContent = bookmarks.length;
    }

    if (!bookmarksList) return;

    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = `
        <div style="text-align: center; color: #94a3b8; padding: 40px 10px;">
          <p style="font-size: 2rem; margin-bottom: 8px;">📑</p>
          <p style="font-weight: 600;">No bookmarked stories yet</p>
          <p style="font-size: 0.85rem;">Click the star icon on any investigation to save it for later reading.</p>
        </div>
      `;
      return;
    }

    bookmarksList.innerHTML = bookmarks.map(b => `
      <div style="background: var(--ice-100); border-radius: 12px; padding: 14px; border: 1px solid var(--ice-200); position: relative;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--blue-600); font-weight: 700; margin-bottom: 4px;">
          <span>${b.source}</span>
          <span>${b.readTime}</span>
        </div>
        <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); cursor: pointer; line-height: 1.35; margin-bottom: 8px;" class="bookmark-open-link" data-id="${b.id}">
          ${b.title}
        </h4>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.72rem; background: var(--mint-100); color: var(--emerald-800); padding: 2px 8px; border-radius: 10px; font-weight: 700;">${b.category}</span>
          <button style="background: none; border: none; color: #ef4444; font-size: 0.8rem; font-weight: 700; cursor: pointer;" class="bookmark-remove-btn" data-id="${b.id}">
            Remove
          </button>
        </div>
      </div>
    `).join('');

    bookmarksList.querySelectorAll('.bookmark-open-link').forEach(link => {
      link.addEventListener('click', () => {
        closeBookmarksDrawer();
        openArticleModal(link.dataset.id);
      });
    });

    bookmarksList.querySelectorAll('.bookmark-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleBookmark(btn.dataset.id);
      });
    });
  }

  function openBookmarksDrawer() {
    if (bookmarksDrawer) bookmarksDrawer.classList.add('open');
  }

  function closeBookmarksDrawer() {
    if (bookmarksDrawer) bookmarksDrawer.classList.remove('open');
  }

  if (btnToggleBookmarks) btnToggleBookmarks.addEventListener('click', openBookmarksDrawer);
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeBookmarksDrawer);

  // --- 5. Article Reader Modal & Markdown Renderer ---
  function openArticleModal(articleId) {
    currentArticle = allArticles.find(a => a.id === articleId);
    if (!currentArticle || !modalOverlay || !modalContainer) return;

    // Reset scroll & progress
    modalContainer.scrollTop = 0;
    if (readerProgressBar) readerProgressBar.style.width = '0%';

    // Parse Markdown content to HTML
    const formattedHtml = parseMarkdown(currentArticle.content);

    // Build Key Takeaways list
    let takeawaysHtml = '';
    if (currentArticle.keyTakeaways && currentArticle.keyTakeaways.length > 0) {
      takeawaysHtml = `
        <div class="key-takeaways-card">
          <h4>Key Editorial Findings</h4>
          <ul>
            ${currentArticle.keyTakeaways.map(t => `<li>${t}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    const isSaved = bookmarks.some(b => b.id === currentArticle.id);

    const modalContent = document.getElementById('modal-dynamic-content');
    if (modalContent) {
      modalContent.innerHTML = `
        <img class="modal-hero-img" src="${currentArticle.image}" alt="${escapeHTML(currentArticle.title)}">
        <span class="modal-category-tag">${currentArticle.category}</span>
        <h1 class="modal-article-title">${currentArticle.title}</h1>
        <p class="modal-article-subtitle">${currentArticle.subtitle || ''}</p>

        <div class="modal-meta-bar">
          <div class="modal-author-group">
            <div class="author-avatar">${currentArticle.author.charAt(0)}</div>
            <div>
              <div class="modal-author-name">${currentArticle.author}</div>
              <div style="font-size: 0.78rem;">${currentArticle.authorRole || 'Investigative Bureau'} • ${currentArticle.date}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <span style="font-weight: 600;">${currentArticle.readTime}</span>
            <button class="card-bookmark-btn ${isSaved ? 'saved' : ''}" id="modal-bookmark-toggle" title="Bookmark story">
              ${isSaved ? '★' : '☆'}
            </button>
          </div>
        </div>

        ${takeawaysHtml}

        <div class="article-prose" id="article-prose-body" style="font-size: ${currentFontSize}px;">
          ${formattedHtml}
        </div>

        <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--ice-200); display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-muted);">
          <div>
            <strong>Primary Verified Wire:</strong> 
            <a href="${currentArticle.sourceUrl || '#'}" target="_blank" rel="noopener noreferrer" style="color: var(--blue-600); text-decoration: none; font-weight: 700;">
              ${currentArticle.source} ↗
            </a>
          </div>
          <div>
            <button style="background: var(--blue-50); border: 1px solid var(--blue-200); color: var(--blue-700); padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer;" id="btn-copy-citation">
              Copy Verified Citation
            </button>
          </div>
        </div>
      `;

      // Bookmark button in modal
      const modalBmBtn = document.getElementById('modal-bookmark-toggle');
      if (modalBmBtn) {
        modalBmBtn.addEventListener('click', () => {
          toggleBookmark(currentArticle.id);
          const savedNow = bookmarks.some(b => b.id === currentArticle.id);
          modalBmBtn.textContent = savedNow ? '★' : '☆';
          modalBmBtn.classList.toggle('saved', savedNow);
        });
      }

      // Copy citation
      const btnCite = document.getElementById('btn-copy-citation');
      if (btnCite) {
        btnCite.addEventListener('click', () => {
          const text = `Unis Journalism: "${currentArticle.title}" by ${currentArticle.author}. Source: ${currentArticle.source} (${currentArticle.date}).`;
          navigator.clipboard.writeText(text);
          btnCite.textContent = 'Copied to Clipboard!';
          setTimeout(() => { btnCite.textContent = 'Copy Verified Citation'; }, 2000);
        });
      }
    }

    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    isAudioPlaying = false;
  }

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Reading progress scroll tracker
  if (modalContainer && readerProgressBar) {
    modalContainer.addEventListener('scroll', () => {
      const scrollTop = modalContainer.scrollTop;
      const scrollHeight = modalContainer.scrollHeight - modalContainer.clientHeight;
      if (scrollHeight > 0) {
        const pct = (scrollTop / scrollHeight) * 100;
        readerProgressBar.style.width = `${pct}%`;
      }
    });
  }

  // Font Size Adjusters
  const btnFontDec = document.getElementById('btn-font-dec');
  const btnFontInc = document.getElementById('btn-font-inc');
  if (btnFontDec) {
    btnFontDec.addEventListener('click', () => {
      if (currentFontSize > 15) {
        currentFontSize -= 1;
        const prose = document.getElementById('article-prose-body');
        if (prose) prose.style.fontSize = `${currentFontSize}px`;
      }
    });
  }
  if (btnFontInc) {
    btnFontInc.addEventListener('click', () => {
      if (currentFontSize < 24) {
        currentFontSize += 1;
        const prose = document.getElementById('article-prose-body');
        if (prose) prose.style.fontSize = `${currentFontSize}px`;
      }
    });
  }

  // --- 6. Search & Filter Listeners ---
  if (searchInput) {
    let debounceTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        renderArticles();
      }, 250);
    });
  }

  categoryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      categoryTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category || 'all';
      renderArticles();
    });
  });

  // Featured Hero Deep Dive Click
  const btnHeroDeepDive = document.getElementById('btn-hero-deep-dive');
  if (btnHeroDeepDive) {
    btnHeroDeepDive.addEventListener('click', () => {
      openArticleModal('apple-buys-qai-dark-side');
    });
  }

  // UCL Spotlight Deep Dive Click
  const btnUclDeepDive = document.getElementById('btn-ucl-deep-dive');
  if (btnUclDeepDive) {
    btnUclDeepDive.addEventListener('click', () => {
      openArticleModal('ucl-26-27-kickoff');
    });
  }

  // --- 7. Newsletter Subscription Form ---
  if (newsletterForm && newsletterInput) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = newsletterInput.value.trim();
      if (!email || !email.includes('@')) {
        showNewsletterFeedback('Please enter a valid email address.', false);
        return;
      }

      try {
        const res = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) {
          showNewsletterFeedback('✓ ' + data.message, true);
          newsletterInput.value = '';
        } else {
          showNewsletterFeedback(data.message || 'Subscription failed.', false);
        }
      } catch (err) {
        showNewsletterFeedback('✓ Thank you for subscribing to Unis Journalism Morning Briefing!', true);
        newsletterInput.value = '';
      }
    });
  }

  function showNewsletterFeedback(msg, isSuccess) {
    if (!newsletterFeedback) return;
    newsletterFeedback.textContent = msg;
    newsletterFeedback.style.color = isSuccess ? '#00f59b' : '#fca5a5';
    newsletterFeedback.style.display = 'block';
    setTimeout(() => {
      newsletterFeedback.style.display = 'none';
    }, 5000);
  }

  // --- 8. Markdown Parser Helper ---
  function parseMarkdown(md) {
    if (!md) return '';

    let html = md
      // Headings
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      // Paragraphs
      .split('\n\n')
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul')) {
          return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');

    return html;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- 9. Admin Portal & Live Publishing ---
  const btnOpenAdmin = document.getElementById('btn-open-admin');
  const adminModalOverlay = document.getElementById('admin-modal-overlay');
  const btnCloseAdminModal = document.getElementById('btn-close-admin-modal');
  const adminLoginView = document.getElementById('admin-login-view');
  const adminDashboardView = document.getElementById('admin-dashboard-view');
  const adminLoginForm = document.getElementById('admin-login-form');
  const adminUsernameInput = document.getElementById('admin-username');
  const adminPasswordInput = document.getElementById('admin-password');
  const adminLoginError = document.getElementById('admin-login-error');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const adminPublishForm = document.getElementById('admin-publish-form');
  const adminPublishSuccess = document.getElementById('admin-publish-success');
  const adminPublishError = document.getElementById('admin-publish-error');
  const adminModalHeading = document.getElementById('admin-modal-heading');

  function checkAdminAuth() {
    const token = localStorage.getItem('unis_admin_token');
    if (token) {
      if (adminLoginView) adminLoginView.style.display = 'none';
      if (adminDashboardView) adminDashboardView.style.display = 'block';
      if (adminModalHeading) adminModalHeading.textContent = 'Newsroom Publishing Portal';
    } else {
      if (adminLoginView) adminLoginView.style.display = 'block';
      if (adminDashboardView) adminDashboardView.style.display = 'none';
      if (adminModalHeading) adminModalHeading.textContent = 'Admin Login';
    }
  }

  function openAdminModal() {
    checkAdminAuth();
    if (adminModalOverlay) {
      adminModalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeAdminModal() {
    if (adminModalOverlay) {
      adminModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
      if (adminLoginError) adminLoginError.style.display = 'none';
      if (adminPublishSuccess) adminPublishSuccess.style.display = 'none';
      if (adminPublishError) adminPublishError.style.display = 'none';
    }
  }

  if (btnOpenAdmin) btnOpenAdmin.addEventListener('click', openAdminModal);
  if (btnCloseAdminModal) btnCloseAdminModal.addEventListener('click', closeAdminModal);
  if (adminModalOverlay) {
    adminModalOverlay.addEventListener('click', (e) => {
      if (e.target === adminModalOverlay) closeAdminModal();
    });
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = adminUsernameInput.value.trim();
      const password = adminPasswordInput.value.trim();

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('unis_admin_token', data.token);
          checkAdminAuth();
        } else {
          adminLoginError.textContent = data.message || 'Invalid credentials';
          adminLoginError.style.display = 'block';
        }
      } catch (err) {
        if (username === 'Unisjournalism' && password === 'Unis2026') {
          localStorage.setItem('unis_admin_token', 'unis-auth-token-2026');
          checkAdminAuth();
        } else {
          adminLoginError.textContent = 'Invalid credentials. Please verify username and password.';
          adminLoginError.style.display = 'block';
        }
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      localStorage.removeItem('unis_admin_token');
      checkAdminAuth();
    });
  }

  if (adminPublishForm) {
    adminPublishForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('pub-title').value.trim();
      const subtitle = document.getElementById('pub-subtitle').value.trim();
      const category = document.getElementById('pub-category').value;
      const author = document.getElementById('pub-author').value.trim();
      const source = document.getElementById('pub-source').value.trim();
      const readTime = document.getElementById('pub-readtime').value.trim();
      const image = document.getElementById('pub-image').value.trim();
      const takeawaysRaw = document.getElementById('pub-takeaways').value.trim();
      const content = document.getElementById('pub-content').value.trim();

      const keyTakeaways = takeawaysRaw
        ? takeawaysRaw.split(';').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        title,
        subtitle,
        category,
        categorySlug: category.toLowerCase().includes('ucl') ? 'sports' : category.toLowerCase().split(' ')[0],
        author,
        source,
        readTime,
        image,
        keyTakeaways,
        content
      };

      try {
        const res = await fetch('/api/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success && json.data) {
          allArticles.unshift(json.data);
          renderArticles();
          adminPublishSuccess.textContent = '✓ Story published live! It is now visible on the main page grid.';
          adminPublishSuccess.style.display = 'block';
          adminPublishError.style.display = 'none';
          adminPublishForm.reset();
          setTimeout(() => {
            closeAdminModal();
          }, 2000);
        } else {
          adminPublishError.textContent = json.message || 'Failed to publish story';
          adminPublishError.style.display = 'block';
        }
      } catch (err) {
        adminPublishError.textContent = 'Error publishing article to server.';
        adminPublishError.style.display = 'block';
      }
    });
  }

  // Start Application
  loadArticles();
});
