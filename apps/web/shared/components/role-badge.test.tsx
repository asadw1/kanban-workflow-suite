/**
 * @file role-badge.test.tsx
 * @description Tests that every workspace role renders its label.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Role } from "shared-types";
import { RoleBadge } from "@/shared/components/role-badge";
import { expectNoA11yViolations } from "@/shared/testing/expect-accessible";

describe("RoleBadge", () => {
  it.each<[Role, string]>([
    ["OWNER", "Owner"],
    ["ADMIN", "Admin"],
    ["MEMBER", "Member"],
    ["VIEWER", "Viewer"],
  ])("renders %s as %s", (role, label) => {
    render(<RoleBadge role={role} className="extra" />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("has no WCAG violations", async () => {
    const { container } = render(<RoleBadge role="ADMIN" />);
    await expectNoA11yViolations(container);
  });
});
