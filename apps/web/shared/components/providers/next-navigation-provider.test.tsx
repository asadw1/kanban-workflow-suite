/**
 * @file next-navigation-provider.test.tsx
 * @description Tests that the adapter exposes the Next router and pathname through useNavigation.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextNavigationProvider } from "@/shared/components/providers/next-navigation-provider";
import { useNavigation } from "@/shared/hooks/use-navigation";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/acme/boards",
}));

function Probe() {
  const nav = useNavigation();
  return (
    <>
      <p>{nav.pathname}</p>
      <button onClick={() => nav.push("/a")}>push</button>
      <button onClick={() => nav.replace("/b")}>replace</button>
      <button onClick={() => nav.back()}>back</button>
    </>
  );
}

describe("NextNavigationProvider", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exposes the current pathname", () => {
    render(
      <NextNavigationProvider>
        <Probe />
      </NextNavigationProvider>,
    );
    expect(screen.getByText("/acme/boards")).toBeInTheDocument();
  });

  it("delegates push, replace and back to the Next router", async () => {
    render(
      <NextNavigationProvider>
        <Probe />
      </NextNavigationProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "push" }));
    await userEvent.click(screen.getByRole("button", { name: "replace" }));
    await userEvent.click(screen.getByRole("button", { name: "back" }));
    expect(router.push).toHaveBeenCalledWith("/a");
    expect(router.replace).toHaveBeenCalledWith("/b");
    expect(router.back).toHaveBeenCalledOnce();
  });
});
