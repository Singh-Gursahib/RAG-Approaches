"""ChromaDB-backed vector store.

Embeddings are produced by our own `Embedder` and passed to Chroma explicitly,
so we are not bound to Chroma's default embedding function. The store runs in
ephemeral (in-memory) mode by default; pass `persist_dir` to persist to disk.
"""
from __future__ import annotations

from pathlib import Path

from ..data.chunk import Chunk
from ..llm.embedding import Embedder
from .base import SearchHit


class ChromaStore:
    """A thin wrapper over chromadb providing the Index protocol."""

    def __init__(
        self,
        embedder: Embedder | None = None,
        collection_name: str = "ragureap",
        persist_dir: str | Path | None = None,
    ):
        self.embedder = embedder or Embedder()
        self.collection_name = collection_name
        self.persist_dir = Path(persist_dir) if persist_dir else None
        self._collection = None
        self._client = None

    def _ensure_client(self):
        if self._client is not None:
            return self._client
        import chromadb

        if self.persist_dir is not None:
            self.persist_dir.mkdir(parents=True, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(self.persist_dir))
        else:
            self._client = chromadb.EphemeralClient()
        return self._client

    def _ensure_collection(self):
        if self._collection is not None:
            return self._collection
        client = self._ensure_client()
        # Drop any prior collection of the same name to keep `build` idempotent
        # within a process.
        try:
            client.delete_collection(self.collection_name)
        except Exception:
            pass
        self._collection = client.create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return self._collection

    def build(self, chunks: list[Chunk]) -> None:
        """Embed and upsert all chunks."""
        if not chunks:
            raise ValueError("Cannot build ChromaStore over an empty chunk list.")
        collection = self._ensure_collection()
        texts = [c.text for c in chunks]
        embeddings = self.embedder.encode(texts).tolist()
        ids = [c.chunk_id for c in chunks]
        metadatas = [{"doc_id": c.doc_id, "idx": c.idx} for c in chunks]
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )

    def search(self, query: str, k: int) -> list[SearchHit]:
        collection = self._ensure_collection()
        query_emb = self.embedder.encode_one(query).tolist()
        res = collection.query(
            query_embeddings=[query_emb],
            n_results=k,
        )
        ids = res["ids"][0]
        documents = res["documents"][0]
        # Chroma cosine "distance" → similarity = 1 - distance.
        distances = res.get("distances", [[0.0] * len(ids)])[0]
        hits: list[SearchHit] = []
        for cid, doc, dist in zip(ids, documents, distances):
            hits.append(SearchHit(chunk_id=cid, score=float(1.0 - dist), text=doc))
        return hits

    def __len__(self) -> int:
        if self._collection is None:
            return 0
        return self._collection.count()
