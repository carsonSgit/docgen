# Repeat measured document sections and reserve body capacity

Headers and footers are document-level sections measured in points and repeated
on every page. Their reserved height reduces shared body capacity; empty
sections reserve nothing, and page breaks inside sections are rejected.
