class NewsFeed extends HTMLElement {
  private controller?: AbortController;

  disconnectedCallback() {
    this.controller?.abort();
  }

  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    const input = this.querySelector<HTMLInputElement>('input[name="q"]')!;
    const buttons = [
      ...this.querySelectorAll<HTMLButtonElement>("[data-topic]"),
    ];
    const cards = [
      ...this.querySelectorAll<HTMLElement>("[data-news-card]"),
    ].map(element => ({
      element,
      text: (element.dataset.searchText ?? "")
        .normalize("NFKC")
        .toLocaleLowerCase(),
      topics: JSON.parse(element.dataset.topics ?? "[]") as string[],
    }));
    const query = new URLSearchParams(location.search);
    let topic = query.get("tag") ?? "";
    input.value = query.get("q") ?? "";
    const clear = this.querySelector<HTMLButtonElement>("[data-clear-search]")!;
    const count = this.querySelector<HTMLElement>("[data-results-count]")!;
    const heading = this.querySelector<HTMLElement>("[data-results-heading]")!;
    const empty = this.querySelector<HTMLElement>("[data-news-empty]")!;
    const pagination = this.querySelector<HTMLElement>(
      "[data-news-pagination]"
    )!;

    const update = (writeURL = true) => {
      const words = input.value
        .normalize("NFKC")
        .toLocaleLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const filtering = words.length > 0 || topic !== "";
      let matches = 0;
      cards.forEach(({ element, text, topics }) => {
        const match =
          words.every(word => text.includes(word)) &&
          (!topic || topics.includes(topic));
        if (match) matches++;
        element.hidden = filtering
          ? !match
          : element.dataset.initiallyHidden === "true";
      });
      buttons.forEach(button =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.topic === topic)
        )
      );
      clear.hidden = !filtering;
      empty.hidden = matches > 0;
      pagination.hidden = filtering;
      heading.textContent = filtering
        ? topic
          ? `${topic}のニュース`
          : "検索結果"
        : "新着ニュース";
      count.textContent = filtering
        ? `${matches} 件見つかりました`
        : `全 ${cards.length} 件`;
      if (writeURL) {
        const url = new URL(location.href);
        if (input.value.trim()) url.searchParams.set("q", input.value.trim());
        else url.searchParams.delete("q");
        if (topic) url.searchParams.set("tag", topic);
        else url.searchParams.delete("tag");
        history.replaceState(history.state, "", url);
      }
    };
    const reset = () => {
      input.value = "";
      topic = "";
      update();
      input.focus();
    };
    this.querySelector("form")!.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        update();
      },
      { signal }
    );
    input.addEventListener("input", () => update(), { signal });
    buttons.forEach(button =>
      button.addEventListener(
        "click",
        () => {
          topic = button.dataset.topic ?? "";
          update();
        },
        { signal }
      )
    );
    clear.addEventListener("click", reset, { signal });
    this.querySelector("[data-reset-filters]")!.addEventListener(
      "click",
      reset,
      { signal }
    );
    this.querySelector<HTMLElement>("[data-news-tools]")!.hidden = false;
    // Astro connects the new element before it commits the destination URL.
    const syncFromURL = () => {
      const query = new URLSearchParams(location.search);
      topic = query.get("tag") ?? "";
      input.value = query.get("q") ?? "";
      update(false);
    };
    document.addEventListener("astro:page-load", syncFromURL, { signal });
    window.addEventListener("popstate", syncFromURL, { signal });
    update(false);
  }
}

if (!customElements.get("news-feed"))
  customElements.define("news-feed", NewsFeed);
