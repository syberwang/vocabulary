import {
  Grade,
  Rating,
  createEmptyCard,
  fsrs,
  type Card,
  type CardInput,
} from "ts-fsrs";
import type { RatingValue, SerializedCard } from "@/lib/types";

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});

const ratingMap: Record<RatingValue, Grade> = {
  again: Rating.Again as Grade,
  hard: Rating.Hard as Grade,
  good: Rating.Good as Grade,
  easy: Rating.Easy as Grade,
};

function toCard(card?: SerializedCard): CardInput | Card {
  if (!card) return createEmptyCard(new Date());
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

function serialize(card: Card): SerializedCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  };
}

export function scheduleCard(current: SerializedCard | undefined, rating: RatingValue, now = new Date()) {
  const result = scheduler.next(toCard(current), now, ratingMap[rating]);
  return serialize(result.card);
}

export function isDue(card: SerializedCard, now = new Date()) {
  return new Date(card.due).getTime() <= now.getTime();
}
