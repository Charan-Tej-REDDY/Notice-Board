/* ==========================================================
   Community Notice Board — Application Logic (Vanilla JS)
   Features: CRUD, localStorage, search, filter, auto-expiry,
             delete confirmation modal, sorted by newest first.
   ========================================================== */

/**
 * ──────────────────────────
 *  Module‑scoped State
 * ──────────────────────────
 */
const STORAGE_KEY = 'communityNotices';

/** Currently active category filter ("All" by default) */
let activeFilter = 'All';

/** ID of the notice pending deletion (used by the confirm modal) */
let pendingDeleteId = null;

/**
 * ──────────────────────────
 *  DOM References
 * ──────────────────────────
 */
const dom = {
  form:            document.getElementById('noticeForm'),
  titleInput:      document.getElementById('noticeTitle'),
  categoryInput:   document.getElementById('noticeCategory'),
  descriptionInput:document.getElementById('noticeDescription'),
  expiryInput:     document.getElementById('noticeExpiry'),
  titleError:      document.getElementById('titleError'),
  categoryError:   document.getElementById('categoryError'),
  descriptionError:document.getElementById('descriptionError'),
  expiryError:     document.getElementById('expiryError'),
  searchInput:     document.getElementById('searchInput'),
  filterContainer: document.getElementById('filterContainer'),
  noticesGrid:     document.getElementById('noticesGrid'),
  emptyState:      document.getElementById('emptyState'),
  deleteModal:     document.getElementById('deleteModal'),
  confirmDelete:   document.getElementById('confirmDelete'),
  cancelDelete:    document.getElementById('cancelDelete'),
};

/**
 * ──────────────────────────
 *  localStorage Helpers
 * ──────────────────────────
 */

/** Retrieve all notices from localStorage (returns an array). */
function getNotices() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/** Save notices array to localStorage. */
function saveNotices(notices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
}

/**
 * ──────────────────────────
 *  Auto‑Expiry
 *  Removes notices whose expiry date is in the past.
 * ──────────────────────────
 */
function purgeExpiredNotices() {
  const today = new Date().toISOString().split('T')[0]; // "YYYY‑MM‑DD"
  const notices = getNotices().filter(n => n.expiry >= today);
  saveNotices(notices);
}

/**
 * ──────────────────────────
 *  Utility: category → CSS class
 * ──────────────────────────
 */
function categoryTagClass(category) {
  const map = {
    'Events':       'tag--events',
    'Lost & Found': 'tag--lost-found',
    'Help Needed':  'tag--help-needed',
    'Others':       'tag--others',
  };
  return map[category] || 'tag--others';
}

/**
 * ──────────────────────────
 *  Render Notices
 *  Applies current search term + category filter, then
 *  injects card HTML into the grid. Shows empty state when
 *  there are zero visible notices.
 * ──────────────────────────
 */
function renderNotices() {
  const searchTerm = dom.searchInput.value.trim().toLowerCase();
  let notices = getNotices();

  // Sort by creation date — newest first
  notices.sort((a, b) => b.createdAt - a.createdAt);

  // Filter by category
  if (activeFilter !== 'All') {
    notices = notices.filter(n => n.category === activeFilter);
  }

  // Filter by search (title or description)
  if (searchTerm) {
    notices = notices.filter(n =>
      n.title.toLowerCase().includes(searchTerm) ||
      n.description.toLowerCase().includes(searchTerm)
    );
  }

  // Build HTML
  if (notices.length === 0) {
    dom.noticesGrid.innerHTML = '';
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  dom.noticesGrid.innerHTML = notices.map(notice => `
    <article class="notice-card" data-id="${notice.id}">
      <div class="notice-card__header">
        <h3 class="notice-card__title">${escapeHtml(notice.title)}</h3>
        <span class="notice-card__tag ${categoryTagClass(notice.category)}">
          ${escapeHtml(notice.category)}
        </span>
      </div>
      <p class="notice-card__desc">${escapeHtml(notice.description)}</p>
      <div class="notice-card__footer">
        <span class="notice-card__expiry">📅 Expires: ${formatDate(notice.expiry)}</span>
        <button class="notice-card__delete" data-id="${notice.id}">🗑 Delete</button>
      </div>
    </article>
  `).join('');
}

/**
 * ──────────────────────────
 *  Helpers: escape & format
 * ──────────────────────────
 */

/** Prevent XSS by escaping user‑supplied text before injecting into HTML. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Turn "2026‑04‑15" into "15 Apr 2026". */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00'); // force local tz
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * ──────────────────────────
 *  Form Validation
 *  Returns true when all fields are valid; otherwise shows
 *  inline error messages and returns false.
 * ──────────────────────────
 */
function validateForm() {
  let valid = true;

  // Title
  if (!dom.titleInput.value.trim()) {
    showError(dom.titleInput, dom.titleError, 'Title is required.');
    valid = false;
  } else {
    clearError(dom.titleInput, dom.titleError);
  }

  // Category
  if (!dom.categoryInput.value) {
    showError(dom.categoryInput, dom.categoryError, 'Please select a category.');
    valid = false;
  } else {
    clearError(dom.categoryInput, dom.categoryError);
  }

  // Description
  if (!dom.descriptionInput.value.trim()) {
    showError(dom.descriptionInput, dom.descriptionError, 'Description is required.');
    valid = false;
  } else {
    clearError(dom.descriptionInput, dom.descriptionError);
  }

  // Expiry Date
  if (!dom.expiryInput.value) {
    showError(dom.expiryInput, dom.expiryError, 'Expiry date is required.');
    valid = false;
  } else {
    const today = new Date().toISOString().split('T')[0];
    if (dom.expiryInput.value < today) {
      showError(dom.expiryInput, dom.expiryError, 'Expiry date must be today or later.');
      valid = false;
    } else {
      clearError(dom.expiryInput, dom.expiryError);
    }
  }

  return valid;
}

/** Show an inline error on a form field. */
function showError(input, errorSpan, message) {
  input.classList.add('invalid');
  errorSpan.textContent = message;
}

/** Clear an inline error. */
function clearError(input, errorSpan) {
  input.classList.remove('invalid');
  errorSpan.textContent = '';
}

/**
 * ──────────────────────────
 *  Add a Notice
 * ──────────────────────────
 */
function addNotice(event) {
  event.preventDefault();

  if (!validateForm()) return;

  const notice = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: dom.titleInput.value.trim(),
    category: dom.categoryInput.value,
    description: dom.descriptionInput.value.trim(),
    expiry: dom.expiryInput.value,
    createdAt: Date.now(),
  };

  const notices = getNotices();
  notices.push(notice);
  saveNotices(notices);

  // Reset form
  dom.form.reset();
  [dom.titleError, dom.categoryError, dom.descriptionError, dom.expiryError].forEach(el => el.textContent = '');
  [dom.titleInput, dom.categoryInput, dom.descriptionInput, dom.expiryInput].forEach(el => el.classList.remove('invalid'));

  renderNotices();
}

/**
 * ──────────────────────────
 *  Delete a Notice (with confirmation)
 * ──────────────────────────
 */

/** Open the confirmation modal. */
function requestDelete(id) {
  pendingDeleteId = id;
  dom.deleteModal.classList.remove('hidden');
}

/** Commit the deletion after user confirms. */
function confirmDeleteAction() {
  if (!pendingDeleteId) return;
  const notices = getNotices().filter(n => n.id !== pendingDeleteId);
  saveNotices(notices);
  pendingDeleteId = null;
  dom.deleteModal.classList.add('hidden');
  renderNotices();
}

/** Cancel the deletion. */
function cancelDeleteAction() {
  pendingDeleteId = null;
  dom.deleteModal.classList.add('hidden');
}

/**
 * ──────────────────────────
 *  Event Listeners
 * ──────────────────────────
 */

// Form submit
dom.form.addEventListener('submit', addNotice);

// Live search
dom.searchInput.addEventListener('input', renderNotices);

// Category filter buttons (event delegation)
dom.filterContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;

  // Update active state
  dom.filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  activeFilter = btn.dataset.category;
  renderNotices();
});

// Delete button in notice cards (event delegation on the grid)
dom.noticesGrid.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.notice-card__delete');
  if (!deleteBtn) return;
  requestDelete(deleteBtn.dataset.id);
});

// Modal confirm / cancel
dom.confirmDelete.addEventListener('click', confirmDeleteAction);
dom.cancelDelete.addEventListener('click', cancelDeleteAction);

// Close modal on overlay click
dom.deleteModal.addEventListener('click', (e) => {
  if (e.target === dom.deleteModal) cancelDeleteAction();
});

/**
 * ──────────────────────────
 *  Initialisation
 * ──────────────────────────
 */
(function init() {
  // Set min date on expiry picker to today
  const today = new Date().toISOString().split('T')[0];
  dom.expiryInput.setAttribute('min', today);

  // Purge any expired notices
  purgeExpiredNotices();

  // First render
  renderNotices();
})();
