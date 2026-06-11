# Overview

## What we're building

A web platform where photographers upload event photos to Google Drive, and clients visit the website, take a selfie, and instantly see all photos featuring their face — which they can then view and download.

## Three sides of the platform

### Photographer side

Uploads photos to a linked Google Drive folder (which they already do). A background sync pulls new photos, runs face detection, and indexes everyone's facial embeddings in a database.

### Client side

Client visits the website, takes a quick selfie via webcam or phone camera. The system matches their face against all indexed photos and shows only their photos — downloadable instantly.

### AI engine

Face detection + facial embedding (vector representation of face). Uses open-source AI models — no per-image API cost. All processing can run on free cloud tiers.

## Key insight

The "magic" is **facial embeddings** — every face becomes a list of ~512 numbers. To find a person's photos, we find all stored embeddings that are close (within a distance threshold) to the selfie's embedding. No retraining, no AI cost per query.

## Core capabilities

| Capability | Description |
|------------|-------------|
| Google Drive sync | Auto-import photos from Drive folders via Google Drive API |
| Batch face indexing | Process all photos offline, store face embeddings in DB |
| Selfie-to-search | Client uploads selfie → face extracted → matched against DB |
| Gallery delivery | Matched photos shown in a clean gallery with download option |
| Multi-event support | Photographer can manage multiple events/shoots |
| Privacy first | Selfie never stored; only embedding vectors used for matching |

## MVP scope (launch fast)

Per roadmap guidance, v1 should prioritize end-to-end face search:

- **Include:** Polling sync (every 30 min), individual photo download, basic admin
- **Defer to v2:** Drive webhooks, "Download all" ZIP, advanced analytics
