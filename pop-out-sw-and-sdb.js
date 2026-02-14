// ==UserScript==
// @name        [GC] - Popout Shop Wiz & SDB
// @namespace   https://greasyfork.org/en/users/1225524-kaitlin
// @match       https://www.grundos.cafe/*
// @exclude     https://www.grundos.cafe/itemview/*
// @license     MIT
// @version     1.4
// @author      AshyAsh
// @grant       none
// @require     https://update.greasyfork.org/scripts/512407/1582200/GC%20-%20Virtupets%20API%20library.js
// @description Shop Wiz & SDB searches in pop-out windows. Note: Reviewed and greenlit via staff ticket #5830.
// @downloadURL https://update.greasyfork.org/scripts/535932/%5BGC%5D%20-%20Popout%20Shop%20Wiz.user.js
// @updateURL https://update.greasyfork.org/scripts/535932/%5BGC%5D%20-%20Popout%20Shop%20Wiz.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'shopWizPopoutState';
  const SDB_STORAGE_KEY = 'sdbPopoutState';

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js';
  script.onload = init;
  document.head.appendChild(script);

  function el(tag, styles = {}, props = {}) {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    Object.assign(e, props);
    return e;
  }

  function init() {
    let isEnabled = JSON.parse(localStorage.getItem('popoutEnabled') ?? 'true');

    // ==========================================
    // SHARED BUTTON BAR
    // ==========================================
    const buttonBar = el('div', {
      position: 'fixed', bottom: '10px', left: '10px', zIndex: '9999',
      display: 'flex', gap: '6px', alignItems: 'center'
    });
    document.body.appendChild(buttonBar);

    // --- Toggle Button ---
    const toggleEnableBtn = el('button', {
      padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(0,0,0,0.2)', order: '3'
    });
    function updateToggleBtn() {
      toggleEnableBtn.textContent = isEnabled ? '⚡ On' : '💤 Off';
      toggleEnableBtn.style.background = isEnabled ? '#2a7d2a' : '#888';
      toggleEnableBtn.style.color = 'white';
    }
    updateToggleBtn();
    buttonBar.appendChild(toggleEnableBtn);
    toggleEnableBtn.addEventListener('click', () => {
      isEnabled = !isEnabled;
      updateToggleBtn();
      localStorage.setItem('popoutEnabled', JSON.stringify(isEnabled));
    });

    // ==========================================
    // POPOUT FACTORY
    // ==========================================
    function createPopout({ storageKey, label, color, defaultPos, btnOrder }) {
      const saved = JSON.parse(localStorage.getItem(storageKey)) || { x: defaultPos.x, y: defaultPos.y, width: 300, height: 250, open: false };

      let lastSearchTerm = '', lastSearchTime = 0, searchTimeout = null;

      // Button in the bar
      const toggleBtn = el('button', {
        padding: '8px 12px', borderRadius: '8px', background: color, color: 'white',
        border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
        order: String(btnOrder)
      }, { textContent: label });
      buttonBar.appendChild(toggleBtn);

      // Popout container
      const popout = el('div', {
        position: 'fixed', top: '0', left: '0', width: `${saved.width}px`, height: `${saved.height}px`,
        background: 'var(--bgcolor)', border: `2px solid ${color}`, boxShadow: '0 0 10px rgba(0,0,0,0.3)',
        zIndex: '9998', resize: 'none', overflow: 'auto',
        transform: `translate(${saved.x}px, ${saved.y}px)`, display: saved.open ? 'block' : 'none'
      });
      popout.dataset.x = saved.x;
      popout.dataset.y = saved.y;

      // Header
      const header = el('div', {
        background: 'var(--grid_head)', color: 'var(--color)', padding: '5px',
        cursor: 'move', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      });
      const title = el('span'); title.innerHTML = label;
      const countSpan = el('span', { marginLeft: '8px', fontSize: '90%', opacity: '0.7' });
      title.appendChild(countSpan);

      const minimizeBtn = el('button', {
        background: 'none', color: 'var(--color)', border: 'none', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
      }, { textContent: '—' });

      header.append(title, minimizeBtn);
      popout.appendChild(header);

      // Search input
      const inputContainer = el('div', { padding: '8px', display: 'flex', gap: '5px' });
      const input = el('input', { flex: '1', padding: '5px', border: '1px solid #aaa', borderRadius: '4px' },
        { type: 'text', placeholder: `Search ${label}...` });
      const goBtn = el('button', { padding: '5px 10px', border: '1px solid #333', background: '#eee', cursor: 'pointer' },
        { textContent: 'Go' });

      inputContainer.append(input, goBtn);
      popout.appendChild(inputContainer);

      const content = el('div', { padding: '0px 10px' });
      content.innerHTML = '<p>Results will display here when you search.</p>';
      popout.appendChild(content);
      document.body.appendChild(popout);

      // Show/hide
      toggleBtn.addEventListener('click', () => {
        const isOpen = popout.style.display === 'none';
        popout.style.display = isOpen ? 'block' : 'none';
        saveState({ open: isOpen });
      });
      minimizeBtn.addEventListener('click', () => {
        popout.style.display = 'none';
        saveState({ open: false });
      });

      // Drag & resize
      interact(popout)
        .draggable({
          allowFrom: 'div',
          listeners: {
            move(event) {
              const t = event.target;
              const x = (parseFloat(t.dataset.x) || 0) + event.dx;
              const y = (parseFloat(t.dataset.y) || 0) + event.dy;
              t.style.transform = `translate(${x}px, ${y}px)`;
              t.dataset.x = x; t.dataset.y = y;
              saveState({ x, y });
            }
          }
        })
        .resizable({
          edges: { left: true, right: true, bottom: true, top: true },
          listeners: {
            move(event) {
              let x = parseFloat(event.target.dataset.x) || 0;
              let y = parseFloat(event.target.dataset.y) || 0;
              Object.assign(event.target.style, {
                width: `${event.rect.width}px`, height: `${event.rect.height}px`,
                transform: `translate(${x + event.deltaRect.left}px, ${y + event.deltaRect.top}px)`
              });
              x += event.deltaRect.left; y += event.deltaRect.top;
              event.target.dataset.x = x; event.target.dataset.y = y;
              saveState({ x, y, width: event.rect.width, height: event.rect.height });
            }
          }
        });

      function saveState(partial = {}) {
        const current = JSON.parse(localStorage.getItem(storageKey)) || {};
        localStorage.setItem(storageKey, JSON.stringify({ ...current, ...partial }));
      }

      return {
        popout, input, content, countSpan, goBtn, saveState,
        get isEnabled() { return isEnabled; },
        handleSearch(searchFn) {
          async function handle() {
            if (!isEnabled) return;
            const term = input.value.trim();
            if (!term || term === lastSearchTerm) return;
            const timeSince = Date.now() - lastSearchTime;
            if (timeSince < 1000) {
              if (searchTimeout) clearTimeout(searchTimeout);
              content.innerHTML = '<p style="text-align:center;">One second while I catch up...</p>';
              searchTimeout = setTimeout(() => run(term), 1000 - timeSince);
            } else {
              run(term);
            }
          }
          async function run(term) {
            lastSearchTerm = term;
            lastSearchTime = Date.now();
            await searchFn(term);
          }
          input.addEventListener('keydown', e => { if (e.key === 'Enter') handle(); });
          goBtn.addEventListener('click', handle);
          return handle;
        },
        openAndSearch(query) {
          input.value = query;
          lastSearchTerm = '';
          if (popout.style.display === 'none') {
            popout.style.display = 'block';
            saveState({ open: true });
          }
          input.focus();
          goBtn.click();
        }
      };
    }

    // ==========================================
    // SHOP WIZARD POPOUT
    // ==========================================
    const sw = createPopout({
      storageKey: STORAGE_KEY,
      label: 'Shop Wizard',
      color: '#444',
      defaultPos: { x: 100, y: 100 },
      btnOrder: 1
    });

    sw.handleSearch(async (term) => {
      const url = `https://www.grundos.cafe/market/wizard/?submit=Search&area=0&search_method=1&query=${encodeURIComponent(term).replace(/%20/g, '+')}`;
      try {
        const res = await fetch(url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

        const searchCount = doc.querySelector('main .center:not(#shopBar) .smallfont');
        sw.countSpan.textContent = searchCount ? `(${searchCount.textContent.trim()})` : '';

        const searchTerm = doc.querySelector("#page_content > main > div:nth-child(5) > p.mt-1 > strong")?.textContent?.trim() || '(unknown)';
        const resultsGrid = doc.querySelector('.sw_results');

        sw.content.innerHTML = '';
        const termLabel = el('p', { fontWeight: 'bold', textAlign: 'center', margin: '2px 2px 10px 2px' });
        termLabel.classList.add('smallfont');
        termLabel.textContent = searchTerm;
        sw.content.appendChild(termLabel);

        if (!resultsGrid) {
          sw.content.appendChild(Object.assign(el('p'), { textContent: 'Hmmm... no results. Did you spell it right?' }));
          return;
        }

        const cells = resultsGrid.querySelectorAll('.data');
        const rows = [];
        for (let i = 0; i < cells.length; i += 4) {
          rows.push({
            seller: cells[i].innerText, link: cells[i].innerHTML,
            stock: parseInt(cells[i + 2].innerText, 10),
            price: parseInt(cells[i + 3].innerText.replace(/\D/g, ''), 10)
          });
        }

        if (!rows.length) {
          sw.content.appendChild(Object.assign(el('p'), { textContent: 'No matching items found.' }));
          return;
        }

        sw.content.appendChild(buildSellerTable(rows));
        sendShopWizardPrices(doc);
      } catch (err) {
        console.error('SW fetch error:', err);
        sw.content.innerHTML = '<p style="color:red;">Error fetching results.</p>';
      }
    });

    // Intercept SW icon clicks
    document.addEventListener('click', function (e) {
      if (!isEnabled) return;
      const swImg = e.target.closest('.search-helper-sw');
      if (!swImg) return;
      const anchor = swImg.closest('a');
      if (!anchor?.href.includes('/market/wizard/')) return;
      e.preventDefault();
      try {
        const query = new URL(anchor.href, location.origin).searchParams.get('query');
        if (query) sw.openAndSearch(decodeURIComponent(query));
      } catch (err) { console.error('SW link extract error:', err); }
    }, true);

    // ==========================================
    // SDB POPOUT
    // ==========================================
    const sdb = createPopout({
      storageKey: SDB_STORAGE_KEY,
      label: 'Safety Deposit',
      color: '#8B4513',
      defaultPos: { x: 150, y: 150 },
      btnOrder: 2
    });

    sdb.handleSearch(async (term) => {
      const url = `https://www.grundos.cafe/safetydeposit/?page=1&query=${encodeURIComponent(term)}&exact=1`;
      try {
        const res = await fetch(url);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

        const sdbGrid = doc.querySelector('.market_grid.sdb');
        sdb.content.innerHTML = '';

        const termLabel = el('p', { fontWeight: 'bold', textAlign: 'center', margin: '2px 2px 10px 2px' });
        termLabel.classList.add('smallfont');
        termLabel.textContent = term;
        sdb.content.appendChild(termLabel);

        if (!sdbGrid) {
          sdb.content.appendChild(Object.assign(el('p'), { textContent: 'No items found in your SDB.' }));
          sdb.countSpan.textContent = '(0)';
          return;
        }

        // Parse SDB items from the grid
        const nameNodes = sdbGrid.querySelectorAll('.data.flex-column.break strong');
        const items = [];

        nameNodes.forEach(nameNode => {
          const name = nameNode.textContent.trim();
          const container = nameNode.closest('.data');
          if (!container) return;

          const rarityEl = container.querySelector('[class^="rarity_"]');
          const rarity = rarityEl ? rarityEl.textContent.trim() : '';

          let sibling = container.nextElementSibling;
          let imgSrc = '', qty = '', type = '';

          while (sibling) {
            if (!imgSrc && sibling.querySelector('img.med-image')) {
              imgSrc = sibling.querySelector('img.med-image').src;
            } else if (!qty && sibling.querySelector('strong') && !sibling.classList.contains('break')) {
              qty = sibling.querySelector('strong').textContent.trim();
            } else if (!type && sibling.classList.contains('break') && sibling !== container) {
              type = sibling.querySelector('strong')?.textContent.trim() || '';
              break;
            }
            sibling = sibling.nextElementSibling;
          }

          items.push({ name, rarity, imgSrc, qty, type });
        });

        if (!items.length) {
          sdb.content.appendChild(Object.assign(el('p'), { textContent: 'No matching items found in SDB.' }));
          sdb.countSpan.textContent = '(0)';
          return;
        }

        sdb.countSpan.textContent = `(${items.length} item${items.length !== 1 ? 's' : ''})`;

        const table = el('table', { borderCollapse: 'collapse', width: '100%' });
        const headerRow = el('tr');
        ['', 'Item', 'Qty', 'Type'].forEach(t => {
          headerRow.appendChild(el('th', { borderBottom: '1px solid #ccc', padding: '4px', textAlign: 'left', fontSize: '12px' }, { textContent: t }));
        });
        table.appendChild(headerRow);

        items.forEach(item => {
          const tr = el('tr');

          const imgCell = el('td', { padding: '4px' });
          if (item.imgSrc) {
            const img = el('img', { width: '30px', height: '30px' });
            img.src = item.imgSrc;
            imgCell.appendChild(img);
          }

          const nameCell = el('td', { padding: '4px', fontSize: '12px' });
          nameCell.appendChild(el('strong', {}, { textContent: item.name }));
          if (item.rarity) {
            nameCell.appendChild(document.createTextNode(' '));
            nameCell.appendChild(el('span', { fontSize: '10px', opacity: '0.7' }, { textContent: item.rarity }));
          }

          const qtyCell = el('td', { padding: '4px', textAlign: 'center', fontWeight: 'bold' }, { textContent: item.qty });
          const typeCell = el('td', { padding: '4px', fontSize: '11px' }, { textContent: item.type });

          tr.append(imgCell, nameCell, qtyCell, typeCell);
          table.appendChild(tr);
        });

        sdb.content.appendChild(table);

      } catch (err) {
        console.error('SDB fetch error:', err);
        sdb.content.innerHTML = '<p style="color:red;">Error fetching SDB results.</p>';
      }
    });

    // Intercept SDB link clicks
    document.addEventListener('click', function (e) {
      if (!isEnabled) return;
      const anchor = e.target.closest('a[href*="/safetydeposit/"]');
      if (!anchor) return;
      try {
        const url = new URL(anchor.href, location.origin);
        if (!url.pathname.startsWith('/safetydeposit/')) return;
        const query = url.searchParams.get('query');
        if (!query) return;
        e.preventDefault();
        sdb.openAndSearch(decodeURIComponent(query));
      } catch (err) { console.error('SDB link extract error:', err); }
    }, true);

    // ==========================================
    // SHARED HELPER
    // ==========================================
    function buildSellerTable(rows) {
      const table = el('table', { borderCollapse: 'collapse', width: '100%' });
      const headerRow = el('tr');
      ['Seller', 'Stock', 'Price'].forEach(t => {
        headerRow.appendChild(el('th', { borderBottom: '1px solid #ccc', padding: '4px' }, { textContent: t }));
      });
      table.appendChild(headerRow);

      rows.forEach(row => {
        const tr = el('tr');
        const sellerCell = el('td', { padding: '4px' });
        const temp = el('div'); temp.innerHTML = row.link;
        const anchor = temp.querySelector('a');

        if (anchor) {
          const link = el('a', { color: 'var(--link_color)', textDecoration: 'bold' },
            { href: anchor.href, textContent: anchor.textContent });
          link.addEventListener('click', e => { e.preventDefault(); window.open(anchor.href, '_blank')?.focus(); });
          sellerCell.appendChild(link);
        } else {
          sellerCell.textContent = row.seller;
        }

        const stockCell = el('td', { padding: '4px' }, { textContent: row.stock });
        const priceCell = el('td', { padding: '4px' }, { textContent: row.price.toLocaleString() });
        tr.append(sellerCell, stockCell, priceCell);
        table.appendChild(tr);
      });

      return table;
    }
  }
})();
