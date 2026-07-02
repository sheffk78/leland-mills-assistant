/**
 * Knowledge capture and search utilities.
 *
 * The knowledge base auto-captures Q&A pairs from conversations.
 * When a user asks a question, we first search the knowledge base.
 * If a match is found, we serve it instantly (no Hermes agent call needed).
 * After each conversation exchange, useful Q&A pairs are saved.
 */

import { prisma } from "@/lib/db";

/**
 * Search the knowledge base for a matching Q&A pair.
 * Uses simple ILIKE matching on the question field.
 * Returns the best match if the similarity is above threshold.
 *
 * @param query - The user's question
 * @param minLength - Minimum question length to bother searching (default 10 chars)
 * @returns The best matching knowledge entry, or null if no good match
 */
export async function searchKnowledge(
  query: string,
): Promise<{ id: string; question: string; answer: string; tags: string[] } | null> {
  // Don't search for very short queries (likely just "hello", "yes", etc.)
  if (query.trim().length < 10) {
    return null;
  }

  // Search for entries where the question contains key words from the query
  // Extract significant words (skip common stop words)
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "can", "need", "what", "when", "where",
    "who", "why", "how", "which", "that", "this", "these", "those", "i",
    "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
    "them", "my", "your", "his", "its", "our", "their", "for", "of",
    "to", "in", "on", "at", "by", "with", "from", "as", "and", "or",
    "but", "not", "no", "if", "then", "so", "than", "too", "very",
  ]);

  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (words.length === 0) {
    return null;
  }

  // Build OR conditions: question contains any significant word
  // Use ILIKE for case-insensitive search
  const conditions = words.map((word) => ({
    question: { contains: word, mode: "insensitive" as const },
  }));

  const matches = await prisma.knowledgeEntry.findMany({
    where: { OR: conditions },
    orderBy: { usedCount: "desc" },
    take: 5,
  });

  if (matches.length === 0) {
    return null;
  }

  // Score each match by how many significant words it shares with the query
  const scored = matches.map((entry) => {
    const entryWords = entry.question
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const entryWordSet = new Set(entryWords);
    const overlap = words.filter((w) => entryWordSet.has(w)).length;
    const score = overlap / Math.max(words.length, 1);

    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Only return if the top match has a decent overlap (>= 40% word match)
  const best = scored[0];
  if (best && best.score >= 0.4) {
    // Increment the used count
    await prisma.knowledgeEntry.update({
      where: { id: best.entry.id },
      data: { usedCount: { increment: 1 } },
    });

    return {
      id: best.entry.id,
      question: best.entry.question,
      answer: best.entry.answer,
      tags: best.entry.tags,
    };
  }

  return null;
}

/**
 * Auto-capture a Q&A pair from a conversation.
 *
 * Not every exchange is worth saving. We capture when:
 * - The user message looks like a question (contains ? or starts with question words)
 * - The assistant response is substantive (more than 50 chars)
 * - The question is not a duplicate of an existing entry
 *
 * Tags are extracted from the question content.
 *
 * @param question - The user's message
 * @param answer - The assistant's response
 * @param userId - The ID of the user who asked
 * @returns The created knowledge entry, or null if not captured
 */
export async function captureKnowledge(
  question: string,
  answer: string,
  userId: string,
): Promise<{ id: string } | null> {
  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  // Skip if the question is too short or the answer is too short
  if (trimmedQuestion.length < 15 || trimmedAnswer.length < 50) {
    return null;
  }

  // Skip if it doesn't look like a question
  const looksLikeQuestion =
    trimmedQuestion.includes("?") ||
    /^(what|how|where|when|why|who|which|can|do|does|is|are|should|would|could|will|tell me|show me|give me|what's|list)/i.test(
      trimmedQuestion,
    );

  if (!looksLikeQuestion) {
    return null;
  }

  // Skip greetings and conversational messages
  const greetings = [
    "hello", "hi", "hey", "good morning", "good afternoon",
    "good evening", "thanks", "thank you", "ok", "okay", "yes", "no",
  ];
  if (greetings.some((g) => trimmedQuestion.toLowerCase().startsWith(g))) {
    return null;
  }

  // Check for duplicates — same or very similar question already exists
  const existing = await prisma.knowledgeEntry.findFirst({
    where: {
      question: { contains: trimmedQuestion.slice(0, 40), mode: "insensitive" },
    },
  });

  if (existing) {
    return null;
  }

  // Extract tags from the question
  const tags = extractTags(trimmedQuestion);

  const entry = await prisma.knowledgeEntry.create({
    data: {
      question: trimmedQuestion,
      answer: trimmedAnswer,
      sourceUserId: userId,
      tags,
    },
  });

  return { id: entry.id };
}

/**
 * Extract simple tags from a question.
 * Looks for domain-relevant keywords.
 */
function extractTags(question: string): string[] {
  const q = question.toLowerCase();
  const tags: string[] = [];

  const tagMap: Record<string, string[]> = {
    "delivery": ["delivery", "deliver", "route", "shipping", "ship"],
    "inspection": ["inspection", "inspect", "pre-trip", "post-trip", "check"],
    "maintenance": ["maintenance", "repair", "fix", "broken", "service"],
    "safety": ["safety", "hazard", "dangerous", "lockout", "tagout"],
    "compliance": ["dot", "compliance", "regulation", "regulatory", "logbook"],
    "inventory": ["inventory", "stock", "supply", "reorder", "quantity"],
    "feed": ["feed", "grain", "pellet", "supplement", "nutrition"],
    "sales": ["sales", "lead", "customer", "order", "quote"],
    "hr": ["employee", "staff", "hire", "hire", "onboarding", "policy"],
    "equipment": ["truck", "forklift", "tractor", "equipment", "vehicle"],
    "customer": ["customer", "client", "account", "smith farm"],
  };

  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((kw) => q.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags;
}