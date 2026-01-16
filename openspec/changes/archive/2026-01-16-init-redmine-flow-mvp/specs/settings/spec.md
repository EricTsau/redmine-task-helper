## ADDED Requirements

### Requirement: Configuration Management
The system SHALL allow users to configure connection details for their Redmine instance.

#### Scenario: Initial Setup
- **WHEN** the application starts for the first time
- **THEN** the user is presented with a setup screen asking for "Redmine URL" and "API Key"
- **AND** the "Save" button is disabled until valid formats are entered

#### Scenario: Update Settings
- **WHEN** the user navigates to the Settings page
- **THEN** they can view and update the Redmine URL and API Key
- **AND** the API Key is masked by default

### Requirement: Connection Validation
The system SHALL verify credentials before saving them.

#### Scenario: Test Connection Success
- **WHEN** the user clicks "Save & Connect"
- **THEN** the system attempts to fetch the current user ("myself") from Redmine
- **AND** if successful, saves the configuration and redirects to the Dashboard

#### Scenario: Test Connection Failure
- **WHEN** the user clicks "Save & Connect" with invalid credentials
- **THEN** the system displays a specific error message (e.g., "Invalid API Key" or "Cannot reach Server")
- **AND** does NOT save the invalid configuration
