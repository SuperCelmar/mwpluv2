import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { SidebarProvider, SidebarToggle } from "@/components/ui/sidebar";

describe("SidebarToggle", () => {
  it("aligns the toggle button content to the left", () => {
    render(
      <SidebarProvider open setOpen={vi.fn()}>
        <SidebarToggle />
      </SidebarProvider>
    );

    const toggleButton = screen.getByRole("button", {
      name: /toggle sidebar/i,
    });

    expect(toggleButton.className).toContain("justify-start");
  });
});

