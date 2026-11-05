(() => {
  'use strict';
  const key = 'ateng-life-entries-v1';
  const defaultEntry = {
    id: 'shenzhen-first-chapter', title: '你好，深圳。你好，新的生活。', date: '十月', location: '深圳，中国', original: true,
    content: '十月，我第一次来到深圳讨生活。6号开始第一天上班，租了一间房子，也就这样，开启了人生的新阶段。\n\n我的奥德赛时期好像还挺短的。22岁，已经步入社会，开始过上比较稳定的生活。前方还有很多未知，但没关系，就一边生活，一边慢慢探索吧。'
  };
  function getEntries() {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.some(item => !item || typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.content !== 'string')) {
      throw new Error('故事数据格式异常');
    }
    return data;
  }
  function saveEntries(entries) {
    try { localStorage.setItem(key, JSON.stringify(entries)); return true; }
    catch { return false; }
  }
  function dateText(value) {
    if (!value) return '未填写日期';
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[1]} 年 ${Number(match[2])} 月 ${Number(match[3])} 日` : String(value);
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const list = document.querySelector('#story-list');
  if (list) {
    const search = document.querySelector('#story-query');
    const count = document.querySelector('#story-count');
    const noStories = document.querySelector('#no-stories');
    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      let stored;
      try { stored = getEntries(); }
      catch {
        list.replaceChildren();
        count.textContent = '无法读取已保存的故事';
        noStories.hidden = false;
        noStories.querySelector('p').textContent = '无法读取浏览器中的故事数据，已保留原数据。请检查浏览器存储设置。';
        return;
      }
      noStories.querySelector('p').textContent = '没有找到相关故事，换个关键词试试吧。';
      const entries = [defaultEntry, ...stored].filter(entry => [entry.title, entry.content, entry.location || '', entry.date || '', dateText(entry.date)].join(' ').toLocaleLowerCase().includes(query));
      list.replaceChildren();
      count.textContent = `${entries.length} 段故事`;
      noStories.hidden = entries.length > 0;
      entries.forEach((entry, index) => {
        const card = element('article', 'story-card');
        const dateColumn = element('div', 'story-date');
        dateColumn.append(element('span', 'date-label', entry.original ? 'OCTOBER' : 'A LITTLE MEMORY'), element('strong', '', entry.original ? '10月' : '✳'), element('small', '', dateText(entry.date)));
        const content = element('div', 'story-main');
        const meta = element('div', 'story-meta');
        meta.append(element('span', 'tag', entry.original ? '新的篇章' : '生活手记'));
        if (entry.location) meta.append(element('span', 'location', `✳  ${entry.location}`));
        content.append(meta, element('h3', '', entry.title), element('p', 'story-text', entry.content));
        const bottom = element('div', 'story-bottom');
        bottom.append(element('span', '', entry.original ? '✦  第一次来到深圳' : '✦  一段值得珍藏的时光'));
        if (!entry.original) {
          const remove = element('button', 'delete-story', '删除故事');
          remove.type = 'button';
          remove.setAttribute('aria-label', `删除故事：${entry.title}`);
          remove.addEventListener('click', () => {
            if (!window.confirm(`确定删除「${entry.title}」吗？`)) return;
            try {
              if (saveEntries(getEntries().filter(item => item.id !== entry.id))) render();
              else window.alert('删除失败，请检查浏览器存储设置。');
            } catch { window.alert('无法读取已保存的故事，原数据未更改。'); }
          });
          bottom.append(remove);
        }
        content.append(bottom);
        card.append(dateColumn, content);
        if (entry.original) {
          const photo = element('div', 'story-photo');
          photo.innerHTML = '<div class="story-photo-image" role="img" aria-label="深圳风景插画"></div><span class="photo-tape"></span><span class="handwritten photo-note">新生活，请多关照！♡</span>';
          card.append(photo);
        } else card.classList.add('personal-story');
        list.append(card);
      });
    }
    search.addEventListener('input', render);
    render();
  }
  const form = document.querySelector('#story-form');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const content = String(data.get('content') || '').trim();
    const message = document.querySelector('#form-message');
    if (!title || !content) { message.textContent = '请填写标题和经历内容。'; return; }
    const entry = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title, content,
      date: String(data.get('date') || ''),
      location: String(data.get('location') || '').trim()
    };
    let previous;
    try { previous = getEntries(); }
    catch { message.textContent = '无法读取已保存的故事，原数据未更改。请检查浏览器存储设置。'; return; }
    if (!saveEntries([entry, ...previous])) { message.textContent = '保存失败，请检查浏览器是否允许本地存储，然后重试。'; return; }
    window.location.href = 'journey.html';
  });
})();
