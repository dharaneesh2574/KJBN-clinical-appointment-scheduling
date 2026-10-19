// M1 acceptance inventory. These deliberately remain TODO until M2 provides
// protected application use cases and an injected request clock.
describe('R1 — effective availability and grid', () => {
  test.todo('accept exact window start/end for both 15- and 30-minute doctors');
  test.todo('reject a whole appointment extending past the working window');
  test.todo('reject off-grid starts even when the interval fits');
  test.todo('replace weekly hours with all date-override windows');
  test.todo(
    'return no slots on leave and allow windows on an extra working day',
  );
  test.todo(
    'reject availability edits that invalidate an occupied appointment',
  );
  test.todo('serialize availability edits racing with bookings');
});

describe('R2 — doctor overlap', () => {
  test.todo('allow adjacent half-open appointments');
  test.todo('reject every partial and containing overlap');
  test.todo('allow reuse of Cancelled and Late-Cancelled intervals');
  test.todo(
    'exactly one simultaneous booking succeeds with a deliberate conflict for the loser',
  );
});

describe('R3 — patient overlap', () => {
  test.todo('reject patient overlap across different doctors');
  test.todo('allow adjacent bookings across different doctors');
  test.todo('reject simultaneous overlapping patient bookings across doctors');
});

describe('R4 — doctor daily cap', () => {
  test.todo(
    'allow cap minus one and the last available place; reject beyond cap',
  );
  test.todo(
    'exclude both cancellation statuses and count Completed and No-Show',
  );
  test.todo('use IST day boundaries when the UTC date differs');
  test.todo(
    'exactly one concurrent request wins the final capacity across different slots',
  );
});

describe('R5 — cancellation and deposit', () => {
  test.todo(
    'classify 1h59m as Late-Cancelled; exactly 2h and 2h01m as Cancelled',
  );
  test.todo('require acknowledgement for 2 or 3 penalties but not 1');
  test.todo(
    'count mixed late-cancel and no-show events using their defined timestamps',
  );
  test.todo('exclude the exact 30-day lower boundary and include now');
  test.todo('expire penalties without a stale persisted deposit flag');
  test.todo(
    'reject flagged booking without acknowledgement and accept with it',
  );
  test.todo(
    'keep repeated cancellation idempotent and preserve its original timestamp',
  );
  test.todo(
    'reject transitions from final states and completion/no-show before end',
  );
});

describe('R6 — atomic rescheduling', () => {
  test.todo('cancel the original and book a linked replacement atomically');
  test.todo(
    'invalid replacement preserves original status, history, and capacity',
  );
  test.todo(
    'protect both doctors and the patient against concurrent reschedules',
  );
  test.todo('retain original late-cancellation penalties during rescheduling');
});

describe('R7 — booking horizon and clock', () => {
  test.todo('reject the past and accept exact now');
  test.todo('accept exactly 60 elapsed days and reject one millisecond later');
  test.todo(
    'handle IST midnight, UTC date changes, month/year changes, and leap days',
  );
  test.todo(
    'use one immutable injected clock snapshot for every check in a request',
  );
  test.todo(
    'reject missing offsets, malformed dates, and unauthorized reviewer overrides',
  );
});
