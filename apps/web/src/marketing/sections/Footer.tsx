export function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-footer-container">
        <div className="marketing-footer-content">
          <div className="marketing-footer-info">
            <div className="marketing-footer-name">Document Playground</div>
            <p className="marketing-footer-description">
              A single-user environment for experimenting with structured,
              paginated documents and exporting them to Google Docs.
            </p>
            <p className="marketing-footer-version">Version 0.1.0</p>
          </div>
          <nav
            className="marketing-footer-links"
            aria-label="Footer navigation"
          >
            <a
              href="https://github.com/carsonSgit/docgen"
              className="marketing-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              href="https://github.com/carsonSgit/docgen/blob/main/LICENSE"
              className="marketing-footer-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              License
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
