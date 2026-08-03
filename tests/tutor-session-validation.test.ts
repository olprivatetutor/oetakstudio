import assert from "node:assert/strict";
import test from "node:test";
import { tutorConversationQuerySchema } from "../lib/validations";

test("tutor session queries use bounded pagination defaults", () => {
  assert.deepEqual(tutorConversationQuerySchema.parse({}), {
    page: 1,
    pageSize: 20,
    sort: "newest",
  });
  assert.equal(tutorConversationQuerySchema.safeParse({ pageSize: 101 }).success, false);
});

test("tutor session queries validate filters and sorting", () => {
  assert.deepEqual(
    tutorConversationQuerySchema.parse({
      page: "2",
      pageSize: "10",
      search: "fractions",
      status: "closed",
      sort: "oldest",
    }),
    { page: 2, pageSize: 10, search: "fractions", status: "closed", sort: "oldest" },
  );
  assert.equal(tutorConversationQuerySchema.safeParse({ status: "deleted" }).success, false);
});
