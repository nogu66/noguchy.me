function loadXPostEmbeds() {
  const embeds = document.querySelectorAll(".twitter-tweet");
  if (embeds.length === 0) return;

  const render = () => {
    if (window.twttr?.widgets?.load) {
      // widgets.load calls HTMLElement#matches on its argument, so it must be
      // an element (passing `document` throws "Illegal invocation")
      window.twttr.widgets.load(document.body);
    }
  };
  const existingScript = document.querySelector(
    'script[src="https://platform.twitter.com/widgets.js"]'
  );

  if (window.twttr?.widgets?.load) {
    render();
  } else if (existingScript) {
    existingScript.addEventListener("load", render, { once: true });
  } else {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://platform.twitter.com/widgets.js";
    script.setAttribute("charset", "utf-8");
    script.addEventListener("load", render, { once: true });
    document.head.appendChild(script);
  }
}

loadXPostEmbeds();
document.addEventListener("astro:page-load", loadXPostEmbeds);
