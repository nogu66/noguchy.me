import "./interactive.css";

type Widget = { mount: (root: HTMLElement) => void };

// 記事内の <div data-interactive="名前"></div> と、そこにマウントするウィジェット
const widgets: Record<string, () => Promise<Widget>> = {
  "mods-next": () => import("./mods-next"),
  "mods-chain": () => import("./mods-chain"),
  "mods-catalog": () => import("./mods-catalog"),
};

export async function mountAll() {
  const roots = document.querySelectorAll<HTMLElement>(
    "[data-interactive]:not([data-mounted])"
  );
  await Promise.all(
    [...roots].map(async root => {
      const load = widgets[root.dataset.interactive ?? ""];
      if (!load) return;
      root.dataset.mounted = "";
      const { mount } = await load();
      mount(root);
    })
  );
}
