import test from "node:test";
import assert from "node:assert/strict";
import { canReadCourse } from "@/lib/authorization/course-access";

const tenantCourse = {
  ownerId: "owner-a",
  organizationId: "tenant-a",
  status: "published" as const,
};

test("published tenant courses are not public", () => {
  assert.equal(canReadCourse(tenantCourse, {}), false);
  assert.equal(canReadCourse(tenantCourse, { userId: "outside-user" }), false);
});

test("active tenant roles can read a published tenant course", () => {
  assert.equal(canReadCourse(tenantCourse, { organizationRole: "learner" }), true);
  assert.equal(canReadCourse(tenantCourse, { organizationRole: "guardian" }), true);
});

test("draft tenant courses are restricted to managers", () => {
  const draft = { ...tenantCourse, status: "draft" as const };
  assert.equal(canReadCourse(draft, { organizationRole: "learner" }), false);
  assert.equal(canReadCourse(draft, { organizationRole: "teacher" }), true);
  assert.equal(canReadCourse(draft, { organizationRole: "content" }), true);
});

test("global drafts require ownership or platform content access", () => {
  const draft = { ownerId: "owner-a", organizationId: null, status: "draft" as const };
  assert.equal(canReadCourse(draft, { userId: "outside-user" }), false);
  assert.equal(canReadCourse(draft, { userId: "owner-a" }), true);
  assert.equal(canReadCourse(draft, { isPlatformContentManager: true }), true);
});
