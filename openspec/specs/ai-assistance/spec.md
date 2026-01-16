# ai-assistance Specification

## Purpose
TBD - created by archiving change init-redmine-flow-mvp. Update Purpose after archive.
## Requirements
### Requirement: AI Text Rewriting
The system SHALL provide AI assistance for polishing work logs.

#### Scenario: Rewrite Note
- **WHEN** a user types a rough note (e.g., "fixed bug") and clicks "AI Rewrite"
- **THEN** the system replaces the text with a professional summary (e.g., "Resolved issue causing crash...") via the configured LLM

### Requirement: Clipboard Image Upload
The system SHALL simplify attaching images to Redmine issues.

#### Scenario: Paste Screenshot
- **WHEN** a user presses `Ctrl+V` (or `Cmd+V`) with an image in the clipboard while editing a note
- **THEN** the system uploads the image to Redmine
- **AND** inserts the Markdown image syntax `!image.png!` into the text area

