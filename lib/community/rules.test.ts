import { expect, it } from "vitest";
import { communitySettingsSchema } from "./rules";
import { inquiryReplySchema, inquirySchema } from "@/lib/support";

it("only accepts the owner profile visibility setting", () => {
  for (const data of [
    { points: 999 },
    { user_id: "other" },
    { public_profile: "true" },
    {},
    { public_profile: true, role: "admin" },
  ]) {
    expect(communitySettingsSchema.safeParse(data).success).toBe(false);
  }
  expect(
    communitySettingsSchema.safeParse({ public_profile: false }).success,
  ).toBe(true);
});
it("requires a reviewed response before awarding a contribution", () => {
  expect(
    inquiryReplySchema.safeParse({
      reply: "",
      status: "closed",
      contribution_accepted: true,
    }).success,
  ).toBe(false);
  expect(
    inquiryReplySchema.safeParse({
      reply: "Fixed",
      status: "open",
      contribution_accepted: true,
    }).success,
  ).toBe(false);
  expect(
    inquiryReplySchema.safeParse({
      reply: "Fixed",
      status: "answered",
      contribution_accepted: true,
    }).success,
  ).toBe(true);
  expect(
    inquirySchema.parse({
      title: "Correction",
      content: "Details",
      category: "data",
      contribution_accepted: true,
    }),
  ).not.toHaveProperty("contribution_accepted");
});
