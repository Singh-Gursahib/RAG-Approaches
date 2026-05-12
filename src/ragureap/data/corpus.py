"""Corpus loader. Reads every `*.txt` from data/eval_corpus/ into a Document list."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .chunk import Chunk, chunk_document


@dataclass(frozen=True)
class Document:
    doc_id: str   # filename stem
    path: Path
    text: str

    @property
    def n_tokens(self) -> int:
        return len(self.text.split())


def load_corpus(corpus_dir: str | Path) -> list[Document]:
    """Load all .txt files from corpus_dir, sorted by filename."""
    corpus_dir = Path(corpus_dir)
    if not corpus_dir.is_dir():
        raise FileNotFoundError(f"Corpus dir not found: {corpus_dir}")

    docs: list[Document] = []
    for path in sorted(corpus_dir.glob("*.txt")):
        text = path.read_text(encoding="utf-8")
        docs.append(Document(doc_id=path.stem, path=path, text=text))
    if not docs:
        raise FileNotFoundError(f"No .txt files in {corpus_dir}")
    return docs


def chunk_corpus(
    docs: list[Document],
    target_tokens: int = 150,
    overlap_tokens: int = 30,
) -> list[Chunk]:
    """Chunk every document and return one flat list, in document then idx order."""
    all_chunks: list[Chunk] = []
    for d in docs:
        all_chunks.extend(
            chunk_document(d.doc_id, d.text, target_tokens=target_tokens, overlap_tokens=overlap_tokens)
        )
    return all_chunks
