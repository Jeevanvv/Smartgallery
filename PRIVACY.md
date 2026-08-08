# Privacy and data handling

SmartGallery is software, not a hosted service. The person or organization deploying it is
the data controller and must publish an operator-specific notice with identity, contact
details, legal basis, subprocessors, retention periods, and data-subject rights.

## Data processed

- A submitted selfie is decoded and converted to a temporary face embedding for one search.
  Neither the selfie nor that temporary embedding is stored by the application.
- Event-photo face embeddings remain in PostgreSQL while the event exists. Permanently
  deleting an event deletes its embeddings and search history.
- Guest name, phone, email, consent time, search time, and match count are stored for the
  configured retention period (`SEARCH_SESSION_RETENTION_DAYS`, 30 days by default).
- Google OAuth tokens are encrypted at rest and used only to read folders selected by the
  authenticated photographer.

Photographers can delete individual guest search records from the dashboard. Public result
links expire and do not disclose Google Drive URLs or original filenames through the search
API.

Do not use this software for surveillance, identification without consent, or processing
faces you do not have the legal right to process.
