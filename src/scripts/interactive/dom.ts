type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

/** 小さな DOM ビルダー。on* は addEventListener、true は空属性、null/false は無視 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      el.className = String(value);
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) el.append(child);
  }
  return el;
}

/** ステップ列を一定間隔で進める再生器。要素が DOM から外れたら自動で止まる */
export function createPlayer(
  root: HTMLElement,
  length: () => number,
  onStep: (index: number) => void,
  onStateChange: (playing: boolean) => void,
  interval = 750
) {
  let index = -1;
  let timer: number | undefined;

  const stop = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    onStateChange(false);
  };

  const step = () => {
    if (!root.isConnected || index >= length() - 1) return stop();
    index += 1;
    onStep(index);
    if (index >= length() - 1) stop();
  };

  return {
    get index() {
      return index;
    },
    get done() {
      return index >= length() - 1;
    },
    play() {
      if (index >= length() - 1) index = -1;
      stop();
      onStateChange(true);
      step();
      timer = window.setInterval(step, interval);
    },
    step() {
      stop();
      if (index >= length() - 1) index = -1;
      step();
    },
    reset() {
      stop();
      index = -1;
    },
  };
}
