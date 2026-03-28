import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders landing title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: /Smart Parking/i })).toBeInTheDocument();
});
