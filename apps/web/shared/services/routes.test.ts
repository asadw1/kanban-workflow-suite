/**
 * @file routes.test.ts
 * @description Tests the route registry: static paths, encoded dynamic segments and the
 * redirect-safe login URL builder.
 */
import { describe, expect, it } from "vitest";
import { NEXT_PARAM, loginUrl, routes } from "@/shared/services/routes";

describe("routes", () => {
  it("exposes the static paths", () => {
    expect(routes.home).toBe("/");
    expect(routes.login).toBe("/login");
    expect(routes.register).toBe("/register");
    expect(routes.newWorkspace).toBe("/workspaces/new");
  });

  it("builds workspace paths", () => {
    expect(routes.workspace("acme")).toBe("/acme");
    expect(routes.workspaceMembers("acme")).toBe("/acme/settings/members");
  });

  it("encodes dynamic segments so they cannot change the path structure", () => {
    expect(routes.workspace("a/b?c")).toBe("/a%2Fb%3Fc");
  });
});

describe("loginUrl", () => {
  it("returns the bare login path without a target", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl(null)).toBe("/login");
  });

  it("remembers a safe internal target", () => {
    expect(loginUrl("/acme/boards?x=1")).toBe(
      `/login?${NEXT_PARAM}=${encodeURIComponent("/acme/boards?x=1")}`,
    );
  });

  it("drops the home page and unsafe targets", () => {
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("https://evil.example")).toBe("/login");
    expect(loginUrl("//evil.example")).toBe("/login");
  });
});
