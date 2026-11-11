/**
 * @file use-notifier.test.tsx
 * @description Tests that useNotifier returns the injected notifier.
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useNotifier } from "@/shared/hooks/use-notifier";
import { createFakeServices, renderWithServices } from "@/shared/testing/render-with-services";

function Probe() {
  const notifier = useNotifier();
  return <button onClick={() => notifier.success("done")}>go</button>;
}

describe("useNotifier", () => {
  it("returns the notifier from the services", async () => {
    const success = vi.fn();
    const services = createFakeServices({
      notifier: { success, info: vi.fn(), error: vi.fn() },
    });
    renderWithServices(<Probe />, services);
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(success).toHaveBeenCalledWith("done");
  });
});
