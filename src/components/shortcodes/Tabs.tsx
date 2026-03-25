import { marked } from "marked";
import React, { useEffect, useRef, useState } from "react";

interface TabItem {
  name: string;
  children: string;
}

const Tabs = ({ children }: { children: React.ReactElement }) => {
  const [active, setActive] = useState<number>(0);
  const [defaultFocus, setDefaultFocus] = useState<boolean>(false);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (defaultFocus) {
      tabRefs.current[active]?.focus();
    } else {
      setDefaultFocus(true);
    }
  }, [active]);

  const tabLinks: TabItem[] = Array.from(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((children.props as any).value as string).matchAll(
      /<div\s+data-name="([^"]+)"[^>]*>((?:.|\n)*?)<\/div>/g
    ),
    (match: RegExpMatchArray) => ({ name: match[1], children: match[0] })
  );

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      setActive(index);
    } else if (e.key === "ArrowRight") {
      setActive((active + 1) % tabLinks.length);
    } else if (e.key === "ArrowLeft") {
      setActive((active - 1 + tabLinks.length) % tabLinks.length);
    }
  };

  return (
    <div className="tab">
      <ul className="tab-nav" role="tablist">
        {tabLinks.map((item, index) => (
          <li
            key={index}
            className={`tab-nav-item ${index === active ? "active" : ""}`}
            role="tab"
            tabIndex={index === active ? 0 : -1}
            onKeyDown={e => handleKeyDown(e, index)}
            onClick={() => setActive(index)}
            ref={ref => {
              tabRefs.current[index] = ref;
            }}
          >
            {item.name}
          </li>
        ))}
      </ul>
      {tabLinks.map((item, i) => (
        <div
          key={i}
          className={active === i ? "tab-content block" : "hidden"}
          role="tabpanel"
          dangerouslySetInnerHTML={{
            __html: marked.parse(item.children) as string,
          }}
        />
      ))}
    </div>
  );
};

export default Tabs;
