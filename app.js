/* Petal works with local files: no imports, network requests, or server needed. */
(() => {
  'use strict';
  const calculator = new PetalCalculator.Calculator();
  const $ = (selector) => document.querySelector(selector);
  const display = $('#display');
  const expression = $('#expression');
  const historyList = $('#history-list');
  const dialog = $('#shortcuts-dialog');
  const historyKey = 'petal.history.v1';
  const themeKey = 'petal.theme.v1';
  let history = [];
  let storageAvailable = true;
  let toastTimeout;

  function getStored(key) {
    try { return localStorage.getItem(key); }
    catch { storageAvailable = false; return null; }
  }

  function store(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch { storageAvailable = false; updateStorageNotice(); return false; }
  }

  function updateStorageNotice() {
    const label = $('.history-footer > span');
    label.replaceChildren();
    const dot = document.createElement('span');
    dot.className = 'local-dot';
    label.append(dot, storageAvailable ? 'Solo se guarda en este navegador' : 'Historial solo durante esta sesión');
  }

  function localNumber(value) { return String(value).replace('.', ','); }
  function localExpression(value) { return String(value).replace(/\./g, ','); }

  function render() {
    const state = calculator.getState();
    display.textContent = localNumber(state.display);
    expression.textContent = localExpression(state.expression) || '\u00a0';
    expression.scrollLeft = expression.scrollWidth;
    display.classList.toggle('is-medium', state.display.length > 9 && state.display.length <= 13);
    display.classList.toggle('is-small', state.display.length > 13);
    display.classList.toggle('is-error', state.error);
    $('#display-status').textContent = state.error ? (state.errorMessage || 'Probemos de nuevo. Pulsa AC.') : 'Tómate tu tiempo.';
    $('#display-caption').textContent = state.expression ? 'Un pequeño paso más' : 'Todo empieza con algo pequeño';
    $('#copy-result').disabled = state.error;
    document.querySelectorAll('[data-operator]').forEach((button) => {
      const selected = button.dataset.operator === state.operator;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function showToast(message) {
    clearTimeout(toastTimeout);
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimeout = setTimeout(() => toast.classList.remove('is-visible'), 2400);
  }

  function renderHistory() {
    historyList.replaceChildren();
    $('#empty-history').hidden = history.length > 0;
    $('#history-count').textContent = history.length;
    $('#clear-history').disabled = history.length === 0;
    for (const entry of history) {
      const item = document.createElement('li');
      item.className = 'history-entry';
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', `Usar resultado ${localNumber(entry.result)} de ${localExpression(entry.expression)}`);
      const calculation = document.createElement('span');
      calculation.className = 'entry-expression';
      calculation.textContent = `${localExpression(entry.expression)} =`;
      const result = document.createElement('span');
      result.className = 'entry-result';
      result.textContent = localNumber(entry.result);
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrow.classList.add('entry-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#icon-arrow');
      arrow.append(use);
      button.append(arrow, calculation, result);
      button.addEventListener('click', () => {
        calculator.setValue(entry.result);
        render();
        showToast('Resultado listo para seguir sumando');
      });
      item.append(button);
      historyList.append(item);
    }
    updateStorageNotice();
  }

  function saveCalculation(result) {
    if (!result || !Number.isFinite(Number(result.result))) return;
    history.unshift({ expression: String(result.expression), result: String(result.result) });
    history = history.slice(0, 30);
    store(historyKey, JSON.stringify(history));
    renderHistory();
    $('#history-content').scrollTop = 0;
  }

  function perform(button) {
    if (button.dataset.digit !== undefined) calculator.inputDigit(button.dataset.digit);
    else if (button.dataset.operator) calculator.chooseOperator(button.dataset.operator);
    else {
      switch (button.dataset.action) {
        case 'decimal': calculator.inputDecimal(); break;
        case 'clear': calculator.clear(); break;
        case 'sign': calculator.toggleSign(); break;
        case 'percent': calculator.percent(); break;
        case 'backspace': calculator.backspace(); break;
        case 'equals': saveCalculation(calculator.calculate()); break;
      }
    }
    render();
  }

  document.querySelectorAll('[data-digit], [data-operator], [data-action]').forEach((button) => {
    button.addEventListener('click', () => perform(button));
  });

  async function copyResult() {
    if (calculator.getState().error) return;
    const text = localNumber(calculator.getState().display);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Local clipboard fallback');
      await navigator.clipboard.writeText(text);
      showToast('Resultado copiado. Una cosita menos.');
    } catch {
      const field = document.createElement('textarea');
      field.value = text;
      field.setAttribute('readonly', '');
      field.style.cssText = 'position:fixed;top:0;left:-9999px;';
      document.body.append(field);
      field.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Browser can block the clipboard. */ }
      field.remove();
      showToast(copied ? 'Resultado copiado. Una cosita menos.' : 'Selecciona el resultado y pulsa ⌘ C para copiarlo.');
    }
  }
  $('#copy-result').addEventListener('click', copyResult);

  $('#clear-history').addEventListener('click', () => {
    history = [];
    store(historyKey, '[]');
    renderHistory();
    showToast('Una página en blanco, otra vez.');
  });

  function setTheme(theme) {
    if (!['rose', 'peach', 'lilac'].includes(theme)) return;
    document.body.dataset.theme = theme;
    document.querySelectorAll('[data-theme-choice]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    $('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--background').trim();
  }
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(button.dataset.themeChoice);
      store(themeKey, button.dataset.themeChoice);
    });
  });

  $('#open-shortcuts').addEventListener('click', () => dialog.showModal());
  $('#close-shortcuts').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });

  document.addEventListener('keydown', (event) => {
    if (dialog.open || event.isComposing || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.metaKey || event.ctrlKey) {
      if (event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
        event.preventDefault();
        copyResult();
      }
      return;
    }
    if (event.altKey) return;
    if (event.key === '?') { event.preventDefault(); dialog.showModal(); return; }
    // Enter always evaluates while using the calculator. Outside it, retain
    // native keyboard activation for themes, history entries, and dialogs.
    if (event.key === ' ' || (event.key === 'Enter' && event.target.closest('button, a') && !event.target.closest('.calculator'))) return;
    let selector;
    if (/^\d$/.test(event.key)) selector = `[data-digit="${event.key}"]`;
    else if (['+', '-', '*', '/'].includes(event.key)) selector = `[data-operator="${event.key}"]`;
    else {
      const actions = { Enter: 'equals', '=': 'equals', Escape: 'clear', Delete: 'clear', Backspace: 'backspace', '.': 'decimal', ',': 'decimal', '%': 'percent' };
      if (actions[event.key]) selector = `[data-action="${actions[event.key]}"]`;
    }
    if (!selector) return;
    event.preventDefault();
    if (event.target.closest('button, a') && !event.target.closest('.calculator')) event.target.blur();
    const button = $(selector);
    perform(button);
    button.classList.add('is-pressed');
    setTimeout(() => button.classList.remove('is-pressed'), 120);
  });

  try {
    const saved = JSON.parse(getStored(historyKey) || '[]');
    if (Array.isArray(saved)) history = saved.filter((entry) => entry && typeof entry.expression === 'string' && typeof entry.result === 'string' && entry.expression.length < 300 && entry.result.length < 100 && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(entry.result) && Number.isFinite(Number(entry.result))).slice(0, 30);
  } catch { history = []; }
  setTheme(getStored(themeKey) || 'rose');
  renderHistory();
  render();
})();
