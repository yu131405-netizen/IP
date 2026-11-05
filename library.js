(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const ready = new Promise((resolve, reject) => {
    let dbRequest;
    try { dbRequest = indexedDB.open('ateng-memory-library', 1); }
    catch (error) { reject(error); return; }
    dbRequest.onupgradeneeded = () => dbRequest.result.createObjectStore('assets', {keyPath: 'id'});
    dbRequest.onsuccess = () => resolve(dbRequest.result);
    dbRequest.onerror = () => reject(dbRequest.error);
    dbRequest.onblocked = () => reject(new Error('数据库被其他页面占用，请关闭其他页面后重试。'));
  });
  const items = $('#items');
  const uploadDialog = $('#upload-dialog');
  const previewDialog = $('#preview-dialog');
  const uploadForm = $('#upload-form');
  const message = $('#message');
  let selectedCategory = 'all';
  let entries = [];
  let thumbnailUrls = [];
  let previewUrl = null;
  let previewId = null;
  let previewVersion = 0;

  function report(text) { message.textContent = text; }
  function el(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function category(file) {
    if (file.type.startsWith('image/') || (!file.type && /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(file.name))) return 'image';
    if (file.type.startsWith('video/') || (!file.type && /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name))) return 'video';
    return 'document';
  }
  function categoryName(type) { return ({image:'图片', video:'视频', document:'文件'})[type] || '文件'; }
  function newId() { return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function transaction(mode, perform) {
    return ready.then(db => new Promise((resolve, reject) => {
      let result;
      const tx = db.transaction('assets', mode);
      try { result = perform(tx.objectStore('assets')); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(result && result.result);
      tx.onerror = () => reject(tx.error || new Error('保存失败'));
      tx.onabort = () => reject(tx.error || new Error('操作已中止'));
    }));
  }
  function allEntries() { return transaction('readonly', store => store.getAll()); }
  function saveEntries(newEntries) { return transaction('readwrite', store => { for (const entry of newEntries) store.put(entry); }); }
  function deleteEntry(id) { return transaction('readwrite', store => store.delete(id)); }
  function revokeThumbnails() { thumbnailUrls.forEach(URL.revokeObjectURL); thumbnailUrls = []; }
  function clearPreview() {
    previewVersion++;
    const video = $('#preview-content video');
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    $('#preview-content').replaceChildren();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    previewId = null;
  }
  function showError(error) {
    const reason = error && error.name === 'QuotaExceededError' ? '设备存储空间不足，请删除一些收藏后重试。' : '资料库暂时无法使用，请检查浏览器存储权限后重试。';
    report(reason);
    return reason;
  }
  function matches(entry) {
    const query = $('#search').value.trim().toLocaleLowerCase();
    const date = $('#date-filter').value;
    const allText = [entry.title, entry.name, entry.location, entry.date, (entry.date || '').replaceAll('-', '/')].join(' ').toLocaleLowerCase();
    return (selectedCategory === 'all' || entry.category === selectedCategory) && (!date || entry.date === date) && (!query || allText.includes(query));
  }
  function render() {
    revokeThumbnails();
    items.replaceChildren();
    $('#collection-count').textContent = `${entries.length} 份收藏`;
    const filtered = entries.filter(matches);
    const empty = $('#empty-state');
    empty.hidden = filtered.length > 0;
    if (!filtered.length) {
      const isFiltered = selectedCategory !== 'all' || $('#search').value.trim() || $('#date-filter').value;
      empty.querySelector('h3').textContent = isFiltered ? '没有找到这份回忆' : '这里还空空的';
      empty.querySelector('p').textContent = isFiltered ? '换个关键词、地点或日期再找找吧。' : '给回忆找个家，从收藏第一份资料开始吧。';
      $('#empty-upload').hidden = Boolean(isFiltered);
    }
    filtered.forEach(entry => {
      const card = el('article', 'asset-card');
      const button = el('button', 'asset-open');
      button.type = 'button';
      button.setAttribute('aria-label', `查看${categoryName(entry.category)}：${entry.title || entry.name}`);
      const thumb = el('div', 'asset-thumb');
      if (entry.category === 'image') {
        const image = el('img');
        const url = URL.createObjectURL(entry.file);
        thumbnailUrls.push(url);
        image.src = url;
        image.alt = '';
        image.loading = 'lazy';
        thumb.append(image);
      } else {
        thumb.append(el('span', '', entry.category === 'video' ? '▷' : '▤'));
      }
      thumb.append(el('span', 'asset-type', categoryName(entry.category)));
      const body = el('div', 'asset-card-body');
      body.append(el('h3', '', entry.title || entry.name));
      body.append(el('p', '', [entry.date || '未填写日期', entry.location].filter(Boolean).join(' · ')));
      if (entry.title && entry.title !== entry.name) body.append(el('p', 'asset-filename', entry.name));
      button.append(thumb, body);
      button.addEventListener('click', () => openPreview(entry));
      card.append(button);
      items.append(card);
    });
  }
  async function refresh() {
    try { entries = (await allEntries()).sort((a, b) => b.createdAt - a.createdAt); render(); }
    catch (error) { showError(error); $('#empty-state').hidden = true; }
  }
  function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  function closeDialog(dialog) { if (dialog.open) dialog.close(); }
  async function openPreview(entry) {
    clearPreview();
    const version = previewVersion;
    previewId = entry.id;
    $('#preview-title').textContent = entry.title || entry.name;
    $('#preview-meta').textContent = [entry.name, entry.date || '未填写日期', entry.location].filter(Boolean).join(' · ');
    previewUrl = URL.createObjectURL(entry.file);
    const download = $('#download-link');
    download.href = previewUrl;
    download.download = entry.name;
    const content = $('#preview-content');
    if (entry.category === 'image') {
      const image = el('img'); image.src = previewUrl; image.alt = entry.title || entry.name; content.append(image);
    } else if (entry.category === 'video') {
      const video = el('video'); video.controls = true; video.preload = 'metadata'; video.src = previewUrl; content.append(video);
    } else if (entry.file.type === 'application/pdf' || /\.pdf$/i.test(entry.name)) {
      const frame = el('iframe'); frame.title = `${entry.name} 预览`; frame.setAttribute('sandbox', ''); frame.src = previewUrl; content.append(frame);
    } else if ((entry.file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(entry.name)) && entry.file.size <= 1024 * 1024) {
      const pre = el('pre', '', '正在读取…'); content.append(pre);
      try { const text = await entry.file.text(); if (version === previewVersion) pre.textContent = text; }
      catch (_) { if (version === previewVersion) pre.textContent = '无法预览，请保存文件后打开。'; }
    } else {
      const info = el('div', 'preview-placeholder'); info.append(el('span', '', '▤')); info.append(document.createTextNode('这个文件可以保存到设备后打开。')); content.append(info);
    }
    if (version === previewVersion) openDialog(previewDialog);
  }
  document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click', () => {
    selectedCategory = button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(other => { const active = other === button; other.classList.toggle('active', active); other.setAttribute('aria-pressed', String(active)); });
    render();
  }));
  $('#search').addEventListener('input', render);
  $('#date-filter').addEventListener('input', render);
  $('#clear-filter').addEventListener('click', () => { $('#search').value = ''; $('#date-filter').value = ''; selectedCategory = 'all'; document.querySelectorAll('[data-category]').forEach(button => { const active = button.dataset.category === 'all'; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }); render(); });
  $('#open-upload').addEventListener('click', () => openDialog(uploadDialog));
  $('#empty-upload').addEventListener('click', () => openDialog(uploadDialog));
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
  previewDialog.addEventListener('close', clearPreview);
  $('#files').addEventListener('change', event => { const files = event.target.files; $('#file-selection').textContent = files.length ? `已选择 ${files.length} 个文件：${Array.from(files).map(file => file.name).join('、')}` : '还没有选择文件'; });
  uploadForm.addEventListener('submit', async event => {
    event.preventDefault();
    const files = Array.from($('#files').files);
    if (!files.length) return;
    const submit = uploadForm.querySelector('[type=submit]');
    const title = uploadForm.elements.title.value.trim();
    const location = uploadForm.elements.location.value.trim();
    const date = uploadForm.elements.date.value;
    const createdAt = Date.now();
    const newEntries = files.map((file, index) => ({id:newId(), title, location, date, createdAt:createdAt + index, name:file.name, category:category(file), file}));
    submit.disabled = true;
    submit.textContent = '正在收藏…';
    $('#upload-error').textContent = '';
    try {
      await saveEntries(newEntries);
      uploadForm.reset(); $('#file-selection').textContent = '还没有选择文件'; closeDialog(uploadDialog);
      report(`已收藏 ${newEntries.length} 个文件。`);
      await refresh();
    } catch (error) { $('#upload-error').textContent = showError(error); }
    finally { submit.disabled = false; submit.textContent = '收藏起来 ✳'; }
  });
  $('#delete-item').addEventListener('click', async () => {
    if (!previewId || !window.confirm('确定删除这份收藏吗？删除后无法恢复。')) return;
    try { await deleteEntry(previewId); closeDialog(previewDialog); report('已删除这份收藏。'); await refresh(); }
    catch (error) { showError(error); }
  });
  window.addEventListener('pagehide', () => { clearPreview(); revokeThumbnails(); });
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
  refresh();
})();
