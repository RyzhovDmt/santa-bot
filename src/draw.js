// Secret Santa assignment: a permutation of participants where
// nobody gives to themselves and no two people give to each other.

const MAX_ATTEMPTS = 1000;

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isValid(pairs) {
  for (const [giver, receiver] of pairs) {
    if (giver === receiver) return false;
    if (pairs.get(receiver) === giver) return false;
  }
  return true;
}

// Returns Map<giverId, receiverId>.
export function draw(ids, random = Math.random) {
  if (ids.length < 3) {
    throw new Error('At least 3 participants are required');
  }

  // Rejection sampling gives a uniform choice among all valid assignments.
  // Roughly 22% of random permutations are valid, so this ends in a few tries.
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const receivers = shuffle(ids, random);
    const pairs = new Map(ids.map((id, i) => [id, receivers[i]]));
    if (isValid(pairs)) return pairs;
  }

  // Practically unreachable; a single cycle of length >= 3 is always valid.
  const order = shuffle(ids, random);
  return new Map(order.map((id, i) => [id, order[(i + 1) % order.length]]));
}

// pairs: plain object { giverId: receiverId }.
export function santaOf(pairs, receiverId) {
  return Object.keys(pairs).find((giver) => pairs[giver] === receiverId);
}

// Splits the assignment into gift chains: [[a, b, c], ...] meaning a -> b -> c -> a.
export function cycles(pairs) {
  const seen = new Set();
  const result = [];
  for (const start of Object.keys(pairs)) {
    if (seen.has(start)) continue;
    const cycle = [];
    for (let id = start; !seen.has(id); id = pairs[id]) {
      seen.add(id);
      cycle.push(id);
    }
    result.push(cycle);
  }
  return result;
}
