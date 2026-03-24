let pendingIncrement = 0;

export function signalVoteCast(isNewVote: boolean) {
  pendingIncrement = isNewVote ? 1 : 0;
}

export function consumeVoteSignal(): number {
  const val = pendingIncrement;
  pendingIncrement = 0;
  return val;
}
