// Command palette (Cmd/Ctrl+K) in the brutalist mono voice: type to
// filter, arrows to move, Enter to run, Esc to close. Commands are plain
// data — main.ts supplies the closures. Also installs single-key
// shortcuts for commands that declare one (skipped while typing in
// inputs/selects, so sliders and the filter box stay usable).

export interface Command {
  id: string;
  label: string;
  /** single-key shortcut (lowercase), shown right-aligned */
  key?: string;
  run(): void;
}

export function createPalette(commands: Command[]): void {
  const overlay = document.createElement('div');
  overlay.id = 'palette';
  overlay.className = 'palette hidden';
  overlay.innerHTML = `
    <div class="palette-box" role="dialog" aria-label="command palette">
      <input class="palette-input" type="text" placeholder="type a command…" aria-label="filter commands" />
      <ul class="palette-list" role="listbox"></ul>
    </div>`;
  document.body.append(overlay);

  const input = overlay.querySelector('.palette-input') as HTMLInputElement;
  const list = overlay.querySelector('.palette-list') as HTMLUListElement;

  let filtered: Command[] = commands;
  let sel = 0;

  function renderList(): void {
    list.innerHTML = '';
    filtered.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.className = i === sel ? 'on' : '';
      const label = document.createElement('span');
      label.textContent = cmd.label;
      li.append(label);
      if (cmd.key) {
        const k = document.createElement('kbd');
        k.textContent = cmd.key;
        li.append(k);
      }
      li.onclick = () => {
        close();
        cmd.run();
      };
      list.append(li);
    });
  }

  function filter(): void {
    const q = input.value.trim().toLowerCase();
    filtered = q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
    sel = 0;
    renderList();
  }

  function open(): void {
    overlay.classList.remove('hidden');
    input.value = '';
    filter();
    input.focus();
  }
  function close(): void {
    overlay.classList.add('hidden');
    input.blur();
  }
  const isOpen = () => !overlay.classList.contains('hidden');

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
  input.oninput = filter;
  input.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      sel = Math.min(sel + 1, filtered.length - 1);
      renderList();
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      sel = Math.max(sel - 1, 0);
      renderList();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const cmd = filtered[sel];
      if (cmd) {
        close();
        cmd.run();
      }
    } else if (e.key === 'Escape') {
      close();
    }
  };

  const byKey = new Map(commands.filter((c) => c.key).map((c) => [c.key!, c]));
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen() ? close() : open();
      return;
    }
    if (isOpen()) return; // palette input handles its own keys
    const t = e.target as HTMLElement;
    if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const cmd = byKey.get(e.key.toLowerCase());
    if (cmd) cmd.run();
  });

  document.getElementById('palette-btn')?.addEventListener('click', open);
}
