import assert from "assert";
import {
  shouldReadSystemMessagePagesBackwards,
  sortSystemMessagesNewestFirst
} from "../../src/utils/systemMessageHistory";

describe("system message history pagination", () => {
  test("detects old-first backend pages so history can page backwards", () => {
    const systemMessages = [
      { systemMessageId: "old", initDate: "2026-04-01T00:00:00.000Z" },
      { systemMessageId: "newer", initDate: "2026-04-02T00:00:00.000Z" }
    ];

    assert.equal(shouldReadSystemMessagePagesBackwards(systemMessages, 50, 25), true);
  });

  test("keeps newest-first backend pages moving forward", () => {
    const systemMessages = [
      { systemMessageId: "newer", initDate: "2026-04-02T00:00:00.000Z" },
      { systemMessageId: "old", initDate: "2026-04-01T00:00:00.000Z" }
    ];

    assert.equal(shouldReadSystemMessagePagesBackwards(systemMessages, 50, 25), false);
  });

  test("sorts returned system messages newest first", () => {
    const systemMessages = sortSystemMessagesNewestFirst([
      { systemMessageId: "old", initDate: "2026-04-01T00:00:00.000Z" },
      { systemMessageId: "new", initDate: "2026-04-03T00:00:00.000Z" },
      { systemMessageId: "middle", initDate: "2026-04-02T00:00:00.000Z" }
    ]);

    assert.deepEqual(systemMessages.map((message: any) => message.systemMessageId), ["new", "middle", "old"]);
  });
});
