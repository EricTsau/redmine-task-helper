## ADDED Requirements

### Requirement: Focus Mode Dashboard
The system SHALL provide a "Focus Mode" as the central view, minimizing distractions.

#### Scenario: Active task display
- **WHEN** a user has an active running timer for a task
- **THEN** the dashboard displays ONLY that task with a large dynamic timer
- **AND** displays the estimated hours and progress bar

#### Scenario: No active task
- **WHEN** no task is currently running
- **THEN** the dashboard prompts the user to select a task from "Assigned to Me" or "Favorites"

### Requirement: Global Navigation
The system SHALL provide keyboard-centric navigation.

#### Scenario: Quick Search
- **WHEN** the user presses `Cmd+K` (or `Ctrl+K`)
- **THEN** a modal search bar appears allowing search by Issue ID or Subject
- **AND** selecting a result navigates immediately to that task context

#### Scenario: Recent Tasks Cache
- **WHEN** the user opens the search palette
- **THEN** the system immediately displays the top 5 most recently accessed tasks without waiting for network input
- **AND** allows instant selection for reducing friction

### Requirement: Favorites and Assignments
The system SHALL organize tasks for quick access.

#### Scenario: Assigned Tasks
- **WHEN** the user views the sidebar or task list
- **THEN** the system displays issues assigned to the current user with status "In Progress" (or equivalent)

#### Scenario: Favorites
- **WHEN** a user marks a task as "Favorite"
- **THEN** it appears in a dedicated "Favorites" list for one-click timer activation
