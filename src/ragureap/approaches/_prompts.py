"""Shared prompt templates. Keeping the answer-generation prompt identical
across all RAG approaches isolates retrieval as the only experimental variable.
"""

ANSWER_PROMPT = """\
You are answering a question using ONLY the context passages below.

Context passages:
{context}

Question: {question}

Rules:
- Answer in as few words as possible (typically 1-10 words; a date, a name, a number).
- Use only information explicitly stated in the context.
- If the context does not contain enough information to answer, respond with exactly:
  NOT_IN_CONTEXT

Answer:"""


HYDE_REWRITE_PROMPT = """\
You will be given a question. Write a short, fact-style passage (2-4 sentences)
that would directly answer the question if such facts were available. Write in
the style of an authoritative reference: state specifics confidently as if from
a known source, even if you are not sure of the actual values. Do NOT hedge,
do NOT say "the answer is unknown", do NOT ask for clarification.

Question: {question}

Hypothetical passage:"""


def format_context(hits) -> str:
    """Format a list of SearchHit objects into a numbered context block."""
    return "\n\n".join(f"[Chunk {i + 1}] {h.text}" for i, h in enumerate(hits))


# --- Non-RAG prompts ---


SUMMARIZE_DOC_PROMPT = """\
Summarize the document below. Preserve ALL specific facts: names, dates, numbers,
identifiers, percentages, codes, technical terms, and other proper nouns
verbatim. Brevity is NOT the goal — being exhaustive about specific details IS.
Do not interpret or editorialize. Plain prose, no bullet lists.

Document:
{document}

Detailed summary preserving all specific facts:"""


SLIDING_WINDOW_PROMPT = """\
You are answering a question by reading the corpus one passage at a time.

Question: {question}

Best answer so far: {state}

New passage:
{window}

Instructions:
- If the new passage contains a more specific or correct answer than the current best, output the updated answer (as few words as possible).
- If the new passage does not improve the answer, output the current best answer unchanged.
- If after reading you still have no information for an answer, output exactly:
  NOT_IN_CONTEXT
- Output ONLY the answer text. No explanation.

Updated best answer:"""
