# Face Recognition AI

Two stages: **indexing** (once per photo) and **search** (per client selfie).

## Stage 1 — Photo indexing (background job)

| Step | Action |
|------|--------|
| 1 | Download photo from Drive to temp storage |
| 2 | Face detection — RetinaFace finds all faces; returns bounding boxes |
| 3 | Face alignment — crop and align each face (landmark-based) |
| 4 | Embedding extraction — ArcFace outputs 512-dim vector per face |
| 5 | Store `(photo_id, embedding, face_box)` in PostgreSQL via pgvector |

One photo may contain 10–50 faces at an event.

## Stage 2 — Client selfie search

| Step | Action |
|------|--------|
| 1 | Client takes selfie via webcam or upload |
| 2 | Same pipeline extracts 512-dim embedding; **selfie discarded** |
| 3 | pgvector cosine similarity search within event |
| 4 | Deduplicate by `photo_id`; return Drive thumbnail URLs |

### Search query (conceptual)

```sql
SELECT DISTINCT p.*
FROM face_embeddings fe
JOIN photos p ON p.id = fe.photo_id
WHERE p.event_id = :event_id
  AND fe.embedding <=> :query_embedding < :threshold
ORDER BY fe.embedding <=> :query_embedding
LIMIT 200;
```

## Model recommendation

### InsightFace (ArcFace) — **Recommended**

- 99.83% accuracy on LFW benchmark
- ONNX export — runs on CPU without GPU
- Best balance of accuracy and speed

### DeepFace — Alternative

- Wraps ArcFace, Facenet, VGG-Face
- Easier setup, slightly slower
- Good for rapid prototyping

## Configuration

| Parameter | Default | Notes |
|-----------|---------|-------|
| `EMBEDDING_DIM` | 512 | ArcFace standard |
| `SIMILARITY_THRESHOLD` | 0.4 | Cosine distance; tune with real event photos |
| `MAX_SEARCH_RESULTS` | 200 | Cap before deduplication |

## Accuracy tips

- Too strict threshold → misses real matches
- Too loose threshold → false positives
- Test with real photographer data: glasses, masks, lighting variations
- Face alignment is critical — unaligned faces produce poor embeddings

## Python dependencies (backend)

```
insightface
onnxruntime
opencv-python-headless
numpy
```
