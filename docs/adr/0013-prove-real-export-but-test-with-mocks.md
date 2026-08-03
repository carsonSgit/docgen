# Prove real export while isolating automated tests

The first POC must demonstrate a real end-to-end Google export. Automated tests should mock the Google provider boundary for deterministic, credential-free verification, while a separate integration test or manual check exercises authorization, document creation, compilation, and link return against Google.
