export type ReorderInput = {
  onHand: number;
  reserved: number;
  incoming: number;
  outgoing: number;
  reorderPoint: number;
  reorderQty: number;
  maxQty: number;
};

export type ReorderOutput = {
  shouldReorder: boolean;
  availableQty: number;
  suggestedQty: number;
};

export function calculateReorderSuggestion(input: ReorderInput): ReorderOutput {
  const availableQty = input.onHand - input.reserved + input.incoming - input.outgoing;

  if (availableQty > input.reorderPoint) {
    return {
      shouldReorder: false,
      availableQty,
      suggestedQty: 0,
    };
  }

  const targetQty = input.maxQty > 0 ? input.maxQty : input.reorderPoint + Math.max(input.reorderQty, 1);
  const calculated = Math.max(targetQty - availableQty, 0);
  const suggestedQty = input.reorderQty > 0 ? Math.max(input.reorderQty, calculated) : calculated;

  return {
    shouldReorder: suggestedQty > 0,
    availableQty,
    suggestedQty,
  };
}
