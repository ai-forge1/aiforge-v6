import React, { useMemo, useRef, useState } from "react";
import { Download, Layers, Printer } from "lucide-react";
import {
  buildUniversalDimensions,
  getProjectionBounds
} from "./Aiforge_Universal_Dimension_Engine_v0.1.js";

// ============================================================
// AIFORGE — TECHNICAL DRAWING RENDERER v0.1
//
// Pure presentation layer over construction.elements[].
// No geometry is invented here. All dimensions come from the
// deterministic Dimension Engine.
// ============================================================

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function projectPoint(point, plane) {
  const x = finite(point?.x) ? point.x : 0;
  const y = finite(point?.y) ? point.y : 0;
  const z = finite(point?.z) ? point.z : 0;

  if (plane === "XZ") return { x, y: z };
  if (plane === "YZ") return { x: y, y: z };
  return { x, y };
}

function fmt(value, digits = 0) {
  return finite(value)
    ? value.toLocaleString("cs-CZ", { maximumFractionDigits: digits })
    : "—";
}

function profileLabel(element) {
  return element?.profile?.name || "profil neuveden";
}

function shouldShowElementLabel(element) {
  const params = element?.parameters || {};
  if (params.generatedPattern !== "repeatLinear") return true;
  return params.patternIndex === 1;
}

function DimensionLayer({ data, fontSize }) {
  const dimensions = data?.dimensions || [];
  if (!dimensions.length) return null;

  const stroke = Math.max(3, fontSize / 12);
  const dash = `${Math.max(16, fontSize * 0.55)} ${Math.max(10, fontSize * 0.3)}`;

  return (
    <>
      <defs>
        <marker
          id="aiforge-tech-arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#c2410c" />
        </marker>
      </defs>

      <g transform="scale(1,-1)" fill="none" stroke="#c2410c" strokeWidth={stroke}>
        {dimensions.map(dim => {
          if (dim.kind === "horizontal") {
            return (
              <g key={dim.id}>
                <line x1={dim.x1} y1={dim.extensionY1} x2={dim.x1} y2={dim.y} stroke="#94a3b8" strokeDasharray={dash} />
                <line x1={dim.x2} y1={dim.extensionY1} x2={dim.x2} y2={dim.y} stroke="#94a3b8" strokeDasharray={dash} />
                <line
                  x1={dim.x1}
                  y1={dim.y}
                  x2={dim.x2}
                  y2={dim.y}
                  markerStart="url(#aiforge-tech-arrow)"
                  markerEnd="url(#aiforge-tech-arrow)"
                />
              </g>
            );
          }

          return (
            <g key={dim.id}>
              <line x1={dim.extensionX1} y1={dim.y1} x2={dim.x} y2={dim.y1} stroke="#94a3b8" strokeDasharray={dash} />
              <line x1={dim.extensionX1} y1={dim.y2} x2={dim.x} y2={dim.y2} stroke="#94a3b8" strokeDasharray={dash} />
              <line
                x1={dim.x}
                y1={dim.y1}
                x2={dim.x}
                y2={dim.y2}
                markerStart="url(#aiforge-tech-arrow)"
                markerEnd="url(#aiforge-tech-arrow)"
              />
            </g>
          );
        })}
      </g>

      {dimensions.map(dim => {
        if (dim.kind === "horizontal") {
          return (
            <text
              key={`label-${dim.id}`}
              x={(dim.x1 + dim.x2) / 2}
              y={-dim.y - fontSize * 0.35}
              textAnchor="middle"
              fontSize={fontSize}
              fontWeight="700"
              fill="#9a3412"
              stroke="white"
              strokeWidth={fontSize / 5.5}
              paintOrder="stroke"
            >
              {dim.label}
            </text>
          );
        }

        const x = dim.x - fontSize * 0.7;
        const y = -((dim.y1 + dim.y2) / 2);

        return (
          <text
            key={`label-${dim.id}`}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight="700"
            fill="#9a3412"
            stroke="white"
            strokeWidth={fontSize / 5.5}
            paintOrder="stroke"
            transform={`rotate(-90 ${x} ${y})`}
          >
            {dim.label}
          </text>
        );
      })}
    </>
  );
}

export default function AiforgeTechnicalDrawing({ construction }) {
  const [plane, setPlane] = useState("XY");
  const svgRef = useRef(null);

  const elements = Array.isArray(construction?.elements) ? construction.elements : [];
  const bounds = useMemo(() => getProjectionBounds(elements, plane), [elements, plane]);
  const drawingData = useMemo(
    () => buildUniversalDimensions(construction, plane),
    [construction, plane]
  );

  const span = Math.max(bounds.width, bounds.height, 1000);
  const padding = drawingData?.drawingPadding || span * 0.2 + 180;
  const viewBox = [
    bounds.minX - padding,
    -(bounds.maxY + padding),
    Math.max(1, bounds.width) + padding * 2,
    Math.max(1, bounds.height) + padding * 2
  ].join(" ");

  const labelElements = elements.filter(shouldShowElementLabel);

  const exportSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aiforge-${construction?.productType || "construction"}-${plane}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4 text-orange-400" />
            Výrobní technický nákres
          </div>
          <div className="text-[11px] text-slate-500">
            Geometrie a kóty jsou odvozené pouze z construction.elements[].
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["XY", "XZ", "YZ"].map(item => (
            <button
              key={item}
              onClick={() => setPlane(item)}
              className={`px-2.5 py-1.5 rounded-md border text-xs ${plane === item ? "border-orange-500 bg-orange-500/10 text-orange-300" : "border-slate-700 text-slate-400"}`}
            >
              {item}
            </button>
          ))}
          <button onClick={exportSvg} className="px-2.5 py-1.5 rounded-md border border-slate-700 text-xs text-slate-300 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> SVG
          </button>
          <button onClick={() => window.print()} className="px-2.5 py-1.5 rounded-md bg-orange-600 text-xs text-white flex items-center gap-1">
            <Printer className="w-3.5 h-3.5" /> Tisk
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-white overflow-hidden min-h-[390px]">
        {elements.length ? (
          <svg
            ref={svgRef}
            viewBox={viewBox}
            className="w-full h-[62vh] min-h-[390px]"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Výrobní nákres ${construction?.productLabel || "konstrukce"} ${plane}`}
          >
            <rect
              x={bounds.minX - padding}
              y={-(bounds.maxY + padding)}
              width={Math.max(1, bounds.width) + padding * 2}
              height={Math.max(1, bounds.height) + padding * 2}
              fill="white"
            />

            <DimensionLayer data={drawingData} fontSize={Math.max(30, span / 95)} />

            <g transform="scale(1,-1)">
              {elements.map(element => {
                const start = projectPoint(element.start, plane);
                const end = projectPoint(element.end, plane);
                const stroke = Math.max(8, span / 360);

                return (
                  <g key={element.id}>
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke="#0f172a"
                      strokeWidth={stroke}
                      strokeLinecap="square"
                    />
                  </g>
                );
              })}
            </g>

            {labelElements.map(element => {
              const start = projectPoint(element.start, plane);
              const end = projectPoint(element.end, plane);
              const x = (start.x + end.x) / 2;
              const y = -((start.y + end.y) / 2);
              const fontSize = Math.max(24, span / 120);
              const repeated = element?.parameters?.generatedPattern === "repeatLinear";
              const text = repeated
                ? `${element.id}…  ${profileLabel(element)}  rozteč ${fmt(element?.parameters?.patternSpacingMm)} mm`
                : `${element.id}  ${profileLabel(element)}  L=${fmt(element.lengthMm)} mm`;

              return (
                <text
                  key={`element-label-${element.id}`}
                  x={x}
                  y={y - fontSize * 0.45}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill="#334155"
                  stroke="white"
                  strokeWidth={fontSize / 6}
                  paintOrder="stroke"
                >
                  {text}
                </text>
              );
            })}
          </svg>
        ) : (
          <div className="h-[390px] flex items-center justify-center text-slate-500 text-sm">
            Konstrukce zatím neobsahuje výrobní prvky.
          </div>
        )}
      </div>

      <div className="text-[11px] text-slate-500">
        Projekce {plane}. Tento výkres je odvozen z konstrukčního modelu; AI nesmí zpětně měnit rozměry podle vzhledu náhledu.
      </div>
    </div>
  );
}

export const AIFORGE_TECHNICAL_DRAWING_VERSION = "0.1";
