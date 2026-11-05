(() => {
  'use strict';

  const STORAGE_KEY = 'ateng-life-entries-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const list = $('#entry-list');
  const emptyNote = $('#empty-note');
  const form = $('#entry-form');
  const entryDialog = $('#entry-dialog');
  const aboutDialog = $('#about-dialog');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function readEntries() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.content === 'string') : [];
    } catch (_) {
      return [];
    }
  }

  function writeEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (_) {
      window.alert('保存失败，请检查浏览器是否允许本地存储，然后重试。');
      return false;
    }
  }

  function displayDate(value) {
    const parts = String(value || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!parts) return value || '未填写日期';
    return `${parts[1]} 年 ${Number(parts[2])} 月${parts[3] ? ` ${Number(parts[3])} 日` : ''}`;
  }

  function node(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = content;
    return element;
  }

  function renderEntries() {
    if (!list) return;
    const entries = readEntries();
    list.replaceChildren();
    if (emptyNote) emptyNote.hidden = entries.length > 0;

    entries.forEach(entry => {
      const card = node('article', 'entry-card user-entry');
      const metadata = node('div', 'entry-meta');
      const date = node('span', 'entry-date', displayDate(entry.date));
      metadata.append(date);
      if (entry.location) metadata.append(node('span', 'entry-location', entry.location));

      const title = node('h3', '', entry.title);
      const content = node('p', 'entry-content', entry.content);
      const remove = node('button', 'entry-delete', '删除这段经历');
      remove.type = 'button';
      remove.setAttribute('aria-label', `删除经历：${entry.title}`);
      remove.addEventListener('click', () => {
        if (!window.confirm(`确定删除「${entry.title}」吗？`)) return;
        const updated = readEntries().filter(item => item.id !== entry.id);
        if (writeEntries(updated)) renderEntries();
      });
      card.append(metadata, title, content, remove);
      list.append(card);
    });
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function scrollToId(id) {
    const target = document.getElementById(id);
    if (target) target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  document.querySelectorAll('[data-action="add"]').forEach(button => {
    button.addEventListener('click', () => openDialog(entryDialog));
  });
  document.querySelectorAll('[data-action="about"]').forEach(button => {
    button.addEventListener('click', () => openDialog(aboutDialog));
  });
  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => closeDialog(button.closest('dialog')));
  });
  document.querySelectorAll('[data-scroll]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      scrollToId(button.dataset.scroll);
    });
  });

  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const content = String(data.get('content') || '').trim();
    if (!title || !content) {
      window.alert('请填写标题和经历内容。');
      return;
    }
    const entries = readEntries();
    const entry = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      date: String(data.get('date') || '').trim(),
      location: String(data.get('location') || '').trim(),
      content
    };
    entries.unshift(entry);
    if (!writeEntries(entries)) return;
    renderEntries();
    form.reset();
    closeDialog(entryDialog);
    scrollToId('entry-list');
  });

  renderEntries();
})();
