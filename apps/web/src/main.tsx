import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MarketingPage } from "./marketing/MarketingPage";
import "./styles.css";

function Router() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleNavigate = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handleNavigate);

    const originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      originalPushState.apply(window.history, args);
      handleNavigate();
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (
        anchor?.href &&
        anchor.origin === window.location.origin &&
        !anchor.target &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        e.preventDefault();
        const url = new URL(anchor.href);
        window.history.pushState({}, "", url.pathname);
        handleNavigate();
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("popstate", handleNavigate);
      document.removeEventListener("click", handleClick);
      window.history.pushState = originalPushState;
    };
  }, []);

  if (currentPath === "/playground") {
    return <App />;
  }

  return <MarketingPage />;
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Unable to find the application root element");
}

createRoot(root).render(
  <StrictMode>
    <Router />
  </StrictMode>,
);
