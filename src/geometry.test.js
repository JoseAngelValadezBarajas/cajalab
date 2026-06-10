import { describe, expect, it } from "vitest";
import { buildArtifacts, buildLayout, makeFileName } from "./geometry.js";

const baseSettings = {
  width: 180,
  depth: 120,
  height: 80,
  thickness: 3,
  finger: 18,
  kerf: 0.12,
  gap: 12,
  openTop: false,
  jointType: "finger",
  cutColor: "white",
  includeMarks: false,
  bedPreset: "600x400",
  bedWidth: 600,
  bedHeight: 400,
  margin: 10,
  joinPieces: false,
  terrariumMode: false,
};

describe("box geometry", () => {
  it("places the six closed-box panels on the material bed", () => {
    const layout = buildLayout(baseSettings);

    expect(layout.placed.map((panel) => panel.id)).toEqual(["front", "back", "left", "right", "bottom", "top"]);
    expect(layout.fitsBed).toBe(true);
    expect(layout.canvasWidth).toBe(600);
    expect(layout.canvasHeight).toBe(400);
  });

  it("adds the terrarium insert only when terrarium mode has a lid", () => {
    const layout = buildLayout({ ...baseSettings, terrariumMode: true });

    expect(layout.placed.map((panel) => panel.id)).toContain("terrariumInsert");
  });

  it("exports DXF in millimeters with the expected cut layer", () => {
    const artifacts = buildArtifacts(baseSettings);

    expect(artifacts.dxf).toContain("$INSUNITS");
    expect(artifacts.dxf).toContain("\n70\n4\n");
    expect(artifacts.dxf).toContain("\n2\nCUT\n");
    expect(artifacts.cutSvg).toContain("<svg");
  });

  it("uses dimensions in exported file names", () => {
    expect(makeFileName(baseSettings, "svg")).toBe("cajalab-180x120x80mm.svg");
  });

  it("adds T-slot cut geometry to DXF exports", () => {
    const artifacts = buildArtifacts({
      ...baseSettings,
      jointType: "tslot",
      screwDiameter: 3,
      nutWidth: 6,
      slotDepth: 10,
      slotSpacing: 45,
    });

    expect(artifacts.dxf).toContain("CIRCLE");
  });

  it("can rotate parts when automatic nesting allows it", () => {
    const layout = buildLayout({
      ...baseSettings,
      bedWidth: 140,
      bedHeight: 260,
      width: 120,
      depth: 70,
      height: 55,
      autoNest: true,
      allowRotation: true,
    });

    expect(layout.placed.some((panel) => panel.rotated)).toBe(true);
  });
});
