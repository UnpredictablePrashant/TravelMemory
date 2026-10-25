import { capitalize, formatCost, formatDate } from "./format";

test("formats ISO and legacy dates, falls back to the raw value", () => {
  expect(formatDate("2022-03-19")).toMatch(/2022/);
  expect(formatDate("19-03-2022")).toMatch(/2022/);
  expect(formatDate("someday")).toBe("someday");
  expect(formatDate("")).toBe("—");
});

test("formats cost and capitalizes trip types", () => {
  expect(formatCost(undefined)).toBe("—");
  expect(formatCost(0)).toBe("0");
  expect(capitalize("leisure")).toBe("Leisure");
  expect(capitalize(undefined)).toBe("");
});
