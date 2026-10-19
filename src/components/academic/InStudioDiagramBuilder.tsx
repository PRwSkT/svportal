'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Shapes, 
  X, 
  Check, 
  RotateCcw, 
  RotateCw, 
  Trash2, 
  Copy, 
  ArrowUp, 
  ArrowDown, 
  Type, 
  Minus, 
  Move, 
  Sliders, 
  Grid, 
  Image as ImageIcon, 
  Square, 
  Circle, 
  Triangle, 
  Box, 
  Compass, 
  Zap, 
  Layers, 
  Plus,
  Upload,
  Crop,
  Grid3X3,
  Boxes,
  Activity,
  Gauge,
  Magnet,
  FlaskConical,
  MessageSquare,
  Clock,
  ArrowRight,
  Star,
  FlipHorizontal,
  FlipVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Sun,
  Droplet,
  Eye,
  EyeOff,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';

export interface InStudioDiagramBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (svgString: string) => void;
  initialSvg?: string | null;
}

export type CanvasElementType = 
  // 2D Shapes
  | 'rect'
  | 'rounded_rect'
  | 'circle'
  | 'ellipse'
  | 'semicircle'
  | 'sector_pie'
  | 'triangle'
  | 'right_triangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'rhombus'
  | 'pentagon'
  | 'hexagon'
  | 'star_5'
  | 'polygon_custom'
  // 3D Solids
  | 'cube_3d'
  | 'box_3d'
  | 'cylinder_3d'
  | 'cone_3d'
  | 'sphere_3d'
  | 'pyramid_3d'
  | 'triangular_prism_3d'
  // Lines, Measurements & Math Tools
  | 'line'
  | 'arrow'
  | 'parallel_transversal'
  | 'intersecting_lines'
  | 'dimension_line'
  | 'angle_arc'
  | 'protractor'
  | 'axes_xy'
  | 'number_line'
  | 'analog_clock'
  | 'fraction_bar'
  | 'fraction_circle'
  | 'bar_chart'
  | 'ruler_cm'
  // Science & Experiments
  | 'circuit_bulb'
  | 'circuit_battery'
  | 'circuit_switch'
  | 'circuit_resistor'
  | 'circuit_ammeter'
  | 'circuit_voltmeter'
  | 'science_pulley'
  | 'science_spring'
  | 'science_incline'
  | 'science_lever'
  | 'science_magnet'
  | 'science_beaker'
  | 'science_test_tube'
  | 'science_flask'
  | 'thermometer'
  | 'balance_scale'
  // Diagrams, Social & Logic
  | 'compass_rose'
  | 'venn_2'
  | 'venn_3'
  | 'flowchart_terminator'
  | 'flowchart_process'
  | 'flowchart_decision'
  | 'flowchart_data'
  | 'speech_bubble'
  | 'timeline'
  | 'table_grid'
  // Text, Callout & Overlays
  | 'text_label'
  | 'math_label'
  | 'image_overlay';

export interface CanvasElement {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  flipH?: boolean;
  flipV?: boolean;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  strokeOpacity?: number;
  fill: string;
  fillOpacity?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  rx?: number;
  extraProps?: Record<string, any>;
}

// XML entity escaping for safe SVG export
export function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Ramer-Douglas-Peucker Polyline Simplification for Smart Freehand-to-Straight Shape conversion
function perpendicularDistance(pt: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  const u = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (mag * mag);
  const projX = lineStart.x + u * dx;
  const projY = lineStart.y + u * dy;
  return Math.hypot(pt.x - projX, pt.y - projY);
}

function simplifyPointsRDP(points: { x: number; y: number }[], epsilon: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }
  if (dmax > epsilon) {
    const rec1 = simplifyPointsRDP(points.slice(0, index + 1), epsilon);
    const rec2 = simplifyPointsRDP(points.slice(index), epsilon);
    return [...rec1.slice(0, rec1.length - 1), ...rec2];
  }
  return [points[0], points[end]];
}

// Render Endpoint Cap SVG Markup at (x, y) pointing along outward angleRad
function renderLineCapSvg(x: number, y: number, angleRad: number, capType: string, stroke: string, strokeWidth: number): string {
  if (!capType || capType === 'none') return '';
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const sz = Math.max(8, strokeWidth * 3.2);

  if (capType === 'arrow') {
    const bx = x - sz * cos;
    const by = y - sz * sin;
    const hw = sz * 0.55;
    const p1x = bx - hw * sin;
    const p1y = by + hw * cos;
    const p2x = bx + hw * sin;
    const p2y = by - hw * cos;
    return `<polygon points="${x},${y} ${p1x},${p1y} ${p2x},${p2y}" fill="${stroke}"/>`;
  }
  if (capType === 'open_arrow') {
    const bx = x - sz * cos;
    const by = y - sz * sin;
    const hw = sz * 0.55;
    const p1x = bx - hw * sin;
    const p1y = by + hw * cos;
    const p2x = bx + hw * sin;
    const p2y = by - hw * cos;
    return `<polyline points="${p1x},${p1y} ${x},${y} ${p2x},${p2y}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  if (capType === 'dot') {
    const r = Math.max(4, strokeWidth * 1.8);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${stroke}"/>`;
  }
  if (capType === 'hollow_dot') {
    const r = Math.max(4.5, strokeWidth * 1.8);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" stroke="${stroke}" stroke-width="${Math.max(1.8, strokeWidth)}"/>`;
  }
  if (capType === 'bar') {
    const hw = Math.max(7, strokeWidth * 2.8);
    const p1x = x - hw * sin;
    const p1y = y + hw * cos;
    const p2x = x + hw * sin;
    const p2y = y - hw * cos;
    return `<line x1="${p1x}" y1="${p1y}" x2="${p2x}" y2="${p2y}" stroke="${stroke}" stroke-width="${Math.max(2, strokeWidth)}" stroke-linecap="round"/>`;
  }
  if (capType === 'diamond') {
    const r = Math.max(5, strokeWidth * 2.2);
    const tx = x + r * 0.4 * cos;
    const ty = y + r * 0.4 * sin;
    const bx = x - r * 1.2 * cos;
    const by = y - r * 1.2 * sin;
    const mx = (tx + bx) / 2;
    const my = (ty + by) / 2;
    const s1x = mx - r * 0.65 * sin;
    const s1y = my + r * 0.65 * cos;
    const s2x = mx + r * 0.65 * sin;
    const s2y = my - r * 0.65 * cos;
    return `<polygon points="${tx},${ty} ${s1x},${s1y} ${bx},${by} ${s2x},${s2y}" fill="${stroke}"/>`;
  }
  return '';
}

// Compute exact intersection point and acute/obtuse angles between two 2D line segments
function computeLineSegmentIntersection(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): { x: number; y: number; acuteDeg: number; obtuseDeg: number; bisectorRad: number } | null {
  const s1x = p2.x - p1.x;
  const s1y = p2.y - p1.y;
  const s2x = p4.x - p3.x;
  const s2y = p4.y - p3.y;
  const denom = -s2x * s1y + s1x * s2y;
  if (Math.abs(denom) < 1e-4) return null;

  const s = (-s1y * (p1.x - p3.x) + s1x * (p1.y - p3.y)) / denom;
  const t = (s2x * (p1.y - p3.y) - s2y * (p1.x - p3.x)) / denom;

  if (s >= 0.02 && s <= 0.98 && t >= 0.02 && t <= 0.98) {
    const ix = Math.round(p1.x + t * s1x);
    const iy = Math.round(p1.y + t * s1y);
    const a1 = Math.atan2(s1y, s1x);
    const a2 = Math.atan2(s2y, s2x);
    let diffDeg = Math.abs((a1 - a2) * (180 / Math.PI)) % 180;
    if (diffDeg > 90) diffDeg = 180 - diffDeg;
    const acuteDeg = Math.max(1, Math.round(diffDeg));
    const obtuseDeg = 180 - acuteDeg;
    return { x: ix, y: iy, acuteDeg, obtuseDeg, bisectorRad: (a1 + a2) / 2 };
  }
  return null;
}

// Helper: Render an angle arc and label centered at (cx, cy) from startDeg to endDeg (clockwise in SVG screen coords)
function renderArcBetweenAnglesSvg(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  color: string,
  label?: string,
  doubleArc?: boolean
): string {
  const sRad = (startDeg * Math.PI) / 180;
  const eRad = (endDeg * Math.PI) / 180;
  const x1 = Number((cx + radius * Math.cos(sRad)).toFixed(1));
  const y1 = Number((cy + radius * Math.sin(sRad)).toFixed(1));
  const x2 = Number((cx + radius * Math.cos(eRad)).toFixed(1));
  const y2 = Number((cy + radius * Math.sin(eRad)).toFixed(1));
  let sweepDiff = endDeg - startDeg;
  while (sweepDiff < 0) sweepDiff += 360;
  const largeArc = sweepDiff > 180 ? 1 : 0;
  let markup = `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" fill-opacity="0.12" stroke="none"/>`;
  markup += `<path d="M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" stroke="${color}" stroke-width="1.8"/>`;
  if (doubleArc) {
    const r2 = radius - 4.5;
    const dx1 = Number((cx + r2 * Math.cos(sRad)).toFixed(1));
    const dy1 = Number((cy + r2 * Math.sin(sRad)).toFixed(1));
    const dx2 = Number((cx + r2 * Math.cos(eRad)).toFixed(1));
    const dy2 = Number((cy + r2 * Math.sin(eRad)).toFixed(1));
    markup += `<path d="M ${dx1} ${dy1} A ${r2} ${r2} 0 ${largeArc} 1 ${dx2} ${dy2}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  }
  if (label) {
    const midRad = ((startDeg + sweepDiff / 2) * Math.PI) / 180;
    const labelDist = radius + 14;
    const lx = Number((cx + labelDist * Math.cos(midRad)).toFixed(1));
    const ly = Number((cy + labelDist * Math.sin(midRad)).toFixed(1));
    markup += `<text x="${lx}" y="${ly}" font-size="12" font-weight="bold" fill="${color}" text-anchor="middle" dominant-baseline="central" font-family="Sarabun, sans-serif">${escapeXml(label)}</text>`;
  }
  return markup;
}

// Shared SVG Markup Generator for Enhanced Lines, Polygons, Parallel Transversals, and Intersecting Lines
function renderCustomLineAndIntersectionMarkup(el: CanvasElement): string {
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const dash = el.strokeDasharray ? `stroke-dasharray="${el.strokeDasharray}"` : '';
  const fillOp = el.fillOpacity !== undefined ? `fill-opacity="${el.fillOpacity}"` : '';
  const strokeOp = el.strokeOpacity !== undefined ? `stroke-opacity="${el.strokeOpacity}"` : '';

  if (el.type === 'line' || el.type === 'arrow') {
    const x1 = el.extraProps?.x1 ?? el.x;
    const y1 = el.extraProps?.y1 ?? cy;
    const x2 = el.extraProps?.x2 ?? (el.x + el.width);
    const y2 = el.extraProps?.y2 ?? cy;
    const startCap = el.extraProps?.startCap ?? 'none';
    const endCap = el.extraProps?.endCap ?? (el.type === 'arrow' ? 'arrow' : 'none');
    const lineShape = el.extraProps?.lineShape || 'straight';
    const curveOffset = el.extraProps?.curveOffset ?? -45;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    let pathMarkup = '';
    let startOutAngle = Math.atan2(y1 - y2, x1 - x2);
    let endOutAngle = Math.atan2(y2 - y1, x2 - x1);
    let labelX = mx + nx * 12;
    let labelY = my + ny * 12;

    if (lineShape === 'curved') {
      const ctrlX = Number((mx + nx * curveOffset).toFixed(1));
      const ctrlY = Number((my + ny * curveOffset).toFixed(1));
      pathMarkup = `<path d="M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" ${strokeOp} ${dash}/>`;
      startOutAngle = Math.atan2(y1 - ctrlY, x1 - ctrlX);
      endOutAngle = Math.atan2(y2 - ctrlY, x2 - ctrlX);
      labelX = Number((0.25 * x1 + 0.5 * ctrlX + 0.25 * x2).toFixed(1));
      labelY = Number((0.25 * y1 + 0.5 * ctrlY + 0.25 * y2 - 10).toFixed(1));
    } else if (lineShape === 'elbow') {
      pathMarkup = `<path d="M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${strokeOp} ${dash}/>`;
      startOutAngle = x1 <= mx ? Math.PI : 0;
      endOutAngle = x2 >= mx ? 0 : Math.PI;
    } else if (lineShape === 'zigzag') {
      const peaks = Math.max(3, Math.min(14, el.extraProps?.zigzagCount ?? 6));
      const amp = Math.max(6, el.strokeWidth * 3);
      let d = `M ${x1} ${y1}`;
      const padFrac = 0.12;
      const startZx = x1 + dx * padFrac;
      const startZy = y1 + dy * padFrac;
      d += ` L ${startZx.toFixed(1)} ${startZy.toFixed(1)}`;
      for (let i = 0; i < peaks; i++) {
        const t = padFrac + ((1 - 2 * padFrac) * (i + 0.5)) / peaks;
        const sign = i % 2 === 0 ? 1 : -1;
        const px = x1 + dx * t + nx * amp * sign;
        const py = y1 + dy * t + ny * amp * sign;
        d += ` L ${px.toFixed(1)} ${py.toFixed(1)}`;
      }
      const endZx = x1 + dx * (1 - padFrac);
      const endZy = y1 + dy * (1 - padFrac);
      d += ` L ${endZx.toFixed(1)} ${endZy.toFixed(1)} L ${x2} ${y2}`;
      pathMarkup = `<path d="${d}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${strokeOp} ${dash}/>`;
    } else if (lineShape === 'double') {
      const off = Math.max(2.5, el.strokeWidth * 1.1);
      pathMarkup = `<line x1="${(x1 + nx * off).toFixed(1)}" y1="${(y1 + ny * off).toFixed(1)}" x2="${(x2 + nx * off).toFixed(1)}" y2="${(y2 + ny * off).toFixed(1)}" stroke="${el.stroke}" stroke-width="${Math.max(1.5, el.strokeWidth * 0.75)}" ${strokeOp} ${dash}/>
<line x1="${(x1 - nx * off).toFixed(1)}" y1="${(y1 - ny * off).toFixed(1)}" x2="${(x2 - nx * off).toFixed(1)}" y2="${(y2 - ny * off).toFixed(1)}" stroke="${el.stroke}" stroke-width="${Math.max(1.5, el.strokeWidth * 0.75)}" ${strokeOp} ${dash}/>`;
    } else {
      pathMarkup = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linecap="round" ${strokeOp} ${dash}/>`;
    }

    // Invisible wide hit-area so thin lines are effortless to click & drag
    const hitLine = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="14"/>`;
    const cap1 = renderLineCapSvg(x1, y1, startOutAngle, startCap, el.stroke, el.strokeWidth);
    const cap2 = renderLineCapSvg(x2, y2, endOutAngle, endCap, el.stroke, el.strokeWidth);
    const textTag = el.text
      ? `<text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" font-size="${el.fontSize || 13}" font-weight="${el.fontWeight || 'bold'}" fill="${el.stroke}" text-anchor="middle" dominant-baseline="central" font-family="${el.fontFamily || 'Sarabun, sans-serif'}">${escapeXml(el.text)}</text>`
      : '';
    return `${hitLine}${pathMarkup}${cap1}${cap2}${textTag}`;
  }

  if (el.type === 'polygon_custom') {
    const rawPts: { x: number; y: number }[] = el.extraProps?.points || [
      { x: 0.5, y: 0 },
      { x: 1, y: 0.85 },
      { x: 0, y: 0.85 }
    ];
    const absPts = rawPts.map(p => ({
      x: Number((el.x + p.x * el.width).toFixed(1)),
      y: Number((el.y + p.y * el.height).toFixed(1))
    }));
    const ptsStr = absPts.map(p => `${p.x},${p.y}`).join(' ');
    const isClosed = el.extraProps?.closed !== false;
    const showAngles = Boolean(el.extraProps?.showVertexAngles);

    let polyMarkup = isClosed
      ? `<polygon points="${ptsStr}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`
      : `<polyline points="${ptsStr}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" stroke-linecap="round" ${strokeOp} ${dash}/>`;

    if (!isClosed && absPts.length >= 2) {
      const p0 = absPts[0];
      const p1 = absPts[1];
      const pn = absPts[absPts.length - 1];
      const pn1 = absPts[absPts.length - 2];
      polyMarkup += renderLineCapSvg(p0.x, p0.y, Math.atan2(p0.y - p1.y, p0.x - p1.x), el.extraProps?.startCap || 'none', el.stroke, el.strokeWidth);
      polyMarkup += renderLineCapSvg(pn.x, pn.y, Math.atan2(pn.y - pn1.y, pn.x - pn1.x), el.extraProps?.endCap || 'none', el.stroke, el.strokeWidth);
    }

    if (showAngles && absPts.length >= 3) {
      const count = isClosed ? absPts.length : absPts.length - 2;
      for (let idx = 0; idx < count; idx++) {
        const i = isClosed ? idx : idx + 1;
        const prev = absPts[(i - 1 + absPts.length) % absPts.length];
        const curr = absPts[i];
        const next = absPts[(i + 1) % absPts.length];
        const a1 = Math.atan2(prev.y - curr.y, prev.x - curr.x) * (180 / Math.PI);
        const a2 = Math.atan2(next.y - curr.y, next.x - curr.x) * (180 / Math.PI);
        let diff = a2 - a1;
        while (diff < 0) diff += 360;
        const startA = diff <= 180 ? a1 : a2;
        const endA = diff <= 180 ? a2 : a1;
        const degVal = Math.round(diff <= 180 ? diff : 360 - diff);
        polyMarkup += renderArcBetweenAnglesSvg(curr.x, curr.y, 18, startA, endA, '#2563eb', `${degVal}°`);
      }
    }

    if (el.text) {
      polyMarkup += `<text x="${cx}" y="${cy}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" dominant-baseline="central" font-family="Sarabun, sans-serif">${escapeXml(el.text)}</text>`;
    }
    return polyMarkup;
  }

  if (el.type === 'parallel_transversal') {
    const y1 = Math.round(el.y + el.height * 0.28);
    const y2 = Math.round(el.y + el.height * 0.72);
    const xLeft = el.x + 16;
    const xRight = el.x + el.width - 16;
    const transAngle = Math.max(25, Math.min(155, el.extraProps?.transversalAngle ?? 65));
    const angleMode = el.extraProps?.angleMode || 'alternate_interior';
    const topLabel = el.extraProps?.topAngleLabel ?? `${transAngle}°`;
    const bottomLabel = el.extraProps?.bottomAngleLabel ?? 'x';
    const l1Label = el.extraProps?.line1Label ?? 'AB';
    const l2Label = el.extraProps?.line2Label ?? 'CD';
    const showParallelMarks = el.extraProps?.showParallelMarks !== false;

    // Transversal passes through center (cx, cy) at angle -transAngle in SVG screen coords (going up-right for <90°)
    const rad = (transAngle * Math.PI) / 180;
    const cot = Math.cos(rad) / (Math.sin(rad) || 0.001);
    const ix1 = Math.round(cx + (cy - y1) * cot);
    const iy1 = y1;
    const ix2 = Math.round(cx - (y2 - cy) * cot);
    const iy2 = y2;

    const tTopY = el.y + 6;
    const tBotY = el.y + el.height - 6;
    const tTopX = Math.round(cx + (cy - tTopY) * cot);
    const tBotX = Math.round(cx - (tBotY - cy) * cot);

    let out = '';
    // Parallel Line 1 & Line 2 with double arrows
    out += `<line x1="${xLeft}" y1="${y1}" x2="${xRight}" y2="${y1}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>`;
    out += `<line x1="${xLeft}" y1="${y2}" x2="${xRight}" y2="${y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>`;
    out += renderLineCapSvg(xLeft, y1, Math.PI, 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(xRight, y1, 0, 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(xLeft, y2, Math.PI, 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(xRight, y2, 0, 'arrow', el.stroke, el.strokeWidth * 0.85);

    // Parallel chevron marks (>>) on both parallel lines
    if (showParallelMarks) {
      const pmX = Math.round(el.x + el.width * 0.22);
      [y1, y2].forEach(py => {
        out += `<polyline points="${pmX - 5},${py - 5} ${pmX + 1},${py} ${pmX - 5},${py + 5}" fill="none" stroke="${el.stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
        out += `<polyline points="${pmX + 1},${py - 5} ${pmX + 7},${py} ${pmX + 1},${py + 5}" fill="none" stroke="${el.stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      });
    }

    // Line labels
    if (l1Label) {
      out += `<text x="${xRight - 6}" y="${y1 - 12}" font-size="12" font-weight="bold" fill="#334155" text-anchor="end" font-family="Sarabun, sans-serif">${escapeXml(l1Label)}</text>`;
    }
    if (l2Label) {
      out += `<text x="${xRight - 6}" y="${y2 - 12}" font-size="12" font-weight="bold" fill="#334155" text-anchor="end" font-family="Sarabun, sans-serif">${escapeXml(l2Label)}</text>`;
    }

    // Transversal line
    out += `<line x1="${tBotX}" y1="${tBotY}" x2="${tTopX}" y2="${tTopY}" stroke="#1e293b" stroke-width="${el.strokeWidth}"/>`;
    out += renderLineCapSvg(tTopX, tTopY, -rad, 'arrow', '#1e293b', el.strokeWidth * 0.85);
    out += renderLineCapSvg(tBotX, tBotY, Math.PI - rad, 'arrow', '#1e293b', el.strokeWidth * 0.85);

    // Angle arcs at intersections I1(ix1, iy1) and I2(ix2, iy2)
    // In SVG screen coords (0° = right, 90° = down, 180° = left, -transAngle = up-right, 180-transAngle = down-left):
    const arcR = 24;
    const upTransDeg = -transAngle; // e.g. -65°
    const downTransDeg = 180 - transAngle; // e.g. 115°

    if (angleMode === 'alternate_interior') {
      // Interior bottom-left of I1 (from downTransDeg to 180°) & Interior top-right of I2 (from upTransDeg to 0°)
      out += renderArcBetweenAnglesSvg(ix1, iy1, arcR, downTransDeg, 180, '#2563eb', topLabel);
      out += renderArcBetweenAnglesSvg(ix2, iy2, arcR, upTransDeg, 0, '#dc2626', bottomLabel);
    } else if (angleMode === 'corresponding') {
      // Top-right of I1 (from upTransDeg to 0°) & Top-right of I2 (from upTransDeg to 0°)
      out += renderArcBetweenAnglesSvg(ix1, iy1, arcR, upTransDeg, 0, '#2563eb', topLabel);
      out += renderArcBetweenAnglesSvg(ix2, iy2, arcR, upTransDeg, 0, '#dc2626', bottomLabel);
    } else if (angleMode === 'co_interior') {
      // Interior bottom-right of I1 (from 0° to downTransDeg) & Interior top-right of I2 (from upTransDeg to 0°)
      out += renderArcBetweenAnglesSvg(ix1, iy1, arcR, 0, downTransDeg, '#7c3aed', topLabel, true);
      out += renderArcBetweenAnglesSvg(ix2, iy2, arcR, upTransDeg, 0, '#dc2626', bottomLabel);
    } else if (angleMode === 'alternate_exterior') {
      // Exterior top-right of I1 (from upTransDeg to 0°) & Exterior bottom-left of I2 (from downTransDeg to 180°)
      out += renderArcBetweenAnglesSvg(ix1, iy1, arcR, upTransDeg, 0, '#2563eb', topLabel);
      out += renderArcBetweenAnglesSvg(ix2, iy2, arcR, downTransDeg, 180, '#dc2626', bottomLabel);
    } else if (angleMode === 'all_angles') {
      const supDeg = 180 - transAngle;
      out += renderArcBetweenAnglesSvg(ix1, iy1, 21, upTransDeg, 0, '#2563eb', `${transAngle}°`);
      out += renderArcBetweenAnglesSvg(ix1, iy1, 24, 180, 360 + upTransDeg, '#7c3aed', `${supDeg}°`, true);
      out += renderArcBetweenAnglesSvg(ix1, iy1, 21, downTransDeg, 180, '#2563eb', `${transAngle}°`);
      out += renderArcBetweenAnglesSvg(ix2, iy2, 21, upTransDeg, 0, '#dc2626', bottomLabel || `${transAngle}°`);
      out += renderArcBetweenAnglesSvg(ix2, iy2, 24, 0, downTransDeg, '#7c3aed', `${supDeg}°`, true);
    }

    // Intersection vertex dots
    out += `<circle cx="${ix1}" cy="${iy1}" r="3" fill="#0f172a"/>`;
    out += `<circle cx="${ix2}" cy="${iy2}" r="3" fill="#0f172a"/>`;
    return out;
  }

  if (el.type === 'intersecting_lines') {
    const angle = Math.max(15, Math.min(165, el.extraProps?.angle ?? 60));
    const halfRad = ((angle / 2) * Math.PI) / 180;
    const rx = el.width * 0.46;
    const ry = el.height * 0.46;
    const r = Math.min(rx, ry);

    // Line 1 at -angle/2, Line 2 at +angle/2
    const l1x1 = Math.round(cx - rx * Math.cos(-halfRad));
    const l1y1 = Math.round(cy - ry * Math.sin(-halfRad));
    const l1x2 = Math.round(cx + rx * Math.cos(-halfRad));
    const l1y2 = Math.round(cy + ry * Math.sin(-halfRad));

    const l2x1 = Math.round(cx - rx * Math.cos(halfRad));
    const l2y1 = Math.round(cy - ry * Math.sin(halfRad));
    const l2x2 = Math.round(cx + rx * Math.cos(halfRad));
    const l2y2 = Math.round(cy + ry * Math.sin(halfRad));

    const a1Deg = Math.atan2(l1y2 - cy, l1x2 - cx) * (180 / Math.PI); // negative
    const a2Deg = Math.atan2(l2y2 - cy, l2x2 - cx) * (180 / Math.PI); // positive
    const arcR = Math.min(28, r * 0.36);

    const rightLab = el.extraProps?.rightLabel ?? `${angle}°`;
    const leftLab = el.extraProps?.leftLabel ?? 'x';
    const topLab = el.extraProps?.topLabel ?? '';
    const bottomLab = el.extraProps?.bottomLabel ?? '';

    let out = '';
    // Arcs in 4 quadrants
    if (rightLab) {
      out += renderArcBetweenAnglesSvg(cx, cy, arcR, a1Deg, a2Deg, '#2563eb', rightLab);
    }
    if (leftLab) {
      out += renderArcBetweenAnglesSvg(cx, cy, arcR, a1Deg + 180, a2Deg + 180, '#dc2626', leftLab);
    }
    if (topLab) {
      out += renderArcBetweenAnglesSvg(cx, cy, arcR + 4, a2Deg + 180, a1Deg + 360, '#7c3aed', topLab, true);
    }
    if (bottomLab) {
      out += renderArcBetweenAnglesSvg(cx, cy, arcR + 4, a2Deg, a1Deg + 180, '#7c3aed', bottomLab, true);
    }

    // Two crossing lines with arrows
    out += `<line x1="${l1x1}" y1="${l1y1}" x2="${l1x2}" y2="${l1y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>`;
    out += `<line x1="${l2x1}" y1="${l2y1}" x2="${l2x2}" y2="${l2y2}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>`;
    out += renderLineCapSvg(l1x1, l1y1, Math.atan2(l1y1 - cy, l1x1 - cx), 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(l1x2, l1y2, Math.atan2(l1y2 - cy, l1x2 - cx), 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(l2x1, l2y1, Math.atan2(l2y1 - cy, l2x1 - cx), 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += renderLineCapSvg(l2x2, l2y2, Math.atan2(l2y2 - cy, l2x2 - cx), 'arrow', el.stroke, el.strokeWidth * 0.85);
    out += `<circle cx="${cx}" cy="${cy}" r="3.2" fill="#0f172a"/>`;
    return out;
  }

  return '';
}

export function InStudioDiagramBuilderModal({
  isOpen,
  onClose,
  onInsert,
  initialSvg
}: InStudioDiagramBuilderProps) {
  // Canvas Dimensions
  const CANVAS_WIDTH = 720;
  const CANVAS_HEIGHT = 440;

  type CategoryType = 'shapes' | 'solids' | 'math' | 'science' | 'diagrams' | 'templates' | 'image';
  const [activeCategory, setActiveCategory] = useState<CategoryType>('shapes');

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Synchronized element ref to prevent stale closures and event re-bind thrashing
  const elementsRef = useRef<CanvasElement[]>(elements);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Ref for Inspector text input so double-clicking an element focuses it immediately
  const inspectorTextInputRef = useRef<HTMLInputElement | null>(null);

  // Canvas & Grid Alignment Settings
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [showSmartGuides, setShowSmartGuides] = useState<boolean>(true);
  const [activeGuides, setActiveGuides] = useState<{ verticals: number[]; horizontals: number[] }>({ verticals: [], horizontals: [] });
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);

  // Interactive Mouse Drawing Mode State
  type ToolMode = 'select' | 'draw_line' | 'draw_smart' | 'draw_polygon';
  const [toolMode, setToolMode] = useState<ToolMode>('select');
  const [drawPresetCapStart, setDrawPresetCapStart] = useState<string>('none');
  const [drawPresetCapEnd, setDrawPresetCapEnd] = useState<string>('none');
  const [drawPresetLineShape, setDrawPresetLineShape] = useState<string>('straight');
  const [isDrawingStroke, setIsDrawingStroke] = useState<boolean>(false);
  const [drawPoints, setDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [polygonCursorPos, setPolygonCursorPos] = useState<{ x: number; y: number } | null>(null);

  // History for Undo/Redo
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStartScreen, setDragStartScreen] = useState({ x: 0, y: 0 });
  const [elementStart, setElementStart] = useState<CanvasElement | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  // Canvas Reference
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Convert screen coordinates to canvas space
  const getCanvasCoords = useCallback((screenX: number, screenY: number) => {
    if (!svgRef.current) return { x: screenX, y: screenY };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / (rect.width || 1);
    const scaleY = CANVAS_HEIGHT / (rect.height || 1);
    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY
    };
  }, []);

  // Save to history stack
  const saveToHistory = useCallback((newElements: CanvasElement[]) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(newElements);
    if (updatedHistory.length > 40) updatedHistory.shift();
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setElements(newElements);
    elementsRef.current = newElements;
  }, [history, historyIndex]);

  // Load initialSvg or default preset
  useEffect(() => {
    if (!isOpen) return;

    if (initialSvg && typeof initialSvg === 'string') {
      const match = initialSvg.match(/<!-- sv-diagram-meta: (.*?) -->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setElements(parsed);
            elementsRef.current = parsed;
            setHistory([parsed]);
            setHistoryIndex(0);
            setSelectedId(null);
            return;
          }
        } catch {
          // ignore parsing error and fallback
        }
      }

      // If initialSvg does NOT have metadata comment, preserve it as an image_overlay
      // to ensure no teacher work is ever lost!
      const dataUri = 'data:image/svg+xml;utf8,' + encodeURIComponent(initialSvg);
      const fallbackOverlay: CanvasElement = {
        id: `imported-base-${Date.now()}`,
        type: 'image_overlay',
        x: 40,
        y: 20,
        width: 640,
        height: 400,
        rotation: 0,
        stroke: 'none',
        strokeWidth: 0,
        fill: 'transparent',
        imageUrl: dataUri
      };
      setElements([fallbackOverlay]);
      elementsRef.current = [fallbackOverlay];
      setHistory([[fallbackOverlay]]);
      setHistoryIndex(0);
      setSelectedId(fallbackOverlay.id);
      return;
    }

    if (elements.length === 0) {
      loadPresetTemplate('right_triangle');
    }
  }, [isOpen, initialSvg]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      const prevElements = history[prevIdx];
      setElements(prevElements);
      elementsRef.current = prevElements;
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      const nextElements = history[nextIdx];
      setElements(nextElements);
      elementsRef.current = nextElements;
    }
  }, [historyIndex, history]);

  // Add Element to Canvas
  const addElement = (type: CanvasElementType, customProps: Partial<CanvasElement> = {}) => {
    const id = `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const base: CanvasElement = {
      id,
      type,
      x: 270,
      y: 150,
      width: 140,
      height: 100,
      rotation: 0,
      flipH: false,
      flipV: false,
      stroke: '#0f172a',
      strokeWidth: 2,
      fill: '#f8fafc',
      fillOpacity: 1,
      strokeOpacity: 1,
      fontSize: 14,
      fontWeight: 'bold',
      fontFamily: 'Sarabun, sans-serif',
      textAlign: 'center',
      ...customProps
    };

    // Preset defaults for specific shapes
    switch (type) {
      case 'circle':
        base.width = 110;
        base.height = 110;
        break;
      case 'star_5':
        base.width = 120;
        base.height = 120;
        base.fill = '#fef08a';
        break;
      case 'right_triangle':
        base.width = 160;
        base.height = 120;
        base.extraProps = { orientation: 'bottom-left', showRightAngle: true, ...customProps.extraProps };
        break;
      case 'parallelogram':
        base.width = 160;
        base.height = 100;
        base.extraProps = { slant: 32, ...customProps.extraProps };
        break;
      case 'trapezoid':
        base.width = 160;
        base.height = 100;
        base.extraProps = { topInset: 32, ...customProps.extraProps };
        break;
      case 'line':
        base.width = customProps.width ?? 180;
        base.height = customProps.height ?? 24;
        base.fill = 'none';
        base.text = customProps.text ?? '';
        base.extraProps = {
          x1: base.x,
          y1: base.y + base.height / 2,
          x2: base.x + base.width,
          y2: base.y + base.height / 2,
          startCap: 'none',
          endCap: 'none',
          lineShape: 'straight',
          curveOffset: -45,
          zigzagCount: 6,
          ...customProps.extraProps
        };
        break;
      case 'arrow':
        base.width = customProps.width ?? 180;
        base.height = customProps.height ?? 24;
        base.fill = 'none';
        base.text = customProps.text ?? '';
        base.extraProps = {
          x1: base.x,
          y1: base.y + base.height / 2,
          x2: base.x + base.width,
          y2: base.y + base.height / 2,
          startCap: 'none',
          endCap: 'arrow',
          lineShape: 'straight',
          curveOffset: -45,
          zigzagCount: 6,
          ...customProps.extraProps
        };
        break;
      case 'polygon_custom':
        base.width = customProps.width ?? 160;
        base.height = customProps.height ?? 120;
        base.fill = customProps.fill ?? '#f8fafc';
        base.text = customProps.text ?? '';
        base.extraProps = {
          points: [
            { x: 0.5, y: 0 },
            { x: 1, y: 0.85 },
            { x: 0, y: 0.85 }
          ],
          closed: true,
          startCap: 'none',
          endCap: 'none',
          showVertexAngles: false,
          ...customProps.extraProps
        };
        break;
      case 'parallel_transversal':
        base.width = customProps.width ?? 320;
        base.height = customProps.height ?? 210;
        base.fill = 'none';
        base.extraProps = {
          transversalAngle: 65,
          angleMode: 'alternate_interior',
          topAngleLabel: '65°',
          bottomAngleLabel: 'x',
          line1Label: 'AB',
          line2Label: 'CD',
          showParallelMarks: true,
          ...customProps.extraProps
        };
        break;
      case 'intersecting_lines':
        base.width = customProps.width ?? 220;
        base.height = customProps.height ?? 180;
        base.fill = 'none';
        base.extraProps = {
          angle: 60,
          rightLabel: '60°',
          leftLabel: 'x',
          topLabel: '120°',
          bottomLabel: '',
          ...customProps.extraProps
        };
        break;
      case 'dimension_line':
        base.width = 180;
        base.height = 36;
        base.text = customProps.text || '10 cm';
        break;
      case 'angle_arc':
        base.width = 120;
        base.height = 100;
        base.fill = 'transparent';
        base.text = customProps.text || '60°';
        base.extraProps = { angle: 60, radius: 45, showDegree: true, ...customProps.extraProps };
        break;
      case 'number_line':
        base.width = 380;
        base.height = 50;
        base.fill = 'none';
        base.extraProps = { min: -5, max: 5, step: 1, markerValue: 2, markerType: 'closed', inequalityRay: 'none', ...customProps.extraProps };
        break;
      case 'axes_xy':
        base.width = 240;
        base.height = 200;
        base.fill = 'none';
        base.extraProps = { showGrid: true, showArrows: true, xLabel: 'X', yLabel: 'Y', originLabel: 'O', ...customProps.extraProps };
        break;
      case 'analog_clock':
        base.width = 140;
        base.height = 140;
        base.fill = '#ffffff';
        base.extraProps = { hour: 3, minute: 15, showNumbers: true, showMinuteTicks: true, ...customProps.extraProps };
        break;
      case 'fraction_bar':
        base.width = 240;
        base.height = 56;
        base.fill = '#ffffff';
        base.extraProps = { totalParts: 4, shadedParts: 3, shadedColor: '#3b82f6', showLabels: false, ...customProps.extraProps };
        break;
      case 'fraction_circle':
        base.width = 130;
        base.height = 130;
        base.fill = '#ffffff';
        base.extraProps = { totalParts: 4, shadedParts: 1, shadedColor: '#3b82f6', ...customProps.extraProps };
        break;
      case 'bar_chart':
        base.width = 280;
        base.height = 190;
        base.fill = '#3b82f6';
        base.extraProps = { data: '15, 30, 20, 40', labels: 'ม.1, ม.2, ม.3, ม.4', chartTitle: 'แผนภูมิแท่งแสดงจำนวน', showValues: true, yAxisMax: 50, ...customProps.extraProps };
        break;
      case 'ruler_cm':
        base.width = 320;
        base.height = 65;
        base.fill = '#fefce8';
        base.extraProps = { cmLength: 10, showMm: true, measureObjectLength: 6.5, objectLabel: 'ดินสอ', ...customProps.extraProps };
        break;
      case 'circuit_bulb':
        base.width = 50;
        base.height = 50;
        base.fill = '#ffffff';
        base.extraProps = { glowing: false, ...customProps.extraProps };
        break;
      case 'circuit_battery':
        base.width = 50;
        base.height = 36;
        base.fill = '#ffffff';
        base.extraProps = { flipped: false, ...customProps.extraProps };
        break;
      case 'circuit_switch':
        base.width = 54;
        base.height = 30;
        base.fill = '#ffffff';
        base.extraProps = { isOpen: true, ...customProps.extraProps };
        break;
      case 'circuit_resistor':
        base.width = 80;
        base.height = 32;
        base.fill = 'none';
        base.extraProps = { resistorValue: '10 Ω', ...customProps.extraProps };
        break;
      case 'science_beaker':
        base.width = 80;
        base.height = 130;
        base.fill = '#e0f2fe';
        base.extraProps = { liquidLevel: 60, liquidColor: '#bae6fd', ...customProps.extraProps };
        break;
      case 'science_test_tube':
        base.width = 50;
        base.height = 140;
        base.fill = '#e0f2fe';
        base.extraProps = { liquidLevel: 70, liquidColor: '#bae6fd', ...customProps.extraProps };
        break;
      case 'science_flask':
        base.width = 90;
        base.height = 130;
        base.fill = '#e0f2fe';
        base.extraProps = { liquidLevel: 50, liquidColor: '#bae6fd', ...customProps.extraProps };
        break;
      case 'thermometer':
        base.width = 65;
        base.height = 180;
        base.fill = '#ffffff';
        base.extraProps = { temperature: 37, minTemp: 0, maxTemp: 100, unit: '°C', liquidColor: '#ef4444', ...customProps.extraProps };
        break;
      case 'balance_scale':
        base.width = 240;
        base.height = 150;
        base.fill = '#f8fafc';
        base.extraProps = { tilt: 'even', leftWeight: '500 g', rightWeight: '500 g', ...customProps.extraProps };
        break;
      case 'science_incline':
        base.width = 170;
        base.height = 110;
        base.fill = '#f1f5f9';
        base.extraProps = { angle: 30, massLabel: '2 kg', ...customProps.extraProps };
        break;
      case 'science_magnet':
        base.width = 110;
        base.height = 42;
        base.extraProps = { flipped: false, ...customProps.extraProps };
        break;
      case 'flowchart_terminator':
        base.width = 140;
        base.height = 54;
        base.fill = '#dbeafe';
        base.text = customProps.text || 'เริ่มต้น / สิ้นสุด';
        break;
      case 'flowchart_process':
        base.width = 150;
        base.height = 60;
        base.fill = '#f8fafc';
        base.text = customProps.text || 'ประมวลผล';
        break;
      case 'flowchart_decision':
        base.width = 150;
        base.height = 90;
        base.fill = '#fef9c3';
        base.text = customProps.text || 'เงื่อนไข?';
        break;
      case 'flowchart_data':
        base.width = 150;
        base.height = 60;
        base.fill = '#dcfce7';
        base.text = customProps.text || 'รับข้อมูล';
        break;
      case 'speech_bubble':
        base.width = 160;
        base.height = 95;
        base.fill = '#ffffff';
        base.text = customProps.text || 'ข้อความ...';
        base.extraProps = { tailDirection: 'bottom-left', ...customProps.extraProps };
        break;
      case 'venn_2':
        base.width = 260;
        base.height = 160;
        base.fill = 'none';
        base.extraProps = { labelA: 'A', labelB: 'B', highlightRegion: 'none', ...customProps.extraProps };
        break;
      case 'venn_3':
        base.width = 240;
        base.height = 220;
        base.fill = 'none';
        base.extraProps = { labelA: 'A', labelB: 'B', labelC: 'C', ...customProps.extraProps };
        break;
      case 'timeline':
        base.width = 380;
        base.height = 60;
        base.fill = 'none';
        base.extraProps = { pointCount: 4, ...customProps.extraProps };
        break;
      case 'table_grid':
        base.width = 280;
        base.height = 140;
        base.fill = '#ffffff';
        base.extraProps = { rows: 3, cols: 3, hasHeader: true, dataMatrix: 'หัวข้อ 1, หัวข้อ 2, หัวข้อ 3|ข้อมูล A1, ข้อมูล A2, ข้อมูล A3|ข้อมูล B1, ข้อมูล B2, ข้อมูล B3', ...customProps.extraProps };
        break;
      case 'text_label':
      case 'math_label':
        base.width = 120;
        base.height = 34;
        base.text = customProps.text || 'ข้อความกำกับ';
        base.fill = 'transparent';
        base.stroke = 'none';
        break;
    }

    const updated = [...elementsRef.current, base];
    saveToHistory(updated);
    setSelectedId(id);
  };

  // Load Preset Templates
  const loadPresetTemplate = (templateName: string) => {
    let preset: CanvasElement[] = [];

    if (templateName === 'right_triangle') {
      preset = [
        {
          id: 'tri-1',
          type: 'right_triangle',
          x: 180,
          y: 90,
          width: 260,
          height: 180,
          rotation: 0,
          stroke: '#0f172a',
          strokeWidth: 2.5,
          fill: '#f8fafc',
          extraProps: { orientation: 'bottom-left', showRightAngle: true }
        },
        {
          id: 'txt-a',
          type: 'text_label',
          x: 290,
          y: 290,
          width: 80,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: '8 cm',
          fontSize: 15,
          fontWeight: 'bold'
        },
        {
          id: 'txt-b',
          type: 'text_label',
          x: 130,
          y: 175,
          width: 80,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: '6 cm',
          fontSize: 15,
          fontWeight: 'bold'
        },
        {
          id: 'txt-c',
          type: 'text_label',
          x: 320,
          y: 160,
          width: 80,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: '? cm',
          fontSize: 16,
          fontWeight: 'bold'
        }
      ];
    } else if (templateName === 'venn_2') {
      preset = [
        {
          id: 'v-box',
          type: 'rect',
          x: 120,
          y: 60,
          width: 480,
          height: 260,
          rotation: 0,
          stroke: '#334155',
          strokeWidth: 2,
          fill: '#ffffff'
        },
        {
          id: 'v-u',
          type: 'text_label',
          x: 135,
          y: 75,
          width: 30,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: 'U',
          fontSize: 16,
          fontWeight: 'bold'
        },
        {
          id: 'v-c1',
          type: 'circle',
          x: 210,
          y: 110,
          width: 170,
          height: 170,
          rotation: 0,
          stroke: '#0f172a',
          strokeWidth: 2.2,
          fill: 'none'
        },
        {
          id: 'v-c2',
          type: 'circle',
          x: 330,
          y: 110,
          width: 170,
          height: 170,
          rotation: 0,
          stroke: '#0f172a',
          strokeWidth: 2.2,
          fill: 'none'
        },
        {
          id: 'v-la',
          type: 'text_label',
          x: 250,
          y: 125,
          width: 40,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: 'A',
          fontSize: 15,
          fontWeight: 'bold'
        },
        {
          id: 'v-lb',
          type: 'text_label',
          x: 420,
          y: 125,
          width: 40,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: 'B',
          fontSize: 15,
          fontWeight: 'bold'
        }
      ];
    } else if (templateName === 'circuit_simple') {
      preset = [
        {
          id: 'wire-loop',
          type: 'rect',
          x: 160,
          y: 90,
          width: 400,
          height: 220,
          rotation: 0,
          stroke: '#1e293b',
          strokeWidth: 2.5,
          fill: 'none',
          rx: 6
        },
        {
          id: 'bat-1',
          type: 'circuit_battery',
          x: 340,
          y: 75,
          width: 40,
          height: 30,
          rotation: 0,
          stroke: '#1e293b',
          strokeWidth: 2.5,
          fill: '#ffffff',
          extraProps: { flipped: false }
        },
        {
          id: 'bulb-1',
          type: 'circuit_bulb',
          x: 540,
          y: 180,
          width: 40,
          height: 40,
          rotation: 0,
          stroke: '#1e293b',
          strokeWidth: 2.2,
          fill: '#fef08a',
          extraProps: { glowing: true }
        },
        {
          id: 'sw-1',
          type: 'circuit_switch',
          x: 340,
          y: 295,
          width: 40,
          height: 30,
          rotation: 0,
          stroke: '#1e293b',
          strokeWidth: 2.5,
          fill: '#ffffff',
          extraProps: { isOpen: false }
        }
      ];
    } else if (templateName === 'axes_linear') {
      preset = [
        {
          id: 'axes-1',
          type: 'axes_xy',
          x: 200,
          y: 80,
          width: 320,
          height: 260,
          rotation: 0,
          stroke: '#334155',
          strokeWidth: 2,
          fill: 'none',
          extraProps: { showGrid: true, showArrows: true, xLabel: 'X', yLabel: 'Y', originLabel: 'O' }
        },
        {
          id: 'line-func',
          type: 'line',
          x: 220,
          y: 290,
          width: 280,
          height: 2,
          rotation: -35,
          stroke: '#b91c1c',
          strokeWidth: 2.5,
          fill: 'none'
        },
        {
          id: 'txt-eq',
          type: 'text_label',
          x: 430,
          y: 110,
          width: 100,
          height: 24,
          rotation: 0,
          stroke: 'none',
          strokeWidth: 0,
          fill: 'transparent',
          text: 'y = 2x + 1',
          fontSize: 15,
          fontWeight: 'bold'
        }
      ];
    } else if (templateName === 'parallel_transversal') {
      preset = [
        {
          id: 'pt-main',
          type: 'parallel_transversal',
          x: 190,
          y: 90,
          width: 340,
          height: 240,
          rotation: 0,
          stroke: '#0f172a',
          strokeWidth: 2.5,
          fill: 'none',
          extraProps: {
            transversalAngle: 65,
            angleMode: 'alternate_interior',
            topAngleLabel: '65°',
            bottomAngleLabel: '2x + 5°',
            line1Label: 'AB',
            line2Label: 'CD',
            showParallelMarks: true
          }
        }
      ];
    }

    saveToHistory(preset);
    setSelectedId(null);
    toast.success('โหลดเทมเพลตมาตรฐานเรียบร้อยแล้ว');
  };

  // Selected Element
  const selectedElement = useMemo(() => {
    return elements.find(el => el.id === selectedId) || null;
  }, [elements, selectedId]);

  // Live Line-Intersection & Angle Calculator across all line/arrow segments on canvas
  const lineIntersections = useMemo(() => {
    const lines = elements.filter(el => el.type === 'line' || el.type === 'arrow');
    const results: {
      id: string;
      lineAId: string;
      lineBId: string;
      x: number;
      y: number;
      acuteDeg: number;
      obtuseDeg: number;
    }[] = [];

    const getEndpoints = (el: CanvasElement) => {
      if (el.extraProps?.x1 !== undefined && el.extraProps?.x2 !== undefined) {
        return {
          p1: { x: Number(el.extraProps.x1), y: Number(el.extraProps.y1) },
          p2: { x: Number(el.extraProps.x2), y: Number(el.extraProps.y2) }
        };
      }
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rad = ((el.rotation || 0) * Math.PI) / 180;
      const hw = el.width / 2;
      return {
        p1: { x: cx - hw * Math.cos(rad), y: cy - hw * Math.sin(rad) },
        p2: { x: cx + hw * Math.cos(rad), y: cy + hw * Math.sin(rad) }
      };
    };

    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const segA = getEndpoints(lines[i]);
        const segB = getEndpoints(lines[j]);
        const inter = computeLineSegmentIntersection(segA.p1, segA.p2, segB.p1, segB.p2);
        if (inter) {
          results.push({
            id: `${lines[i].id}__${lines[j].id}`,
            lineAId: lines[i].id,
            lineBId: lines[j].id,
            x: inter.x,
            y: inter.y,
            acuteDeg: inter.acuteDeg,
            obtuseDeg: inter.obtuseDeg
          });
        }
      }
    }
    return results;
  }, [elements]);

  const handleStampIntersectionAngle = (inter: { x: number; y: number; acuteDeg: number; obtuseDeg: number }, useObtuse: boolean = false) => {
    const deg = useObtuse ? inter.obtuseDeg : inter.acuteDeg;
    addElement('angle_arc', {
      x: inter.x,
      y: inter.y - 60,
      width: 70,
      height: 60,
      text: `${deg}°`,
      extraProps: { angle: deg, radius: 28, showDegree: true }
    });
    toast.success(`ปักหมุดมุมเส้นตัด ${deg}° ที่จุดตัด (${inter.x}, ${inter.y}) เรียบร้อย`);
  };


  // Robust field updater using elementsRef to prevent stale closure bugs
  const updateSelectedField = (field: keyof CanvasElement, value: any, commit: boolean = true) => {
    if (!selectedId) return;
    const updated = elementsRef.current.map(el => {
      if (el.id === selectedId) {
        return { ...el, [field]: value };
      }
      return el;
    });
    setElements(updated);
    elementsRef.current = updated;
    if (commit) {
      saveToHistory(updated);
    }
  };

  // Update element extraProps
  const updateSelectedExtraProp = (propName: string, value: any, commit: boolean = true) => {
    if (!selectedId) return;
    const updated = elementsRef.current.map(el => {
      if (el.id === selectedId) {
        const nextExtra = { ...(el.extraProps || {}), [propName]: value };
        return { ...el, extraProps: nextExtra };
      }
      return el;
    });
    setElements(updated);
    elementsRef.current = updated;
    if (commit) {
      saveToHistory(updated);
    }
  };

  // Delete Selected
  const handleDeleteSelected = () => {
    if (!selectedId) return;
    const updated = elementsRef.current.filter(el => el.id !== selectedId);
    saveToHistory(updated);
    setSelectedId(null);
  };

  // Duplicate Selected
  const handleDuplicateSelected = () => {
    if (!selectedElement) return;
    const nextExtra = selectedElement.extraProps ? { ...selectedElement.extraProps } : undefined;
    if (nextExtra && nextExtra.x1 !== undefined && nextExtra.x2 !== undefined) {
      nextExtra.x1 += 20;
      nextExtra.y1 += 20;
      nextExtra.x2 += 20;
      nextExtra.y2 += 20;
    }
    const clone: CanvasElement = {
      ...selectedElement,
      id: `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: selectedElement.x + 20,
      y: selectedElement.y + 20,
      extraProps: nextExtra
    };
    saveToHistory([...elementsRef.current, clone]);
    setSelectedId(clone.id);
  };

  // Layer Ordering
  const handleMoveLayer = (direction: 'front' | 'back' | 'forward' | 'backward') => {
    if (!selectedId) return;
    const currentList = [...elementsRef.current];
    const idx = currentList.findIndex(el => el.id === selectedId);
    if (idx === -1) return;

    const target = currentList.splice(idx, 1)[0];
    if (direction === 'front') {
      currentList.push(target);
    } else if (direction === 'back') {
      currentList.unshift(target);
    } else if (direction === 'forward') {
      currentList.splice(Math.min(idx + 1, currentList.length), 0, target);
    } else if (direction === 'backward') {
      currentList.splice(Math.max(idx - 1, 0), 0, target);
    }

    saveToHistory(currentList);
  };

  // Alignment Tools (Word / Canva style + Grid Snap)
  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'snap_grid') => {
    if (!selectedElement) return;
    let newX = selectedElement.x;
    let newY = selectedElement.y;

    if (type === 'left') newX = 20;
    else if (type === 'center') newX = Math.round((CANVAS_WIDTH - selectedElement.width) / 2);
    else if (type === 'right') newX = CANVAS_WIDTH - selectedElement.width - 20;
    else if (type === 'top') newY = 20;
    else if (type === 'middle') newY = Math.round((CANVAS_HEIGHT - selectedElement.height) / 2);
    else if (type === 'bottom') newY = CANVAS_HEIGHT - selectedElement.height - 20;
    else if (type === 'snap_grid') {
      newX = Math.round(selectedElement.x / gridSize) * gridSize;
      newY = Math.round(selectedElement.y / gridSize) * gridSize;
    }

    const dx = newX - selectedElement.x;
    const dy = newY - selectedElement.y;

    const updated = elementsRef.current.map(el => {
      if (el.id !== selectedElement.id) return el;
      const nextExtra = el.extraProps ? { ...el.extraProps } : undefined;
      if (nextExtra && nextExtra.x1 !== undefined && nextExtra.x2 !== undefined) {
        nextExtra.x1 = type === 'snap_grid' ? Math.round(nextExtra.x1 / gridSize) * gridSize : nextExtra.x1 + dx;
        nextExtra.y1 = type === 'snap_grid' ? Math.round(nextExtra.y1 / gridSize) * gridSize : nextExtra.y1 + dy;
        nextExtra.x2 = type === 'snap_grid' ? Math.round(nextExtra.x2 / gridSize) * gridSize : nextExtra.x2 + dx;
        nextExtra.y2 = type === 'snap_grid' ? Math.round(nextExtra.y2 / gridSize) * gridSize : nextExtra.y2 + dy;
      }
      return { ...el, x: newX, y: newY, extraProps: nextExtra };
    });
    saveToHistory(updated);
  };

  // Snap a point (x, y) to Grid, Cardinal Angles (relative to anchor), and Smart Guides
  const snapPointWithGuides = useCallback((
    rawPt: { x: number; y: number },
    ignoreId?: string | null,
    anchorPt?: { x: number; y: number } | null,
    shiftHeld?: boolean
  ) => {
    let x = Math.round(rawPt.x);
    let y = Math.round(rawPt.y);

    // 1. Grid Snap
    if (snapToGrid) {
      x = Math.round(x / gridSize) * gridSize;
      y = Math.round(y / gridSize) * gridSize;
    }

    // 2. Angle Snap relative to anchorPt (for straight line drawing / endpoint dragging)
    if (anchorPt) {
      const dx = x - anchorPt.x;
      const dy = y - anchorPt.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        const deg = Math.atan2(dy, dx) * (180 / Math.PI);
        const snapAngles = [0, 30, 45, 60, 90, 120, 135, 150, 180, -30, -45, -60, -90, -120, -135, -150, -180];
        if (shiftHeld) {
          const lockedDeg = Math.round(deg / 15) * 15;
          const lockedRad = (lockedDeg * Math.PI) / 180;
          x = Math.round(anchorPt.x + dist * Math.cos(lockedRad));
          y = Math.round(anchorPt.y + dist * Math.sin(lockedRad));
        } else {
          for (const targetDeg of snapAngles) {
            if (Math.abs(deg - targetDeg) <= 3.5) {
              const targetRad = (targetDeg * Math.PI) / 180;
              if (targetDeg === 0 || Math.abs(targetDeg) === 180) {
                y = anchorPt.y;
              } else if (Math.abs(targetDeg) === 90) {
                x = anchorPt.x;
              } else {
                x = Math.round(anchorPt.x + dist * Math.cos(targetRad));
                y = Math.round(anchorPt.y + dist * Math.sin(targetRad));
              }
              break;
            }
          }
        }
      }
    }

    // 3. Smart Alignment Guides against Canvas Center and Other Elements
    const verticals: number[] = [];
    const horizontals: number[] = [];

    if (showSmartGuides) {
      const xTargets: number[] = [CANVAS_WIDTH / 2];
      const yTargets: number[] = [CANVAS_HEIGHT / 2];

      elementsRef.current.forEach(other => {
        if (other.id === ignoreId) return;
        xTargets.push(other.x, Math.round(other.x + other.width / 2), other.x + other.width);
        yTargets.push(other.y, Math.round(other.y + other.height / 2), other.y + other.height);
        if (other.extraProps?.x1 !== undefined) {
          xTargets.push(other.extraProps.x1, other.extraProps.x2);
          yTargets.push(other.extraProps.y1, other.extraProps.y2);
        }
      });

      const threshold = 6;
      for (const tx of xTargets) {
        if (Math.abs(x - tx) <= threshold) {
          x = tx;
          if (!verticals.includes(tx)) verticals.push(tx);
          break;
        }
      }
      for (const ty of yTargets) {
        if (Math.abs(y - ty) <= threshold) {
          y = ty;
          if (!horizontals.includes(ty)) horizontals.push(ty);
          break;
        }
      }
    }

    return { x, y, verticals, horizontals };
  }, [snapToGrid, gridSize, showSmartGuides]);

  // Finish Point-to-Point Polygon / Polyline Drawing
  const finishPolygonDrawing = useCallback((closed: boolean) => {
    if (drawPoints.length < 2) {
      setDrawPoints([]);
      setPolygonCursorPos(null);
      return;
    }
    const xs = drawPoints.map(p => p.x);
    const ys = drawPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = Math.max(24, maxX - minX);
    const h = Math.max(24, maxY - minY);
    const normPts = drawPoints.map(p => ({
      x: Number(((p.x - minX) / w).toFixed(4)),
      y: Number(((p.y - minY) / h).toFixed(4))
    }));

    addElement('polygon_custom', {
      x: minX,
      y: minY,
      width: w,
      height: h,
      fill: closed ? '#f8fafc' : 'none',
      extraProps: {
        points: normPts,
        closed,
        startCap: drawPresetCapStart,
        endCap: drawPresetCapEnd
      }
    });
    setDrawPoints([]);
    setPolygonCursorPos(null);
    setActiveGuides({ verticals: [], horizontals: [] });
  }, [drawPoints, drawPresetCapStart, drawPresetCapEnd]);

  // Interactive Canvas Mouse Down for Drawing Modes (draw_line, draw_smart, draw_polygon)
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode === 'select') {
      setSelectedId(null);
      return;
    }
    e.stopPropagation();
    const rawPos = getCanvasCoords(e.clientX, e.clientY);

    if (toolMode === 'draw_polygon') {
      const anchor = drawPoints.length > 0 ? drawPoints[drawPoints.length - 1] : null;
      const snapped = snapPointWithGuides(rawPos, null, anchor, e.shiftKey);
      // If clicking near first point and >= 3 points, close polygon automatically
      if (drawPoints.length >= 3 && Math.hypot(snapped.x - drawPoints[0].x, snapped.y - drawPoints[0].y) <= 14) {
        finishPolygonDrawing(true);
        return;
      }
      setDrawPoints(prev => [...prev, { x: snapped.x, y: snapped.y }]);
      setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });
      return;
    }

    // draw_line or draw_smart
    const snapped = snapPointWithGuides(rawPos, null, null, e.shiftKey);
    setIsDrawingStroke(true);
    setDrawPoints([{ x: snapped.x, y: snapped.y }]);
    setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode === 'select') return;
    const rawPos = getCanvasCoords(e.clientX, e.clientY);

    if (toolMode === 'draw_polygon') {
      if (drawPoints.length === 0) return;
      const anchor = drawPoints[drawPoints.length - 1];
      const snapped = snapPointWithGuides(rawPos, null, anchor, e.shiftKey);
      setPolygonCursorPos({ x: snapped.x, y: snapped.y });
      setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });
      return;
    }

    if (!isDrawingStroke || drawPoints.length === 0) return;

    if (toolMode === 'draw_line') {
      const startPt = drawPoints[0];
      const snapped = snapPointWithGuides(rawPos, null, startPt, e.shiftKey);
      setDrawPoints([startPt, { x: snapped.x, y: snapped.y }]);
      setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });
    } else if (toolMode === 'draw_smart') {
      const lastPt = drawPoints[drawPoints.length - 1];
      if (Math.hypot(rawPos.x - lastPt.x, rawPos.y - lastPt.y) >= 4) {
        setDrawPoints(prev => [...prev, { x: Math.round(rawPos.x), y: Math.round(rawPos.y) }]);
      }
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode === 'select' || toolMode === 'draw_polygon') return;
    if (!isDrawingStroke) return;
    setIsDrawingStroke(false);
    setActiveGuides({ verticals: [], horizontals: [] });

    if (drawPoints.length < 2) {
      setDrawPoints([]);
      return;
    }

    if (toolMode === 'draw_line') {
      const p1 = drawPoints[0];
      const p2 = drawPoints[drawPoints.length - 1];
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 10) {
        setDrawPoints([]);
        return;
      }
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y) - 12;
      const w = Math.max(20, Math.abs(p2.x - p1.x));
      const h = Math.max(24, Math.abs(p2.y - p1.y) + 24);
      addElement(drawPresetCapEnd === 'arrow' ? 'arrow' : 'line', {
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: 0,
        extraProps: {
          x1: p1.x,
          y1: p1.y,
          x2: p2.x,
          y2: p2.y,
          startCap: drawPresetCapStart,
          endCap: drawPresetCapEnd,
          lineShape: drawPresetLineShape,
          curveOffset: -45,
          zigzagCount: 6
        }
      });
      setDrawPoints([]);
      return;
    }

    // Smart Freehand-to-Straight / Geometric Shape Recognizer (toolMode === 'draw_smart')
    const first = drawPoints[0];
    const last = drawPoints[drawPoints.length - 1];
    let totalLen = 0;
    for (let i = 1; i < drawPoints.length; i++) {
      totalLen += Math.hypot(drawPoints[i].x - drawPoints[i - 1].x, drawPoints[i].y - drawPoints[i - 1].y);
    }
    if (totalLen < 16) {
      setDrawPoints([]);
      return;
    }

    // Check if stroke is a single straight line (max deviation < threshold)
    let maxDev = 0;
    for (const pt of drawPoints) {
      maxDev = Math.max(maxDev, perpendicularDistance(pt, first, last));
    }
    const endDist = Math.hypot(last.x - first.x, last.y - first.y);

    if (endDist > 20 && maxDev <= Math.max(14, endDist * 0.09)) {
      const s1 = snapPointWithGuides(first, null, null, false);
      const s2 = snapPointWithGuides(last, null, s1, e.shiftKey);
      const minX = Math.min(s1.x, s2.x);
      const minY = Math.min(s1.y, s2.y) - 12;
      const w = Math.max(20, Math.abs(s2.x - s1.x));
      const h = Math.max(24, Math.abs(s2.y - s1.y) + 24);
      addElement(drawPresetCapEnd === 'arrow' ? 'arrow' : 'line', {
        x: minX,
        y: minY,
        width: w,
        height: h,
        rotation: 0,
        extraProps: {
          x1: s1.x,
          y1: s1.y,
          x2: s2.x,
          y2: s2.y,
          startCap: drawPresetCapStart,
          endCap: drawPresetCapEnd,
          lineShape: drawPresetLineShape,
          curveOffset: -45,
          zigzagCount: 6
        }
      });
      toast.success('แปลงเส้นวาดเป็นเส้นตรงเวกเตอร์เรียบร้อย');
      setDrawPoints([]);
      return;
    }

    // Check if stroke is a closed shape
    const isClosed = endDist <= Math.max(38, totalLen * 0.18) && drawPoints.length >= 6;
    const simplified = simplifyPointsRDP(drawPoints, Math.max(10, totalLen * 0.035));

    if (isClosed) {
      // Remove duplicate closing vertex
      const loopPts = simplified.length > 2 ? simplified.slice(0, simplified.length - 1) : simplified;
      const xs = drawPoints.map(p => p.x);
      const ys = drawPoints.map(p => p.y);
      const minX = Math.round(Math.min(...xs) / (snapToGrid ? gridSize : 1)) * (snapToGrid ? gridSize : 1);
      const maxX = Math.round(Math.max(...xs) / (snapToGrid ? gridSize : 1)) * (snapToGrid ? gridSize : 1);
      const minY = Math.round(Math.min(...ys) / (snapToGrid ? gridSize : 1)) * (snapToGrid ? gridSize : 1);
      const maxY = Math.round(Math.max(...ys) / (snapToGrid ? gridSize : 1)) * (snapToGrid ? gridSize : 1);
      const w = Math.max(30, maxX - minX);
      const h = Math.max(30, maxY - minY);

      // Check circularity
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const radii = drawPoints.map(p => Math.hypot((p.x - cx) / (w / 2 || 1), (p.y - cy) / (h / 2 || 1)));
      const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
      const stdR = Math.sqrt(radii.reduce((acc, r) => acc + (r - meanR) ** 2, 0) / radii.length);

      if (stdR < 0.16 && loopPts.length >= 5) {
        if (Math.abs(w - h) <= Math.max(w, h) * 0.22) {
          const d = Math.round((w + h) / 2);
          addElement('circle', { x: minX, y: minY, width: d, height: d });
          toast.success('แปลงเส้นวาดเป็นวงกลมอัตโนมัติ');
        } else {
          addElement('ellipse', { x: minX, y: minY, width: w, height: h });
          toast.success('แปลงเส้นวาดเป็นวงรีอัตโนมัติ');
        }
        setDrawPoints([]);
        return;
      }

      if (loopPts.length === 4) {
        addElement('rect', { x: minX, y: minY, width: w, height: h });
        toast.success('แปลงเส้นวาดเป็นสี่เหลี่ยมมุมฉากอัตโนมัติ');
        setDrawPoints([]);
        return;
      }

      // Snap vertices to grid if enabled and create a crisp closed polygon_custom
      const snappedLoop = loopPts.map(p => ({
        x: snapToGrid ? Math.round(p.x / gridSize) * gridSize : p.x,
        y: snapToGrid ? Math.round(p.y / gridSize) * gridSize : p.y
      }));
      const lxs = snappedLoop.map(p => p.x);
      const lys = snappedLoop.map(p => p.y);
      const pMinX = Math.min(...lxs);
      const pMaxX = Math.max(...lxs);
      const pMinY = Math.min(...lys);
      const pMaxY = Math.max(...lys);
      const pw = Math.max(24, pMaxX - pMinX);
      const ph = Math.max(24, pMaxY - pMinY);
      const normPts = snappedLoop.map(p => ({
        x: Number(((p.x - pMinX) / pw).toFixed(4)),
        y: Number(((p.y - pMinY) / ph).toFixed(4))
      }));

      addElement('polygon_custom', {
        x: pMinX,
        y: pMinY,
        width: pw,
        height: ph,
        fill: '#f8fafc',
        extraProps: { points: normPts, closed: true, startCap: 'none', endCap: 'none' }
      });
      toast.success(`แปลงเส้นวาดเป็นรูปทรง ${snappedLoop.length} เหลี่ยมเรียบร้อย`);
      setDrawPoints([]);
      return;
    }

    // Open Multi-segment Straightened Polyline
    const snappedPoly = simplified.map(p => ({
      x: snapToGrid ? Math.round(p.x / gridSize) * gridSize : p.x,
      y: snapToGrid ? Math.round(p.y / gridSize) * gridSize : p.y
    }));
    const pxs = snappedPoly.map(p => p.x);
    const pys = snappedPoly.map(p => p.y);
    const pMinX = Math.min(...pxs);
    const pMaxX = Math.max(...pxs);
    const pMinY = Math.min(...pys);
    const pMaxY = Math.max(...pys);
    const pw = Math.max(24, pMaxX - pMinX);
    const ph = Math.max(24, pMaxY - pMinY);
    const normPts = snappedPoly.map(p => ({
      x: Number(((p.x - pMinX) / pw).toFixed(4)),
      y: Number(((p.y - pMinY) / ph).toFixed(4))
    }));

    addElement('polygon_custom', {
      x: pMinX,
      y: pMinY,
      width: pw,
      height: ph,
      fill: 'none',
      extraProps: {
        points: normPts,
        closed: false,
        startCap: drawPresetCapStart,
        endCap: drawPresetCapEnd
      }
    });
    toast.success('แปลงเส้นวาดเป็นเส้นตรงต่อเนื่องเรียบร้อย');
    setDrawPoints([]);
  };

  // Quick Rotate shortcuts (-90, +90, -15, +15)
  const handleRotateDelta = (deltaDeg: number) => {
    if (!selectedElement) return;
    // If line/arrow has explicit endpoints x1,y1,x2,y2, rotate the endpoints around their midpoint
    if (['line', 'arrow'].includes(selectedElement.type) && selectedElement.extraProps?.x1 !== undefined) {
      const { x1, y1, x2, y2 } = selectedElement.extraProps;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const rad = (deltaDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const nx1 = Math.round(mx + (x1 - mx) * cos - (y1 - my) * sin);
      const ny1 = Math.round(my + (x1 - mx) * sin + (y1 - my) * cos);
      const nx2 = Math.round(mx + (x2 - mx) * cos - (y2 - my) * sin);
      const ny2 = Math.round(my + (x2 - mx) * sin + (y2 - my) * cos);
      const updated = elementsRef.current.map(el => {
        if (el.id !== selectedElement.id) return el;
        return {
          ...el,
          x: Math.min(nx1, nx2),
          y: Math.min(ny1, ny2) - 12,
          width: Math.max(20, Math.abs(nx2 - nx1)),
          height: Math.max(24, Math.abs(ny2 - ny1) + 24),
          extraProps: { ...el.extraProps, x1: nx1, y1: ny1, x2: nx2, y2: ny2 }
        };
      });
      saveToHistory(updated);
      return;
    }
    let nextDeg = Math.round((selectedElement.rotation || 0) + deltaDeg);
    while (nextDeg < 0) nextDeg += 360;
    while (nextDeg >= 360) nextDeg -= 360;
    updateSelectedField('rotation', nextDeg, true);
  };

  // Flip Horizontal / Vertical
  const handleToggleFlip = (axis: 'h' | 'v') => {
    if (!selectedElement) return;
    if (axis === 'h') {
      updateSelectedField('flipH', !selectedElement.flipH, true);
    } else {
      updateSelectedField('flipV', !selectedElement.flipV, true);
    }
  };

  // Mouse Handlers for Dragging, Resizing, Rotating, and Endpoint/Vertex Manipulation
  const handleMouseDown = (e: React.MouseEvent, handle: string, elId?: string) => {
    if (toolMode !== 'select') return;
    e.stopPropagation();
    if (elId) {
      setSelectedId(elId);
    }
    const targetEl = elementsRef.current.find(el => el.id === (elId || selectedId));
    if (!targetEl) return;

    setIsDragging(true);
    setDragHandle(handle);
    setDragStartScreen({ x: e.clientX, y: e.clientY });
    setElementStart({
      ...targetEl,
      extraProps: targetEl.extraProps ? JSON.parse(JSON.stringify(targetEl.extraProps)) : undefined
    });
    dragMovedRef.current = false;
  };

  // Global mousemove and mouseup listeners with Invariant Affine Math & Smart Alignment Guides
  useEffect(() => {
    if (!isDragging || !dragHandle || !elementStart || !selectedId) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = CANVAS_WIDTH / (rect.width || 1);
      const scaleY = CANVAS_HEIGHT / (rect.height || 1);

      const rawDx = (e.clientX - dragStartScreen.x) * scaleX;
      const rawDy = (e.clientY - dragStartScreen.y) * scaleY;

      if (Math.hypot(rawDx, rawDy) > 3) {
        dragMovedRef.current = true;
      }

      // Endpoint P1 / P2 dragging for line & arrow
      if (dragHandle === 'p1' || dragHandle === 'p2') {
        const startX1 = elementStart.extraProps?.x1 ?? elementStart.x;
        const startY1 = elementStart.extraProps?.y1 ?? (elementStart.y + elementStart.height / 2);
        const startX2 = elementStart.extraProps?.x2 ?? (elementStart.x + elementStart.width);
        const startY2 = elementStart.extraProps?.y2 ?? (elementStart.y + elementStart.height / 2);

        const movingRaw = dragHandle === 'p1'
          ? { x: startX1 + rawDx, y: startY1 + rawDy }
          : { x: startX2 + rawDx, y: startY2 + rawDy };
        const anchor = dragHandle === 'p1' ? { x: startX2, y: startY2 } : { x: startX1, y: startY1 };

        const snapped = snapPointWithGuides(movingRaw, selectedId, anchor, e.shiftKey);
        setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });

        const nx1 = dragHandle === 'p1' ? snapped.x : startX1;
        const ny1 = dragHandle === 'p1' ? snapped.y : startY1;
        const nx2 = dragHandle === 'p2' ? snapped.x : startX2;
        const ny2 = dragHandle === 'p2' ? snapped.y : startY2;

        setElements(prev => prev.map(el => {
          if (el.id !== selectedId) return el;
          return {
            ...el,
            x: Math.min(nx1, nx2),
            y: Math.min(ny1, ny2) - 12,
            width: Math.max(20, Math.abs(nx2 - nx1)),
            height: Math.max(24, Math.abs(ny2 - ny1) + 24),
            rotation: 0,
            extraProps: {
              ...(el.extraProps || {}),
              x1: nx1,
              y1: ny1,
              x2: nx2,
              y2: ny2
            }
          };
        }));
        return;
      }

      // Curve offset dragging for curved line
      if (dragHandle === 'curve') {
        const x1 = elementStart.extraProps?.x1 ?? elementStart.x;
        const y1 = elementStart.extraProps?.y1 ?? (elementStart.y + elementStart.height / 2);
        const x2 = elementStart.extraProps?.x2 ?? (elementStart.x + elementStart.width);
        const y2 = elementStart.extraProps?.y2 ?? (elementStart.y + elementStart.height / 2);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const pos = getCanvasCoords(e.clientX, e.clientY);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        const proj = Math.round(((pos.x - mx) * nx + (pos.y - my) * ny) * 1.6);
        setElements(prev => prev.map(el => {
          if (el.id !== selectedId) return el;
          return {
            ...el,
            extraProps: { ...(el.extraProps || {}), curveOffset: Math.max(-160, Math.min(160, proj)) }
          };
        }));
        return;
      }

      // Polygon vertex dragging (vertex-0, vertex-1, ...)
      if (dragHandle.startsWith('vertex-')) {
        const vIdx = parseInt(dragHandle.replace('vertex-', ''), 10);
        const startPts: { x: number; y: number }[] = elementStart.extraProps?.points || [];
        if (startPts[vIdx]) {
          const worldPts = startPts.map(p => ({
            x: elementStart.x + p.x * elementStart.width,
            y: elementStart.y + p.y * elementStart.height
          }));
          const rawTarget = {
            x: worldPts[vIdx].x + rawDx,
            y: worldPts[vIdx].y + rawDy
          };
          const snapped = snapPointWithGuides(rawTarget, selectedId, null, e.shiftKey);
          setActiveGuides({ verticals: snapped.verticals, horizontals: snapped.horizontals });
          worldPts[vIdx] = { x: snapped.x, y: snapped.y };

          const xs = worldPts.map(p => p.x);
          const ys = worldPts.map(p => p.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const w = Math.max(20, maxX - minX);
          const h = Math.max(20, maxY - minY);
          const normPts = worldPts.map(p => ({
            x: Number(((p.x - minX) / w).toFixed(4)),
            y: Number(((p.y - minY) / h).toFixed(4))
          }));

          setElements(prev => prev.map(el => {
            if (el.id !== selectedId) return el;
            return {
              ...el,
              x: Math.round(minX),
              y: Math.round(minY),
              width: Math.round(w),
              height: Math.round(h),
              extraProps: { ...(el.extraProps || {}), points: normPts }
            };
          }));
        }
        return;
      }

      if (dragHandle === 'move') {
        let nextX = Math.round(elementStart.x + rawDx);
        let nextY = Math.round(elementStart.y + rawDy);

        if (snapToGrid) {
          nextX = Math.round(nextX / gridSize) * gridSize;
          nextY = Math.round(nextY / gridSize) * gridSize;
        }

        const verticals: number[] = [];
        const horizontals: number[] = [];

        if (showSmartGuides) {
          const cx = Math.round(nextX + elementStart.width / 2);
          const cy = Math.round(nextY + elementStart.height / 2);
          const right = nextX + elementStart.width;
          const bottom = nextY + elementStart.height;

          const xTargets: number[] = [CANVAS_WIDTH / 2];
          const yTargets: number[] = [CANVAS_HEIGHT / 2];

          elementsRef.current.forEach(other => {
            if (other.id === selectedId) return;
            xTargets.push(other.x, Math.round(other.x + other.width / 2), other.x + other.width);
            yTargets.push(other.y, Math.round(other.y + other.height / 2), other.y + other.height);
          });

          const threshold = 5;
          for (const tx of xTargets) {
            if (Math.abs(cx - tx) <= threshold) {
              nextX = Math.round(tx - elementStart.width / 2);
              verticals.push(tx);
              break;
            } else if (Math.abs(nextX - tx) <= threshold) {
              nextX = tx;
              verticals.push(tx);
              break;
            } else if (Math.abs(right - tx) <= threshold) {
              nextX = tx - elementStart.width;
              verticals.push(tx);
              break;
            }
          }
          for (const ty of yTargets) {
            if (Math.abs(cy - ty) <= threshold) {
              nextY = Math.round(ty - elementStart.height / 2);
              horizontals.push(ty);
              break;
            } else if (Math.abs(nextY - ty) <= threshold) {
              nextY = ty;
              horizontals.push(ty);
              break;
            } else if (Math.abs(bottom - ty) <= threshold) {
              nextY = ty - elementStart.height;
              horizontals.push(ty);
              break;
            }
          }
        }
        setActiveGuides({ verticals, horizontals });

        const appliedDx = nextX - elementStart.x;
        const appliedDy = nextY - elementStart.y;

        setElements(prev => prev.map(el => {
          if (el.id !== selectedId) return el;
          const nextExtra = el.extraProps ? { ...el.extraProps } : undefined;
          if (nextExtra && elementStart.extraProps?.x1 !== undefined) {
            nextExtra.x1 = elementStart.extraProps.x1 + appliedDx;
            nextExtra.y1 = elementStart.extraProps.y1 + appliedDy;
            nextExtra.x2 = elementStart.extraProps.x2 + appliedDx;
            nextExtra.y2 = elementStart.extraProps.y2 + appliedDy;
          }
          return { ...el, x: nextX, y: nextY, extraProps: nextExtra };
        }));
        return;
      }

      setElements(prev => prev.map(el => {
        if (el.id !== selectedId) return el;

        if (dragHandle === 'rotate') {
          const centerX = elementStart.x + elementStart.width / 2;
          const centerY = elementStart.y + elementStart.height / 2;
          const currentCanvasPos = getCanvasCoords(e.clientX, e.clientY);
          const rad = Math.atan2(currentCanvasPos.y - centerY, currentCanvasPos.x - centerX);
          let deg = Math.round(rad * (180 / Math.PI)) + 90;
          if (deg < 0) deg += 360;
          if (deg >= 360) deg -= 360;

          if (e.shiftKey) {
            deg = Math.round(deg / 15) * 15;
          }

          return { ...el, rotation: deg };
        }

        // Affine Transform Math for Corner Handles (se, sw, ne, nw) with Rotated Elements
        const rotRad = ((elementStart.rotation || 0) * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);

        const localDx = rawDx * Math.cos(-rotRad) - rawDy * Math.sin(-rotRad);
        const localDy = rawDx * Math.sin(-rotRad) + rawDy * Math.cos(-rotRad);

        let anchorLocalStart = { x: 0, y: 0 };
        let newW = elementStart.width;
        let newH = elementStart.height;
        const minH = ['line', 'arrow'].includes(el.type) ? 4 : 20;

        if (dragHandle === 'se') {
          anchorLocalStart = { x: -elementStart.width / 2, y: -elementStart.height / 2 };
          newW = Math.max(20, Math.round(elementStart.width + localDx));
          newH = Math.max(minH, Math.round(elementStart.height + localDy));
        } else if (dragHandle === 'sw') {
          anchorLocalStart = { x: elementStart.width / 2, y: -elementStart.height / 2 };
          newW = Math.max(20, Math.round(elementStart.width - localDx));
          newH = Math.max(minH, Math.round(elementStart.height + localDy));
        } else if (dragHandle === 'ne') {
          anchorLocalStart = { x: -elementStart.width / 2, y: elementStart.height / 2 };
          newW = Math.max(20, Math.round(elementStart.width + localDx));
          newH = Math.max(minH, Math.round(elementStart.height - localDy));
        } else if (dragHandle === 'nw') {
          anchorLocalStart = { x: elementStart.width / 2, y: elementStart.height / 2 };
          newW = Math.max(20, Math.round(elementStart.width - localDx));
          newH = Math.max(minH, Math.round(elementStart.height - localDy));
        }

        if (snapToGrid) {
          newW = Math.max(20, Math.round(newW / gridSize) * gridSize);
          newH = Math.max(minH, Math.round(newH / gridSize) * gridSize);
        }

        const startCenterX = elementStart.x + elementStart.width / 2;
        const startCenterY = elementStart.y + elementStart.height / 2;
        const anchorWorldX = startCenterX + anchorLocalStart.x * cosRot - anchorLocalStart.y * sinRot;
        const anchorWorldY = startCenterY + anchorLocalStart.x * sinRot + anchorLocalStart.y * cosRot;

        let newAnchorLocal = { x: 0, y: 0 };
        if (dragHandle === 'se') newAnchorLocal = { x: -newW / 2, y: -newH / 2 };
        else if (dragHandle === 'sw') newAnchorLocal = { x: newW / 2, y: -newH / 2 };
        else if (dragHandle === 'ne') newAnchorLocal = { x: -newW / 2, y: newH / 2 };
        else if (dragHandle === 'nw') newAnchorLocal = { x: newW / 2, y: newH / 2 };

        const newCenterX = anchorWorldX - (newAnchorLocal.x * cosRot - newAnchorLocal.y * sinRot);
        const newCenterY = anchorWorldY - (newAnchorLocal.x * sinRot + newAnchorLocal.y * cosRot);

        const newX = Math.round(newCenterX - newW / 2);
        const newY = Math.round(newCenterY - newH / 2);

        const nextExtra = el.extraProps ? { ...el.extraProps } : undefined;
        if (nextExtra && ['line', 'arrow'].includes(el.type) && elementStart.extraProps?.x1 !== undefined) {
          nextExtra.x1 = newX;
          nextExtra.y1 = Math.round(newY + newH / 2);
          nextExtra.x2 = newX + newW;
          nextExtra.y2 = Math.round(newY + newH / 2);
        }

        return {
          ...el,
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          extraProps: nextExtra
        };
      }));
    };

    const onGlobalMouseUp = () => {
      setIsDragging(false);
      setDragHandle(null);
      setActiveGuides({ verticals: [], horizontals: [] });
      if (dragMovedRef.current) {
        saveToHistory(elementsRef.current);
      }
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isDragging, dragHandle, dragStartScreen, elementStart, selectedId, snapToGrid, gridSize, showSmartGuides, getCanvasCoords, snapPointWithGuides, saveToHistory]);

  // Keyboard Shortcuts (Undo, Redo, Delete, Duplicate, Nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (cmdKey && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (cmdKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        const updated = elementsRef.current.map(el => {
          if (el.id === selectedId) {
            return { ...el, x: el.x + dx, y: el.y + dy };
          }
          return el;
        });
        setElements(updated);
        elementsRef.current = updated;
        saveToHistory(updated);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedId, handleUndo, handleRedo, handleDuplicateSelected, handleDeleteSelected, saveToHistory]);

  // Handle Image Upload into Canvas
  const handleUploadCanvasImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('กำลังอัปโหลดรูปภาพลงผืนผ้าใบ...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('examId', 'canva-studio');
      const res = await fetch('/api/academic/exams/upload-image', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        addElement('image_overlay', {
          imageUrl: data.url,
          width: 260,
          height: 190,
          stroke: 'none',
          fill: 'transparent'
        });
        toast.success('แทรกรูปภาพลงผืนผ้าใบเรียบร้อย', { id: toastId });
      } else {
        throw new Error(data.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ', { id: toastId });
    } finally {
      e.target.value = '';
    }
  };

  // Helper: Build SVG transform string for rotation and flips
  const getTransformString = (el: CanvasElement) => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const parts: string[] = [];

    if (el.rotation) {
      parts.push(`rotate(${el.rotation} ${cx} ${cy})`);
    }
    if (el.flipH || el.flipV) {
      parts.push(`translate(${cx} ${cy}) scale(${el.flipH ? -1 : 1} ${el.flipV ? -1 : 1}) translate(${-cx} ${-cy})`);
    }
    return parts.length > 0 ? parts.join(' ') : undefined;
  };

  // Render SVG Element for Interactive Canvas (JSX)
  const renderSvgElement = (el: CanvasElement) => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const dash = el.strokeDasharray;
    const fillOp = el.fillOpacity ?? 1;
    const strokeOp = el.strokeOpacity ?? 1;

    switch (el.type) {
      // --- 2D Shapes ---
      case 'rect':
        return <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={el.rx || 2} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;

      case 'rounded_rect':
        return <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={16} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;

      case 'circle': {
        const r = Math.min(el.width, el.height) / 2;
        return <circle cx={cx} cy={cy} r={r} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;
      }

      case 'ellipse':
        return <ellipse cx={cx} cy={cy} rx={el.width / 2} ry={el.height / 2} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;

      case 'semicircle': {
        const r = el.width / 2;
        const d = `M ${el.x} ${el.y + el.height} A ${r} ${el.height} 0 0 1 ${el.x + el.width} ${el.y + el.height} Z`;
        return <path d={d} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;
      }

      case 'sector_pie': {
        const r = el.width / 2;
        const d = `M ${cx} ${cy} L ${cx} ${el.y} A ${r} ${r} 0 0 1 ${el.x + el.width} ${cy} Z`;
        return <path d={d} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeDasharray={dash} />;
      }

      case 'triangle': {
        const pts = `${cx},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'right_triangle': {
        const orientation = el.extraProps?.orientation || 'bottom-left';
        let pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y}`;
        const markerSize = Math.min(18, Math.min(el.width, el.height) * 0.22);
        let markerPts = `${el.x},${el.y + el.height - markerSize} ${el.x + markerSize},${el.y + el.height - markerSize} ${el.x + markerSize},${el.y + el.height}`;

        if (orientation === 'bottom-right') {
          pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x + el.width},${el.y}`;
          markerPts = `${el.x + el.width - markerSize},${el.y + el.height} ${el.x + el.width - markerSize},${el.y + el.height - markerSize} ${el.x + el.width},${el.y + el.height - markerSize}`;
        } else if (orientation === 'top-left') {
          pts = `${el.x},${el.y} ${el.x + el.width},${el.y} ${el.x},${el.y + el.height}`;
          markerPts = `${el.x},${el.y + markerSize} ${el.x + markerSize},${el.y + markerSize} ${el.x + markerSize},${el.y}`;
        } else if (orientation === 'top-right') {
          pts = `${el.x},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width},${el.y + el.height}`;
          markerPts = `${el.x + el.width - markerSize},${el.y} ${el.x + el.width - markerSize},${el.y + markerSize} ${el.x + el.width},${el.y + markerSize}`;
        }

        return (
          <g>
            <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />
            {el.extraProps?.showRightAngle !== false && (
              <polyline points={markerPts} fill="none" stroke={el.stroke} strokeWidth={1.8} />
            )}
          </g>
        );
      }

      case 'parallelogram': {
        const slant = el.extraProps?.slant ?? (el.width * 0.22);
        const pts = `${el.x + slant},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width - slant},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'trapezoid': {
        const topInset = el.extraProps?.topInset ?? (el.width * 0.2);
        const pts = `${el.x + topInset},${el.y} ${el.x + el.width - topInset},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'rhombus': {
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'pentagon': {
        const r = Math.min(el.width, el.height) / 2;
        const pts = Array.from({ length: 5 }).map((_, i) => {
          const a = (i * 72 - 90) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'hexagon': {
        const r = Math.min(el.width, el.height) / 2;
        const pts = Array.from({ length: 6 }).map((_, i) => {
          const a = (i * 60 - 30) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      case 'star_5': {
        const rOuter = Math.min(el.width, el.height) / 2;
        const rInner = rOuter * 0.42;
        const pts = Array.from({ length: 10 }).map((_, i) => {
          const r = i % 2 === 0 ? rOuter : rInner;
          const a = (i * 36 - 90) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return <polygon points={pts} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeOpacity={strokeOp} strokeLinejoin="round" strokeDasharray={dash} />;
      }

      // --- 3D Solids ---
      case 'cube_3d':
      case 'box_3d': {
        const depth = Math.min(el.width, el.height) * 0.3;
        const fw = el.width - depth;
        const fh = el.height - depth;
        return (
          <g>
            <line x1={el.x} y1={el.y + el.height} x2={el.x + depth} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x + depth} y1={el.y + el.height - depth} x2={el.x + el.width} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x + depth} y1={el.y + el.height - depth} x2={el.x + depth} y2={el.y} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <rect x={el.x} y={el.y + depth} width={fw} height={fh} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <polygon points={`${el.x},${el.y + depth} ${el.x + depth},${el.y} ${el.x + el.width},${el.y} ${el.x + fw},${el.y + depth}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <polygon points={`${el.x + fw},${el.y + depth} ${el.x + el.width},${el.y} ${el.x + el.width},${el.y + fh} ${el.x + fw},${el.y + el.height}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
          </g>
        );
      }

      case 'cylinder_3d': {
        const ry = Math.min(22, el.height * 0.16);
        const topY = el.y + ry;
        const botY = el.y + el.height - ry;
        return (
          <g>
            <path d={`M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 1 ${el.x + el.width} ${botY}`} fill="none" stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <path d={`M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 0 ${el.x + el.width} ${botY}`} fill="none" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={el.x} y1={topY} x2={el.x} y2={botY} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={el.x + el.width} y1={topY} x2={el.x + el.width} y2={botY} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <ellipse cx={cx} cy={topY} rx={el.width / 2} ry={ry} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
          </g>
        );
      }

      case 'cone_3d': {
        const ry = Math.min(22, el.height * 0.18);
        const botY = el.y + el.height - ry;
        return (
          <g>
            <path d={`M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 1 ${el.x + el.width} ${botY}`} fill="none" stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <path d={`M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 0 ${el.x + el.width} ${botY}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={el.x} y1={botY} x2={cx} y2={el.y} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={el.x + el.width} y1={botY} x2={cx} y2={el.y} stroke={el.stroke} strokeWidth={el.strokeWidth} />
          </g>
        );
      }

      case 'sphere_3d': {
        const r = Math.min(el.width, el.height) / 2;
        const ry = r * 0.35;
        return (
          <g>
            <circle cx={cx} cy={cy} r={r} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <path d={`M ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <path d={`M ${cx - r} ${cy} A ${r} ${ry} 0 0 0 ${cx + r} ${cy}`} fill="none" stroke={el.stroke} strokeWidth={1.5} />
            <circle cx={cx - r * 0.35} cy={cy - r * 0.35} r={r * 0.12} fill="#ffffff" opacity={0.6} />
          </g>
        );
      }

      case 'pyramid_3d': {
        const apexX = cx;
        const apexY = el.y;
        const depth = el.height * 0.3;
        const p1 = `${el.x},${el.y + el.height}`;
        const p2 = `${el.x + el.width * 0.75},${el.y + el.height}`;
        const p3 = `${el.x + el.width},${el.y + el.height - depth}`;
        return (
          <g>
            <line x1={el.x} y1={el.y + el.height} x2={el.x + el.width * 0.25} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x + el.width * 0.25} y1={el.y + el.height - depth} x2={el.x + el.width} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x + el.width * 0.25} y1={el.y + el.height - depth} x2={apexX} y2={apexY} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <polygon points={`${p1} ${p2} ${apexX},${apexY}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <polygon points={`${p2} ${p3} ${apexX},${apexY}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
          </g>
        );
      }

      case 'triangular_prism_3d': {
        const depth = el.width * 0.35;
        const frontW = el.width - depth;
        return (
          <g>
            <line x1={el.x + depth} y1={el.y} x2={el.x + el.width} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x + depth} y1={el.y + el.height - depth} x2={el.x + el.width} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x} y1={el.y + el.height} x2={el.x + depth} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <line x1={el.x} y1={el.y + depth} x2={el.x + depth} y2={el.y} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={el.x + frontW} y1={el.y + el.height} x2={el.x + el.width} y2={el.y + el.height - depth} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <polygon points={`${el.x},${el.y + depth} ${el.x + frontW},${el.y + el.height} ${el.x},${el.y + el.height}`} fill={el.fill} fillOpacity={fillOp} stroke={el.stroke} strokeWidth={el.strokeWidth} />
          </g>
        );
      }

      // --- Lines, Measurements & Math Tools ---
      case 'line':
      case 'arrow':
      case 'polygon_custom':
      case 'parallel_transversal':
      case 'intersecting_lines':
        return <g dangerouslySetInnerHTML={{ __html: renderCustomLineAndIntersectionMarkup(el) }} />;

      case 'dimension_line':
        return (
          <g>
            <line x1={el.x} y1={cy - 6} x2={el.x} y2={cy + 6} stroke={el.stroke} strokeWidth={1.8} />
            <line x1={el.x + el.width} y1={cy - 6} x2={el.x + el.width} y2={cy + 6} stroke={el.stroke} strokeWidth={1.8} />
            <line x1={el.x + 4} y1={cy} x2={el.x + el.width - 4} y2={cy} stroke={el.stroke} strokeWidth={1.5} strokeDasharray="3,3" />
            <text x={cx} y={cy - 6} fontSize={el.fontSize || 13} fontWeight={el.fontWeight || 'bold'} fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>{el.text || ''}</text>
          </g>
        );

      case 'angle_arc': {
        const angle = el.extraProps?.angle ?? 60;
        const radius = el.extraProps?.radius ?? Math.min(el.width, el.height) * 0.45;
        const rad = (angle * Math.PI) / 180;
        const ray2X = el.x + el.width * Math.cos(rad);
        const ray2Y = el.y + el.height - el.width * Math.sin(rad);
        const arcEndX = el.x + radius * Math.cos(rad);
        const arcEndY = el.y + el.height - radius * Math.sin(rad);
        const largeArc = angle > 180 ? 1 : 0;
        const arcPath = `M ${el.x + radius} ${el.y + el.height} A ${radius} ${radius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`;

        const midAngle = (angle / 2) * (Math.PI / 180);
        const labelDist = radius + 14;
        const labelX = el.x + labelDist * Math.cos(midAngle);
        const labelY = el.y + el.height - labelDist * Math.sin(midAngle) + 4;

        return (
          <g>
            <line x1={el.x} y1={el.y + el.height} x2={el.x + el.width} y2={el.y + el.height} stroke={el.stroke} strokeWidth={el.strokeWidth || 2} />
            <line x1={el.x} y1={el.y + el.height} x2={ray2X} y2={ray2Y} stroke={el.stroke} strokeWidth={el.strokeWidth || 2} />
            <path d={arcPath} fill="none" stroke="#2563eb" strokeWidth={1.8} />
            {el.extraProps?.showDegree !== false && (
              <text x={labelX} y={labelY} fontSize={el.fontSize || 13} fontWeight="bold" fill="#2563eb" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text || `${angle}°`}
              </text>
            )}
          </g>
        );
      }

      case 'protractor': {
        const r = el.width / 2;
        return (
          <g>
            <path d={`M ${el.x} ${el.y + el.height} A ${r} ${el.height} 0 0 1 ${el.x + el.width} ${el.y + el.height} Z`} fill="#f0f9ff" stroke="#0284c7" strokeWidth={2} />
            <line x1={cx} y1={el.y + el.height} x2={cx} y2={el.y + el.height - 8} stroke="#0284c7" strokeWidth={2} />
            <text x={cx} y={el.y + el.height - 12} fontSize={11} fontWeight="bold" fill="#0369a1" textAnchor="middle" fontFamily="sans-serif">90°</text>
            <text x={el.x + 12} y={el.y + el.height - 4} fontSize={10} fill="#0369a1" fontFamily="sans-serif">0°</text>
            <text x={el.x + el.width - 24} y={el.y + el.height - 4} fontSize={10} fill="#0369a1" fontFamily="sans-serif">180°</text>
          </g>
        );
      }

      case 'axes_xy': {
        const showGridLines = el.extraProps?.showGrid;
        const showArrows = el.extraProps?.showArrows !== false;
        const xLab = el.extraProps?.xLabel || 'X';
        const yLab = el.extraProps?.yLabel || 'Y';
        const oLab = el.extraProps?.originLabel || 'O';

        return (
          <g>
            {showGridLines && (
              <g stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3,3">
                {[-3, -2, -1, 1, 2, 3].map(i => (
                  <React.Fragment key={i}>
                    <line x1={cx + i * (el.width / 8)} y1={el.y} x2={cx + i * (el.width / 8)} y2={el.y + el.height} />
                    <line x1={el.x} y1={cy + i * (el.height / 8)} x2={el.x + el.width} y2={cy + i * (el.height / 8)} />
                  </React.Fragment>
                ))}
              </g>
            )}
            <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke="#334155" strokeWidth={2} />
            <line x1={cx} y1={el.y} x2={cx} y2={el.y + el.height} stroke="#334155" strokeWidth={2} />
            {showArrows && (
              <>
                <polygon points={`${el.x + el.width - 6},${cy - 4} ${el.x + el.width},${cy} ${el.x + el.width - 6},${cy + 4}`} fill="#334155" />
                <polygon points={`${cx - 4},${el.y + 6} ${cx},${el.y} ${cx + 4},${el.y + 6}`} fill="#334155" />
              </>
            )}
            <text x={el.x + el.width - 4} y={cy - 8} fontSize={13} fontWeight="bold" fill="#1e293b" fontFamily="sans-serif">{xLab}</text>
            <text x={cx + 8} y={el.y + 12} fontSize={13} fontWeight="bold" fill="#1e293b" fontFamily="sans-serif">{yLab}</text>
            <text x={cx - 10} y={cy + 14} fontSize={11} fill="#64748b" fontFamily="sans-serif">{oLab}</text>
          </g>
        );
      }

      case 'number_line': {
        const minVal = el.extraProps?.min ?? -5;
        const maxVal = el.extraProps?.max ?? 5;
        const stepVal = el.extraProps?.step ?? 1;
        const range = Math.max(1, maxVal - minVal);
        const count = Math.floor(range / stepVal);
        const stepWidth = el.width / count;
        const markerVal = el.extraProps?.markerValue;
        const markerType = el.extraProps?.markerType || 'closed';
        const ineqRay = el.extraProps?.inequalityRay || 'none';

        const markerX = markerVal !== undefined ? el.x + ((markerVal - minVal) / range) * el.width : null;

        return (
          <g>
            <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke="#1e293b" strokeWidth={2} />
            <polygon points={`${el.x + 6},${cy - 4} ${el.x},${cy} ${el.x + 6},${cy + 4}`} fill="#1e293b" />
            <polygon points={`${el.x + el.width - 6},${cy - 4} ${el.x + el.width},${cy} ${el.x + el.width - 6},${cy + 4}`} fill="#1e293b" />
            {Array.from({ length: count + 1 }).map((_, i) => {
              const tx = el.x + i * stepWidth;
              const val = minVal + i * stepVal;
              return (
                <g key={i}>
                  <line x1={tx} y1={cy - 5} x2={tx} y2={cy + 5} stroke="#1e293b" strokeWidth={1.5} />
                  <text x={tx} y={cy + 18} fontSize={10} fill="#334155" textAnchor="middle" fontFamily="sans-serif">{val}</text>
                </g>
              );
            })}
            {/* Inequality Ray & Marker */}
            {markerX !== null && (
              <g>
                {ineqRay === 'left' && (
                  <line x1={markerX} y1={cy} x2={el.x + 4} y2={cy} stroke="#dc2626" strokeWidth={3} />
                )}
                {ineqRay === 'right' && (
                  <line x1={markerX} y1={cy} x2={el.x + el.width - 4} y2={cy} stroke="#dc2626" strokeWidth={3} />
                )}
                {markerType === 'closed' ? (
                  <circle cx={markerX} cy={cy} r={5} fill="#dc2626" stroke="#ffffff" strokeWidth={1.5} />
                ) : markerType === 'open' ? (
                  <circle cx={markerX} cy={cy} r={5} fill="#ffffff" stroke="#dc2626" strokeWidth={2} />
                ) : null}
              </g>
            )}
          </g>
        );
      }

      // --- Science & Circuits ---
      case 'circuit_bulb': {
        const isGlowing = el.extraProps?.glowing;
        return (
          <g>
            {isGlowing && (
              <circle cx={cx} cy={cy} r={el.width * 0.75} fill="#fef08a" opacity={0.35} />
            )}
            <circle cx={cx} cy={cy} r={el.width / 2} fill={isGlowing ? '#fef08a' : el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <line x1={cx - 10} y1={cy - 10} x2={cx + 10} y2={cy + 10} stroke={el.stroke} strokeWidth={2} />
            <line x1={cx - 10} y1={cy + 10} x2={cx + 10} y2={cy - 10} stroke={el.stroke} strokeWidth={2} />
          </g>
        );
      }

      case 'circuit_battery': {
        const isFlipped = el.extraProps?.flipped;
        const leftSign = isFlipped ? '-' : '+';
        const rightSign = isFlipped ? '+' : '-';
        const leftPlateH = isFlipped ? 14 : 28;
        const rightPlateH = isFlipped ? 28 : 14;

        return (
          <g>
            <line x1={el.x} y1={cy} x2={cx - 6} y2={cy} stroke={el.stroke} strokeWidth={2.5} />
            <line x1={cx + 6} y1={cy} x2={el.x + el.width} y2={cy} stroke={el.stroke} strokeWidth={2.5} />
            <line x1={cx - 6} y1={cy - leftPlateH / 2} x2={cx - 6} y2={cy + leftPlateH / 2} stroke={el.stroke} strokeWidth={isFlipped ? 2.5 : 3.5} />
            <line x1={cx + 6} y1={cy - rightPlateH / 2} x2={cx + 6} y2={cy + rightPlateH / 2} stroke={el.stroke} strokeWidth={isFlipped ? 3.5 : 2.5} />
            <text x={cx - 16} y={cy - 8} fontSize={11} fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">{leftSign}</text>
            <text x={cx + 12} y={cy - 8} fontSize={11} fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">{rightSign}</text>
          </g>
        );
      }

      case 'circuit_switch': {
        const isOpen = el.extraProps?.isOpen;
        return (
          <g>
            <line x1={el.x} y1={cy} x2={cx - 14} y2={cy} stroke={el.stroke} strokeWidth={2.5} />
            <line x1={cx + 14} y1={cy} x2={el.x + el.width} y2={cy} stroke={el.stroke} strokeWidth={2.5} />
            <circle cx={cx - 14} cy={cy} r={3.5} fill="#ffffff" stroke={el.stroke} strokeWidth={2} />
            <circle cx={cx + 14} cy={cy} r={3.5} fill="#ffffff" stroke={el.stroke} strokeWidth={2} />
            <line x1={cx - 14} y1={cy} x2={isOpen ? cx + 10 : cx + 14} y2={isOpen ? cy - 14 : cy} stroke={el.stroke} strokeWidth={2.5} />
          </g>
        );
      }

      case 'circuit_resistor': {
        const w6 = el.width / 6;
        const d = `M ${el.x} ${cy} L ${el.x + w6} ${cy} L ${el.x + w6 * 1.5} ${cy - 10} L ${el.x + w6 * 2.5} ${cy + 10} L ${el.x + w6 * 3.5} ${cy - 10} L ${el.x + w6 * 4.5} ${cy + 10} L ${el.x + w6 * 5} ${cy} L ${el.x + el.width} ${cy}`;
        return (
          <g>
            <path d={d} fill="none" stroke={el.stroke} strokeWidth={2.2} />
            {el.extraProps?.resistorValue && (
              <text x={cx} y={cy - 12} fontSize={11} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">
                {el.extraProps.resistorValue}
              </text>
            )}
          </g>
        );
      }

      case 'circuit_ammeter':
        return (
          <g>
            <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke={el.stroke} strokeWidth={2} />
            <circle cx={cx} cy={cy} r={el.width * 0.4} fill="#ffffff" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <text x={cx} y={cy + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">A</text>
          </g>
        );

      case 'circuit_voltmeter':
        return (
          <g>
            <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke={el.stroke} strokeWidth={2} />
            <circle cx={cx} cy={cy} r={el.width * 0.4} fill="#ffffff" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <text x={cx} y={cy + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">V</text>
          </g>
        );

      case 'science_pulley': {
        const r = 24;
        return (
          <g>
            <line x1={cx} y1={el.y} x2={cx} y2={cy - r} stroke="#64748b" strokeWidth={3} />
            <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <circle cx={cx} cy={cy} r={4} fill="#0f172a" />
            <line x1={cx - r} y1={cy} x2={cx - r} y2={el.y + el.height} stroke="#b91c1c" strokeWidth={2} />
            <line x1={cx + r} y1={cy} x2={cx + r} y2={el.y + el.height - 20} stroke="#b91c1c" strokeWidth={2} />
            <rect x={cx - r - 12} y={el.y + el.height - 18} width={24} height={18} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1.5} />
            <text x={cx - r} y={el.y + el.height - 5} fontSize={10} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">W</text>
          </g>
        );
      }

      case 'science_spring': {
        const segs = 6;
        const segH = (el.height - 20) / segs;
        let d = `M ${cx} ${el.y} L ${cx} ${el.y + 10}`;
        for (let i = 0; i < segs; i++) {
          const sy = el.y + 10 + i * segH;
          d += ` L ${cx + 12} ${sy + segH * 0.25} L ${cx - 12} ${sy + segH * 0.75}`;
        }
        d += ` L ${cx} ${el.y + el.height - 10} L ${cx} ${el.y + el.height}`;
        return <path d={d} fill="none" stroke="#334155" strokeWidth={2.2} />;
      }

      case 'science_incline': {
        const angle = el.extraProps?.angle ?? 30;
        const massLabel = el.extraProps?.massLabel || '2 kg';
        const pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y}`;
        return (
          <g>
            <polygon points={pts} fill="#f1f5f9" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <rect x={el.x + el.width * 0.35} y={el.y + el.height * 0.45} width={34} height={22} fill="#fef08a" stroke="#0f172a" strokeWidth={1.8} transform={`rotate(-${angle} ${el.x + el.width * 0.35} ${el.y + el.height * 0.45})`} />
            <text x={el.x + el.width * 0.4} y={el.y + el.height * 0.42} fontSize={10} fontWeight="bold" fill="#0f172a" fontFamily="sans-serif">{massLabel}</text>
          </g>
        );
      }

      case 'science_lever':
        return (
          <g>
            <polygon points={`${cx},${el.y + el.height - 24} ${cx - 16},${el.y + el.height} ${cx + 16},${el.y + el.height}`} fill="#94a3b8" stroke={el.stroke} strokeWidth={1.8} />
            <line x1={el.x} y1={el.y + el.height - 24} x2={el.x + el.width} y2={el.y + el.height - 24} stroke={el.stroke} strokeWidth={3} />
            <rect x={el.x + 10} y={el.y + el.height - 42} width={22} height={18} fill="#e2e8f0" stroke="#0f172a" strokeWidth={1.5} />
            <rect x={el.x + el.width - 32} y={el.y + el.height - 42} width={22} height={18} fill="#fef08a" stroke="#0f172a" strokeWidth={1.5} />
          </g>
        );

      case 'science_magnet': {
        const isFlipped = el.extraProps?.flipped;
        const half = el.width / 2;
        const p1Col = isFlipped ? '#3b82f6' : '#ef4444';
        const p2Col = isFlipped ? '#ef4444' : '#3b82f6';
        const p1Lab = isFlipped ? 'S' : 'N';
        const p2Lab = isFlipped ? 'N' : 'S';

        return (
          <g>
            <rect x={el.x} y={el.y} width={half} height={el.height} fill={p1Col} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <rect x={el.x + half} y={el.y} width={half} height={el.height} fill={p2Col} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <text x={el.x + half * 0.5} y={cy + 5} fontSize={16} fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">{p1Lab}</text>
            <text x={el.x + half * 1.5} y={cy + 5} fontSize={16} fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif">{p2Lab}</text>
          </g>
        );
      }

      case 'science_beaker': {
        const liquidPct = el.extraProps?.liquidLevel ?? 60;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liquidH = (el.height - 12) * (liquidPct / 100);

        return (
          <g>
            {liquidPct > 0 && (
              <rect x={el.x + 2} y={el.y + el.height - liquidH} width={el.width - 4} height={liquidH} fill={liquidCol} opacity={0.75} />
            )}
            <path d={`M ${el.x - 4} ${el.y} L ${el.x} ${el.y} L ${el.x} ${el.y + el.height - 6} A 6 6 0 0 0 ${el.x + 6} ${el.y + el.height} L ${el.x + el.width - 6} ${el.y + el.height} A 6 6 0 0 0 ${el.x + el.width} ${el.y + el.height - 6} L ${el.x + el.width} ${el.y}`} fill="none" stroke={el.stroke} strokeWidth={2} />
            <line x1={el.x + 6} y1={el.y + el.height * 0.4} x2={el.x + 18} y2={el.y + el.height * 0.4} stroke="#0284c7" strokeWidth={1.5} />
            <line x1={el.x + 6} y1={el.y + el.height * 0.6} x2={el.x + 18} y2={el.y + el.height * 0.6} stroke="#0284c7" strokeWidth={1.5} />
            <line x1={el.x + 6} y1={el.y + el.height * 0.8} x2={el.x + 18} y2={el.y + el.height * 0.8} stroke="#0284c7" strokeWidth={1.5} />
          </g>
        );
      }

      case 'science_test_tube': {
        const r = el.width / 2;
        const liquidPct = el.extraProps?.liquidLevel ?? 70;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liquidH = (el.height - r) * (liquidPct / 100);

        return (
          <g>
            {liquidPct > 0 && (
              <rect x={el.x + 2} y={el.y + el.height - liquidH - r} width={el.width - 4} height={liquidH} fill={liquidCol} opacity={0.75} />
            )}
            <path d={`M ${el.x} ${el.y} L ${el.x} ${el.y + el.height - r} A ${r} ${r} 0 0 0 ${el.x + el.width} ${el.y + el.height - r} L ${el.x + el.width} ${el.y}`} fill="none" stroke={el.stroke} strokeWidth={2} />
            <line x1={el.x - 3} y1={el.y} x2={el.x + el.width + 3} y2={el.y} stroke={el.stroke} strokeWidth={2} />
          </g>
        );
      }

      case 'science_flask': {
        const neckW = el.width * 0.28;
        const neckH = el.height * 0.35;
        const bodyH = el.height - neckH;
        const liquidPct = el.extraProps?.liquidLevel ?? 50;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liqH = bodyH * (liquidPct / 100);
        const liqTopY = el.y + el.height - liqH;
        const tRatio = Math.max(0, Math.min(1, (liqTopY - (el.y + neckH)) / bodyH));
        const liqTopHalfW = (neckW / 2) + ((el.width / 2) - (neckW / 2)) * tRatio;
        const d = `M ${cx - neckW / 2} ${el.y} L ${cx - neckW / 2} ${el.y + neckH} L ${el.x} ${el.y + el.height} L ${el.x + el.width} ${el.y + el.height} L ${cx + neckW / 2} ${el.y + neckH} L ${cx + neckW / 2} ${el.y} Z`;
        return (
          <g>
            {liquidPct > 0 && (
              <polygon
                points={`${cx - liqTopHalfW + 2},${liqTopY} ${cx + liqTopHalfW - 2},${liqTopY} ${el.x + el.width - 2},${el.y + el.height - 2} ${el.x + 2},${el.y + el.height - 2}`}
                fill={liquidCol}
                opacity={0.78}
              />
            )}
            <path d={d} fill="none" stroke={el.stroke} strokeWidth={2} strokeLinejoin="round" />
          </g>
        );
      }

      case 'thermometer': {
        const temp = el.extraProps?.temperature ?? 37;
        const minT = el.extraProps?.minTemp ?? 0;
        const maxT = el.extraProps?.maxTemp ?? 100;
        const unit = el.extraProps?.unit || '°C';
        const liqCol = el.extraProps?.liquidColor || '#ef4444';
        const bulbR = Math.min(16, el.width * 0.26);
        const tubeW = bulbR * 0.95;
        const tubeTop = el.y + 12;
        const tubeBot = el.y + el.height - bulbR * 2;
        const tubeH = Math.max(20, tubeBot - tubeTop);
        const pct = Math.max(0, Math.min(1, (temp - minT) / Math.max(1, maxT - minT)));
        const fillH = tubeH * pct;
        return (
          <g>
            <rect x={cx - tubeW / 2} y={tubeTop} width={tubeW} height={tubeH + bulbR * 0.5} rx={tubeW / 2} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <circle cx={cx} cy={el.y + el.height - bulbR} r={bulbR} fill={liqCol} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <rect x={cx - (tubeW - 6) / 2} y={tubeBot - fillH} width={Math.max(4, tubeW - 6)} height={fillH + bulbR * 0.5} fill={liqCol} />
            {[0, 0.25, 0.5, 0.75, 1].map((f, idx) => {
              const ty = tubeBot - f * tubeH;
              const val = Math.round(minT + f * (maxT - minT));
              return (
                <g key={idx}>
                  <line x1={cx + tubeW / 2} y1={ty} x2={cx + tubeW / 2 + 6} y2={ty} stroke={el.stroke} strokeWidth={1.5} />
                  <text x={cx + tubeW / 2 + 9} y={ty + 3} fontSize={9} fontWeight="bold" fill="#334155" fontFamily="sans-serif">{val}{unit}</text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'balance_scale': {
        const tilt = el.extraProps?.tilt || 'even';
        const leftW = el.extraProps?.leftWeight || '500 g';
        const rightW = el.extraProps?.rightWeight || '500 g';
        const tiltDeg = tilt === 'left' ? -10 : tilt === 'right' ? 10 : 0;
        const pivotY = el.y + el.height * 0.35;
        const baseY = el.y + el.height - 8;
        const beamHalf = el.width * 0.42;
        return (
          <g>
            <rect x={cx - 32} y={baseY} width={64} height={8} rx={3} fill="#475569" />
            <line x1={cx} y1={pivotY} x2={cx} y2={baseY} stroke="#475569" strokeWidth={4} />
            <polygon points={`${cx - 8},${baseY} ${cx + 8},${baseY} ${cx},${pivotY}`} fill="#64748b" />
            <g transform={`rotate(${tiltDeg} ${cx} ${pivotY})`}>
              <line x1={cx - beamHalf} y1={pivotY} x2={cx + beamHalf} y2={pivotY} stroke="#0f172a" strokeWidth={3.5} />
              <circle cx={cx} cy={pivotY} r={4.5} fill="#f59e0b" stroke="#0f172a" strokeWidth={1.5} />
              {/* Left Pan */}
              <line x1={cx - beamHalf} y1={pivotY} x2={cx - beamHalf - 16} y2={pivotY + 38} stroke="#64748b" strokeWidth={1.5} />
              <line x1={cx - beamHalf} y1={pivotY} x2={cx - beamHalf + 16} y2={pivotY + 38} stroke="#64748b" strokeWidth={1.5} />
              <path d={`M ${cx - beamHalf - 22} ${pivotY + 38} Q ${cx - beamHalf} ${pivotY + 46} ${cx - beamHalf + 22} ${pivotY + 38} Z`} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1.5} />
              <rect x={cx - beamHalf - 14} y={pivotY + 20} width={28} height={18} rx={2} fill="#fef08a" stroke="#0f172a" strokeWidth={1.5} />
              <text x={cx - beamHalf} y={pivotY + 32} fontSize={9} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">{leftW}</text>
              {/* Right Pan */}
              <line x1={cx + beamHalf} y1={pivotY} x2={cx + beamHalf - 16} y2={pivotY + 38} stroke="#64748b" strokeWidth={1.5} />
              <line x1={cx + beamHalf} y1={pivotY} x2={cx + beamHalf + 16} y2={pivotY + 38} stroke="#64748b" strokeWidth={1.5} />
              <path d={`M ${cx + beamHalf - 22} ${pivotY + 38} Q ${cx + beamHalf} ${pivotY + 46} ${cx + beamHalf + 22} ${pivotY + 38} Z`} fill="#cbd5e1" stroke="#0f172a" strokeWidth={1.5} />
              <rect x={cx + beamHalf - 14} y={pivotY + 20} width={28} height={18} rx={2} fill="#bae6fd" stroke="#0f172a" strokeWidth={1.5} />
              <text x={cx + beamHalf} y={pivotY + 32} fontSize={9} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">{rightW}</text>
            </g>
          </g>
        );
      }

      case 'analog_clock': {
        const r = Math.min(el.width, el.height) / 2;
        const hr = (el.extraProps?.hour ?? 3) % 12;
        const min = (el.extraProps?.minute ?? 15) % 60;
        const showNums = el.extraProps?.showNumbers !== false;
        const showTicks = el.extraProps?.showMinuteTicks !== false;
        const minDeg = min * 6 - 90;
        const hrDeg = (hr + min / 60) * 30 - 90;
        const hrRad = (hrDeg * Math.PI) / 180;
        const minRad = (minDeg * Math.PI) / 180;
        return (
          <g>
            <circle cx={cx} cy={cy} r={r} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth + 0.5} />
            {showTicks && Array.from({ length: 12 }).map((_, i) => {
              const a = (i * 30 - 90) * (Math.PI / 180);
              return (
                <line
                  key={i}
                  x1={cx + (r - 6) * Math.cos(a)}
                  y1={cy + (r - 6) * Math.sin(a)}
                  x2={cx + (r - 2) * Math.cos(a)}
                  y2={cy + (r - 2) * Math.sin(a)}
                  stroke={el.stroke}
                  strokeWidth={2}
                />
              );
            })}
            {showNums && Array.from({ length: 12 }).map((_, i) => {
              const num = i === 0 ? 12 : i;
              const a = (i * 30 - 90) * (Math.PI / 180);
              return (
                <text
                  key={num}
                  x={cx + (r - 16) * Math.cos(a)}
                  y={cy + (r - 16) * Math.sin(a)}
                  fontSize={Math.max(9, Math.round(r * 0.17))}
                  fontWeight="bold"
                  fill="#0f172a"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="sans-serif"
                >
                  {num}
                </text>
              );
            })}
            <line x1={cx} y1={cy} x2={cx + r * 0.5 * Math.cos(hrRad)} y2={cy + r * 0.5 * Math.sin(hrRad)} stroke="#0f172a" strokeWidth={3.5} strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={cx + r * 0.72 * Math.cos(minRad)} y2={cy + r * 0.72 * Math.sin(minRad)} stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={3.5} fill="#0f172a" />
          </g>
        );
      }

      case 'fraction_bar': {
        const total = Math.max(1, el.extraProps?.totalParts ?? 4);
        const shaded = Math.max(0, Math.min(total, el.extraProps?.shadedParts ?? 3));
        const shadedCol = el.extraProps?.shadedColor || '#3b82f6';
        const showLabels = Boolean(el.extraProps?.showLabels);
        const partW = el.width / total;
        return (
          <g>
            {Array.from({ length: total }).map((_, i) => (
              <g key={i}>
                <rect
                  x={el.x + i * partW}
                  y={el.y}
                  width={partW}
                  height={el.height}
                  fill={i < shaded ? shadedCol : el.fill}
                  fillOpacity={i < shaded ? 0.85 : 1}
                  stroke={el.stroke}
                  strokeWidth={el.strokeWidth}
                />
                {showLabels && (
                  <text
                    x={el.x + (i + 0.5) * partW}
                    y={cy}
                    fontSize={11}
                    fontWeight="bold"
                    fill={i < shaded ? '#ffffff' : '#0f172a'}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontFamily="sans-serif"
                  >
                    1/{total}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      }

      case 'fraction_circle': {
        const total = Math.max(2, el.extraProps?.totalParts ?? 4);
        const shaded = Math.max(0, Math.min(total, el.extraProps?.shadedParts ?? 1));
        const shadedCol = el.extraProps?.shadedColor || '#3b82f6';
        const r = Math.min(el.width, el.height) / 2;
        return (
          <g>
            {Array.from({ length: total }).map((_, i) => {
              const startAngle = (i * 360) / total - 90;
              const endAngle = ((i + 1) * 360) / total - 90;
              const sRad = (startAngle * Math.PI) / 180;
              const eRad = (endAngle * Math.PI) / 180;
              const x1 = cx + r * Math.cos(sRad);
              const y1 = cy + r * Math.sin(sRad);
              const x2 = cx + r * Math.cos(eRad);
              const y2 = cy + r * Math.sin(eRad);
              const largeArc = 360 / total > 180 ? 1 : 0;
              const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
              return (
                <path
                  key={i}
                  d={d}
                  fill={i < shaded ? shadedCol : el.fill}
                  fillOpacity={i < shaded ? 0.85 : 1}
                  stroke={el.stroke}
                  strokeWidth={el.strokeWidth}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>
        );
      }

      case 'bar_chart': {
        const rawVals = String(el.extraProps?.data || '15, 30, 20, 40').split(',').map(v => parseFloat(v.trim()) || 0);
        const rawLabs = String(el.extraProps?.labels || 'A, B, C, D').split(',').map(v => v.trim());
        const title = el.extraProps?.chartTitle || '';
        const showVals = el.extraProps?.showValues !== false;
        const maxVal = Math.max(el.extraProps?.yAxisMax || 0, ...rawVals, 10);
        const padL = 32;
        const padR = 12;
        const padT = title ? 26 : 14;
        const padB = 24;
        const plotW = Math.max(40, el.width - padL - padR);
        const plotH = Math.max(30, el.height - padT - padB);
        const slotW = plotW / Math.max(1, rawVals.length);
        const barW = Math.max(8, slotW * 0.58);
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={6} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1.2} />
            {title && (
              <text x={cx} y={el.y + 16} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">{title}</text>
            )}
            {[0, 0.5, 1].map((f, idx) => {
              const gy = el.y + padT + plotH * (1 - f);
              return (
                <g key={idx}>
                  <line x1={el.x + padL} y1={gy} x2={el.x + el.width - padR} y2={gy} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="3,3" />
                  <text x={el.x + padL - 5} y={gy + 3} fontSize={9} fill="#64748b" textAnchor="end" fontFamily="sans-serif">{Math.round(maxVal * f)}</text>
                </g>
              );
            })}
            <line x1={el.x + padL} y1={el.y + padT} x2={el.x + padL} y2={el.y + padT + plotH} stroke="#334155" strokeWidth={1.8} />
            <line x1={el.x + padL} y1={el.y + padT + plotH} x2={el.x + el.width - padR} y2={el.y + padT + plotH} stroke="#334155" strokeWidth={1.8} />
            {rawVals.map((v, i) => {
              const bh = Math.max(2, (v / maxVal) * plotH);
              const bx = el.x + padL + i * slotW + (slotW - barW) / 2;
              const by = el.y + padT + plotH - bh;
              return (
                <g key={i}>
                  <rect x={bx} y={by} width={barW} height={bh} rx={2} fill={el.fill === '#f8fafc' ? '#3b82f6' : el.fill} stroke={el.stroke} strokeWidth={1.2} />
                  {showVals && (
                    <text x={bx + barW / 2} y={by - 4} fontSize={9.5} fontWeight="bold" fill="#1e293b" textAnchor="middle" fontFamily="sans-serif">{v}</text>
                  )}
                  <text x={bx + barW / 2} y={el.y + padT + plotH + 14} fontSize={10} fontWeight="bold" fill="#334155" textAnchor="middle" fontFamily="sans-serif">{rawLabs[i] || `${i + 1}`}</text>
                </g>
              );
            })}
          </g>
        );
      }

      case 'ruler_cm': {
        const cmLen = Math.max(2, Math.min(20, el.extraProps?.cmLength ?? 10));
        const showMm = el.extraProps?.showMm !== false;
        const objLen = el.extraProps?.measureObjectLength ?? 0;
        const objLab = el.extraProps?.objectLabel || '';
        const rulerY = objLen > 0 ? el.y + el.height * 0.45 : el.y;
        const rulerH = objLen > 0 ? el.height * 0.55 : el.height;
        const padX = 12;
        const scaleW = el.width - padX * 2;
        const cmStep = scaleW / cmLen;
        return (
          <g>
            {objLen > 0 && (
              <g>
                <rect x={el.x + padX} y={el.y + 4} width={Math.min(scaleW, objLen * cmStep)} height={Math.max(12, el.height * 0.32)} rx={3} fill="#93c5fd" stroke="#1e3a8a" strokeWidth={1.5} />
                <line x1={el.x + padX + Math.min(scaleW, objLen * cmStep)} y1={el.y + 4} x2={el.x + padX + Math.min(scaleW, objLen * cmStep)} y2={rulerY} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3,2" />
                {objLab && (
                  <text x={el.x + padX + Math.min(scaleW, objLen * cmStep) / 2} y={el.y + 4 + Math.max(12, el.height * 0.32) / 2} fontSize={10} fontWeight="bold" fill="#1e3a8a" textAnchor="middle" dominantBaseline="central" fontFamily="sans-serif">{objLab}</text>
                )}
              </g>
            )}
            <rect x={el.x} y={rulerY} width={el.width} height={rulerH} rx={3} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {Array.from({ length: cmLen * (showMm ? 10 : 1) + 1 }).map((_, idx) => {
              const isCm = showMm ? idx % 10 === 0 : true;
              const isHalfCm = showMm ? idx % 5 === 0 && !isCm : false;
              const tx = el.x + padX + (idx / (showMm ? 10 : 1)) * cmStep;
              const tickH = isCm ? rulerH * 0.42 : isHalfCm ? rulerH * 0.28 : rulerH * 0.16;
              return (
                <g key={idx}>
                  <line x1={tx} y1={rulerY} x2={tx} y2={rulerY + tickH} stroke={el.stroke} strokeWidth={isCm ? 1.5 : 0.8} />
                  {isCm && (
                    <text x={tx} y={rulerY + tickH + 10} fontSize={9.5} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily="sans-serif">
                      {showMm ? idx / 10 : idx}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={el.x + el.width - 10} y={rulerY + rulerH - 5} fontSize={8.5} fontWeight="bold" fill="#475569" textAnchor="end" fontFamily="sans-serif">cm</text>
          </g>
        );
      }

      case 'table_grid': {
        const rows = Math.max(1, Math.min(8, el.extraProps?.rows ?? 3));
        const cols = Math.max(1, Math.min(8, el.extraProps?.cols ?? 3));
        const hasHeader = el.extraProps?.hasHeader !== false;
        const rawMatrix = String(el.extraProps?.dataMatrix || '').split('|').map(r => r.split(',').map(c => c.trim()));
        const cellW = el.width / cols;
        const cellH = el.height / rows;
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {hasHeader && (
              <rect x={el.x} y={el.y} width={el.width} height={cellH} fill="#e2e8f0" stroke={el.stroke} strokeWidth={el.strokeWidth} />
            )}
            {Array.from({ length: rows }).map((_, rIdx) =>
              Array.from({ length: cols }).map((__, cIdx) => {
                const cellText = rawMatrix[rIdx]?.[cIdx] || '';
                return (
                  <g key={`${rIdx}-${cIdx}`}>
                    <rect x={el.x + cIdx * cellW} y={el.y + rIdx * cellH} width={cellW} height={cellH} fill="none" stroke={el.stroke} strokeWidth={1} />
                    {cellText && (
                      <text
                        x={el.x + (cIdx + 0.5) * cellW}
                        y={el.y + (rIdx + 0.5) * cellH}
                        fontSize={el.fontSize || 12}
                        fontWeight={rIdx === 0 && hasHeader ? 'bold' : 'normal'}
                        fill="#0f172a"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={el.fontFamily || 'Sarabun, sans-serif'}
                      >
                        {cellText}
                      </text>
                    )}
                  </g>
                );
              })
            )}
          </g>
        );
      }

      // --- Diagrams, Social & Logic ---
      case 'compass_rose': {
        const r = el.width / 2;
        return (
          <g>
            <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,3" />
            <polygon points={`${cx},${cy - r + 4} ${cx - 7},${cy} ${cx + 7},${cy}`} fill="#ef4444" />
            <polygon points={`${cx},${cy + r - 4} ${cx - 7},${cy} ${cx + 7},${cy}`} fill="#3b82f6" />
            <polygon points={`${cx - r + 4},${cy} ${cx},${cy - 7} ${cx},${cy + 7}`} fill="#64748b" />
            <polygon points={`${cx + r - 4},${cy} ${cx},${cy - 7} ${cx},${cy + 7}`} fill="#64748b" />
            <text x={cx} y={cy - r + 14} fontSize={13} fontWeight="bold" fill="#b91c1c" textAnchor="middle" fontFamily="sans-serif">N</text>
            <text x={cx} y={cy + r - 4} fontSize={12} fontWeight="bold" fill="#1d4ed8" textAnchor="middle" fontFamily="sans-serif">S</text>
            <text x={el.x + el.width - 12} y={cy + 4} fontSize={12} fontWeight="bold" fill="#334155" textAnchor="middle" fontFamily="sans-serif">E</text>
            <text x={el.x + 12} y={cy + 4} fontSize={12} fontWeight="bold" fill="#334155" textAnchor="middle" fontFamily="sans-serif">W</text>
          </g>
        );
      }

      case 'venn_2': {
        const r = el.height * 0.45;
        const labA = el.extraProps?.labelA || 'A';
        const labB = el.extraProps?.labelB || 'B';
        const highlight = el.extraProps?.highlightRegion || 'none';

        return (
          <g>
            <circle cx={el.x + r} cy={cy} r={r} fill={highlight === 'a_only' || highlight === 'union' ? '#dbeafe' : 'none'} stroke="#2563eb" strokeWidth={2} />
            <circle cx={el.x + el.width - r} cy={cy} r={r} fill={highlight === 'b_only' || highlight === 'union' ? '#fee2e2' : 'none'} stroke="#dc2626" strokeWidth={2} />
            {highlight === 'intersection' && (
              <ellipse cx={cx} cy={cy} rx={r * 0.35} ry={r * 0.7} fill="#e0e7ff" opacity={0.8} />
            )}
            <text x={el.x + r * 0.5} y={cy - r * 0.6} fontSize={14} fontWeight="bold" fill="#2563eb" fontFamily="sans-serif">{labA}</text>
            <text x={el.x + el.width - r * 0.8} y={cy - r * 0.6} fontSize={14} fontWeight="bold" fill="#dc2626" fontFamily="sans-serif">{labB}</text>
          </g>
        );
      }

      case 'venn_3': {
        const r = el.width * 0.32;
        const labA = el.extraProps?.labelA || 'A';
        const labB = el.extraProps?.labelB || 'B';
        const labC = el.extraProps?.labelC || 'C';
        return (
          <g>
            <circle cx={cx - r * 0.5} cy={cy - r * 0.3} r={r} fill="none" stroke="#2563eb" strokeWidth={1.8} />
            <circle cx={cx + r * 0.5} cy={cy - r * 0.3} r={r} fill="none" stroke="#dc2626" strokeWidth={1.8} />
            <circle cx={cx} cy={cy + r * 0.5} r={r} fill="none" stroke="#16a34a" strokeWidth={1.8} />
            <text x={cx - r} y={cy - r * 0.6} fontSize={13} fontWeight="bold" fill="#2563eb" fontFamily="sans-serif">{labA}</text>
            <text x={cx + r * 0.8} y={cy - r * 0.6} fontSize={13} fontWeight="bold" fill="#dc2626" fontFamily="sans-serif">{labB}</text>
            <text x={cx} y={cy + r * 1.1} fontSize={13} fontWeight="bold" fill="#16a34a" textAnchor="middle" fontFamily="sans-serif">{labC}</text>
          </g>
        );
      }

      case 'flowchart_terminator':
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={el.height / 2} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {el.text && (
              <text x={cx} y={cy} dominantBaseline="central" fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );

      case 'flowchart_process':
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {el.text && (
              <text x={cx} y={cy} dominantBaseline="central" fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );

      case 'flowchart_decision': {
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
        return (
          <g>
            <polygon points={pts} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {el.text && (
              <text x={cx} y={cy} dominantBaseline="central" fontSize={el.fontSize || 12} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );
      }

      case 'flowchart_data': {
        const offset = el.width * 0.2;
        const pts = `${el.x + offset},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width - offset},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return (
          <g>
            <polygon points={pts} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {el.text && (
              <text x={cx} y={cy} dominantBaseline="central" fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );
      }

      case 'speech_bubble': {
        const tailDir = el.extraProps?.tailDirection || 'bottom-left';
        const tailH = 18;
        const r = 12;
        const boxH = el.height - tailH;
        const boxY = tailDir.startsWith('top') ? el.y + tailH : el.y;
        const tailBaseX1 = tailDir.endsWith('right') ? el.x + el.width - 36 : el.x + 22;
        const tailBaseX2 = tailDir.endsWith('right') ? el.x + el.width - 22 : el.x + 36;
        const tailTipX = tailDir.endsWith('right') ? el.x + el.width - 14 : el.x + 14;
        const tailTipY = tailDir.startsWith('top') ? el.y : el.y + el.height;
        const tailAttachY = tailDir.startsWith('top') ? boxY : boxY + boxH;
        return (
          <g>
            <rect x={el.x} y={boxY} width={el.width} height={boxH} rx={r} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            <polygon points={`${tailBaseX1},${tailAttachY} ${tailTipX},${tailTipY} ${tailBaseX2},${tailAttachY}`} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeLinejoin="round" />
            {el.text && (
              <text x={cx} y={boxY + boxH / 2} dominantBaseline="central" fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );
      }

      case 'timeline': {
        const ptsCount = el.extraProps?.pointCount ?? 4;
        return (
          <g>
            <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke="#0f172a" strokeWidth={3} />
            <polygon points={`${el.x + el.width},${cy} ${el.x + el.width - 10},${cy - 5} ${el.x + el.width - 10},${cy + 5}`} fill="#0f172a" />
            {Array.from({ length: ptsCount }).map((_, i) => {
              const tx = el.x + 40 + i * ((el.width - 80) / Math.max(1, ptsCount - 1));
              return (
                <g key={i}>
                  <circle cx={tx} cy={cy} r={5} fill="#ffffff" stroke="#2563eb" strokeWidth={2.5} />
                  <text x={tx} y={cy - 12} fontSize={11} fontWeight="bold" fill="#1e293b" textAnchor="middle" fontFamily="sans-serif">ขั้นที่ {i + 1}</text>
                </g>
              );
            })}
          </g>
        );
      }

      // --- Text & Overlays ---
      case 'text_label':
      case 'math_label':
        return (
          <text 
            x={el.textAlign === 'center' ? cx : el.textAlign === 'right' ? el.x + el.width - 4 : el.x + 4} 
            y={cy}
            dominantBaseline="central"
            fontSize={el.fontSize || 14} 
            fontWeight={el.fontWeight || 'bold'} 
            fill={el.stroke && el.stroke !== 'none' ? el.stroke : '#0f172a'} 
            fontFamily={el.fontFamily || 'Sarabun, sans-serif'}
            textAnchor={el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start'}
          >
            {el.text || ''}
          </text>
        );

      case 'image_overlay':
        return <image href={el.imageUrl} x={el.x} y={el.y} width={el.width} height={el.height} preserveAspectRatio="xMidYMid meet" />;

      default:
        return <rect x={el.x} y={el.y} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />;
    }
  };

  // Helper string generator for SVG tags (100% Identical Parity with JSX)
  const renderElementSvgString = (el: CanvasElement): string => {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const dash = el.strokeDasharray ? `stroke-dasharray="${el.strokeDasharray}"` : '';
    const fillOp = el.fillOpacity !== undefined ? `fill-opacity="${el.fillOpacity}"` : '';
    const strokeOp = el.strokeOpacity !== undefined ? `stroke-opacity="${el.strokeOpacity}"` : '';
    const safeText = escapeXml(el.text || '');

    switch (el.type) {
      case 'rect':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.rx || 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;

      case 'rounded_rect':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="16" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;

      case 'circle': {
        const r = Math.min(el.width, el.height) / 2;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'ellipse':
        return `<ellipse cx="${cx}" cy="${cy}" rx="${el.width / 2}" ry="${el.height / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;

      case 'semicircle': {
        const r = el.width / 2;
        const d = `M ${el.x} ${el.y + el.height} A ${r} ${el.height} 0 0 1 ${el.x + el.width} ${el.y + el.height} Z`;
        return `<path d="${d}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'sector_pie': {
        const r = el.width / 2;
        const d = `M ${cx} ${cy} L ${cx} ${el.y} A ${r} ${r} 0 0 1 ${el.x + el.width} ${cy} Z`;
        return `<path d="${d}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'triangle': {
        const pts = `${cx},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'right_triangle': {
        const orientation = el.extraProps?.orientation || 'bottom-left';
        let pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y}`;
        const markerSize = Math.min(18, Math.min(el.width, el.height) * 0.22);
        let markerPts = `${el.x},${el.y + el.height - markerSize} ${el.x + markerSize},${el.y + el.height - markerSize} ${el.x + markerSize},${el.y + el.height}`;

        if (orientation === 'bottom-right') {
          pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x + el.width},${el.y}`;
          markerPts = `${el.x + el.width - markerSize},${el.y + el.height} ${el.x + el.width - markerSize},${el.y + el.height - markerSize} ${el.x + el.width},${el.y + el.height - markerSize}`;
        } else if (orientation === 'top-left') {
          pts = `${el.x},${el.y} ${el.x + el.width},${el.y} ${el.x},${el.y + el.height}`;
          markerPts = `${el.x},${el.y + markerSize} ${el.x + markerSize},${el.y + markerSize} ${el.x + markerSize},${el.y}`;
        } else if (orientation === 'top-right') {
          pts = `${el.x},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width},${el.y + el.height}`;
          markerPts = `${el.x + el.width - markerSize},${el.y} ${el.x + el.width - markerSize},${el.y + markerSize} ${el.x + el.width},${el.y + markerSize}`;
        }

        const markerTag = el.extraProps?.showRightAngle !== false
          ? `<polyline points="${markerPts}" fill="none" stroke="${el.stroke}" stroke-width="1.8"/>`
          : '';
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>${markerTag}`;
      }

      case 'parallelogram': {
        const slant = el.extraProps?.slant ?? (el.width * 0.22);
        const pts = `${el.x + slant},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width - slant},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'trapezoid': {
        const topInset = el.extraProps?.topInset ?? (el.width * 0.2);
        const pts = `${el.x + topInset},${el.y} ${el.x + el.width - topInset},${el.y} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'rhombus': {
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'pentagon': {
        const r = Math.min(el.width, el.height) / 2;
        const pts = Array.from({ length: 5 }).map((_, i) => {
          const a = (i * 72 - 90) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'hexagon': {
        const r = Math.min(el.width, el.height) / 2;
        const pts = Array.from({ length: 6 }).map((_, i) => {
          const a = (i * 60 - 30) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      case 'star_5': {
        const rOuter = Math.min(el.width, el.height) / 2;
        const rInner = rOuter * 0.42;
        const pts = Array.from({ length: 10 }).map((_, i) => {
          const r = i % 2 === 0 ? rOuter : rInner;
          const a = (i * 36 - 90) * (Math.PI / 180);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round" ${fillOp} ${strokeOp} ${dash}/>`;
      }

      // --- 3D Solids ---
      case 'cube_3d':
      case 'box_3d': {
        const depth = Math.min(el.width, el.height) * 0.3;
        const fw = el.width - depth;
        const fh = el.height - depth;
        return `<line x1="${el.x}" y1="${el.y + el.height}" x2="${el.x + depth}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x + depth}" y1="${el.y + el.height - depth}" x2="${el.x + el.width}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x + depth}" y1="${el.y + el.height - depth}" x2="${el.x + depth}" y2="${el.y}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<rect x="${el.x}" y="${el.y + depth}" width="${fw}" height="${fh}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>
<polygon points="${el.x},${el.y + depth} ${el.x + depth},${el.y} ${el.x + el.width},${el.y} ${el.x + fw},${el.y + depth}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>
<polygon points="${el.x + fw},${el.y + depth} ${el.x + el.width},${el.y} ${el.x + el.width},${el.y + fh} ${el.x + fw},${el.y + el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>`;
      }

      case 'cylinder_3d': {
        const ry = Math.min(22, el.height * 0.16);
        const topY = el.y + ry;
        const botY = el.y + el.height - ry;
        return `<path d="M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 1 ${el.x + el.width} ${botY}" fill="none" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<path d="M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 0 ${el.x + el.width} ${botY}" fill="none" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<line x1="${el.x}" y1="${topY}" x2="${el.x}" y2="${botY}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<line x1="${el.x + el.width}" y1="${topY}" x2="${el.x + el.width}" y2="${botY}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<ellipse cx="${cx}" cy="${topY}" rx="${el.width / 2}" ry="${ry}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>`;
      }

      case 'cone_3d': {
        const ry = Math.min(22, el.height * 0.18);
        const botY = el.y + el.height - ry;
        return `<path d="M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 1 ${el.x + el.width} ${botY}" fill="none" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<path d="M ${el.x} ${botY} A ${el.width / 2} ${ry} 0 0 0 ${el.x + el.width} ${botY}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>
<line x1="${el.x}" y1="${botY}" x2="${cx}" y2="${el.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<line x1="${el.x + el.width}" y1="${botY}" x2="${cx}" y2="${el.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`;
      }

      case 'sphere_3d': {
        const r = Math.min(el.width, el.height) / 2;
        const ry = r * 0.35;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>
<path d="M ${cx - r} ${cy} A ${r} ${ry} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<path d="M ${cx - r} ${cy} A ${r} ${ry} 0 0 0 ${cx + r} ${cy}" fill="none" stroke="${el.stroke}" stroke-width="1.5"/>
<circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.12}" fill="#ffffff" opacity="0.6"/>`;
      }

      case 'pyramid_3d': {
        const apexX = cx;
        const apexY = el.y;
        const depth = el.height * 0.3;
        const p1 = `${el.x},${el.y + el.height}`;
        const p2 = `${el.x + el.width * 0.75},${el.y + el.height}`;
        const p3 = `${el.x + el.width},${el.y + el.height - depth}`;
        return `<line x1="${el.x}" y1="${el.y + el.height}" x2="${el.x + el.width * 0.25}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x + el.width * 0.25}" y1="${el.y + el.height - depth}" x2="${el.x + el.width}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x + el.width * 0.25}" y1="${el.y + el.height - depth}" x2="${apexX}" y2="${apexY}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<polygon points="${p1} ${p2} ${apexX},${apexY}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>
<polygon points="${p2} ${p3} ${apexX},${apexY}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>`;
      }

      case 'triangular_prism_3d': {
        const depth = el.width * 0.35;
        const frontW = el.width - depth;
        return `<line x1="${el.x + depth}" y1="${el.y}" x2="${el.x + el.width}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x + depth}" y1="${el.y + el.height - depth}" x2="${el.x + el.width}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x}" y1="${el.y + el.height}" x2="${el.x + depth}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<line x1="${el.x}" y1="${el.y + depth}" x2="${el.x + depth}" y2="${el.y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<line x1="${el.x + frontW}" y1="${el.y + el.height}" x2="${el.x + el.width}" y2="${el.y + el.height - depth}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<polygon points="${el.x},${el.y + depth} ${el.x + frontW},${el.y + el.height} ${el.x},${el.y + el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${fillOp}/>`;
      }

      // --- Lines, Measurements & Math Tools ---
      case 'line':
      case 'arrow':
      case 'polygon_custom':
      case 'parallel_transversal':
      case 'intersecting_lines':
        return renderCustomLineAndIntersectionMarkup(el);

      case 'dimension_line':
        return `<line x1="${el.x}" y1="${cy - 6}" x2="${el.x}" y2="${cy + 6}" stroke="${el.stroke}" stroke-width="1.8"/>
<line x1="${el.x + el.width}" y1="${cy - 6}" x2="${el.x + el.width}" y2="${cy + 6}" stroke="${el.stroke}" stroke-width="1.8"/>
<line x1="${el.x + 4}" y1="${cy}" x2="${el.x + el.width - 4}" y2="${cy}" stroke="${el.stroke}" stroke-width="1.5" stroke-dasharray="3,3"/>
<text x="${cx}" y="${cy - 6}" font-size="${el.fontSize || 13}" font-weight="${el.fontWeight || 'bold'}" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>`;

      case 'angle_arc': {
        const angle = el.extraProps?.angle ?? 60;
        const radius = el.extraProps?.radius ?? Math.min(el.width, el.height) * 0.45;
        const rad = (angle * Math.PI) / 180;
        const ray2X = el.x + el.width * Math.cos(rad);
        const ray2Y = el.y + el.height - el.width * Math.sin(rad);
        const arcEndX = el.x + radius * Math.cos(rad);
        const arcEndY = el.y + el.height - radius * Math.sin(rad);
        const largeArc = angle > 180 ? 1 : 0;
        const arcPath = `M ${el.x + radius} ${el.y + el.height} A ${radius} ${radius} 0 ${largeArc} 0 ${arcEndX} ${arcEndY}`;

        const midAngle = (angle / 2) * (Math.PI / 180);
        const labelDist = radius + 14;
        const labelX = el.x + labelDist * Math.cos(midAngle);
        const labelY = el.y + el.height - labelDist * Math.sin(midAngle) + 4;
        const labelTag = el.extraProps?.showDegree !== false
          ? `<text x="${labelX}" y="${labelY}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#2563eb" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText || `${angle}°`}</text>`
          : '';

        return `<line x1="${el.x}" y1="${el.y + el.height}" x2="${el.x + el.width}" y2="${el.y + el.height}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 2}"/>
<line x1="${el.x}" y1="${el.y + el.height}" x2="${ray2X}" y2="${ray2Y}" stroke="${el.stroke}" stroke-width="${el.strokeWidth || 2}"/>
<path d="${arcPath}" fill="none" stroke="#2563eb" stroke-width="1.8"/>${labelTag}`;
      }

      case 'protractor': {
        const r = el.width / 2;
        return `<path d="M ${el.x} ${el.y + el.height} A ${r} ${el.height} 0 0 1 ${el.x + el.width} ${el.y + el.height} Z" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
<line x1="${cx}" y1="${el.y + el.height}" x2="${cx}" y2="${el.y + el.height - 8}" stroke="#0284c7" stroke-width="2"/>
<text x="${cx}" y="${el.y + el.height - 12}" font-size="11" font-weight="bold" fill="#0369a1" text-anchor="middle" font-family="sans-serif">90°</text>
<text x="${el.x + 12}" y="${el.y + el.height - 4}" font-size="10" fill="#0369a1" font-family="sans-serif">0°</text>
<text x="${el.x + el.width - 24}" y="${el.y + el.height - 4}" font-size="10" fill="#0369a1" font-family="sans-serif">180°</text>`;
      }

      case 'axes_xy': {
        const showGridLines = el.extraProps?.showGrid;
        const showArrows = el.extraProps?.showArrows !== false;
        const xLab = escapeXml(el.extraProps?.xLabel || 'X');
        const yLab = escapeXml(el.extraProps?.yLabel || 'Y');
        const oLab = escapeXml(el.extraProps?.originLabel || 'O');

        const gridMarkup = showGridLines
          ? [-3, -2, -1, 1, 2, 3].map(i => `<line x1="${cx + i * (el.width / 8)}" y1="${el.y}" x2="${cx + i * (el.width / 8)}" y2="${el.y + el.height}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>\n<line x1="${el.x}" y1="${cy + i * (el.height / 8)}" x2="${el.x + el.width}" y2="${cy + i * (el.height / 8)}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>`).join('\n')
          : '';
        const arrowX = showArrows ? `<polygon points="${el.x + el.width - 6},${cy - 4} ${el.x + el.width},${cy} ${el.x + el.width - 6},${cy + 4}" fill="#334155"/>` : '';
        const arrowY = showArrows ? `<polygon points="${cx - 4},${el.y + 6} ${cx},${el.y} ${cx + 4},${el.y + 6}" fill="#334155"/>` : '';

        return `${gridMarkup}
<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="#334155" stroke-width="2"/>
<line x1="${cx}" y1="${el.y}" x2="${cx}" y2="${el.y + el.height}" stroke="#334155" stroke-width="2"/>
${arrowX}
${arrowY}
<text x="${el.x + el.width - 4}" y="${cy - 8}" font-size="13" font-weight="bold" fill="#1e293b" font-family="sans-serif">${xLab}</text>
<text x="${cx + 8}" y="${el.y + 12}" font-size="13" font-weight="bold" fill="#1e293b" font-family="sans-serif">${yLab}</text>
<text x="${cx - 10}" y="${cy + 14}" font-size="11" fill="#64748b" font-family="sans-serif">${oLab}</text>`;
      }

      case 'number_line': {
        const minVal = el.extraProps?.min ?? -5;
        const maxVal = el.extraProps?.max ?? 5;
        const stepVal = el.extraProps?.step ?? 1;
        const range = Math.max(1, maxVal - minVal);
        const count = Math.floor(range / stepVal);
        const stepWidth = el.width / count;
        const markerVal = el.extraProps?.markerValue;
        const markerType = el.extraProps?.markerType || 'closed';
        const ineqRay = el.extraProps?.inequalityRay || 'none';

        const markerX = markerVal !== undefined ? el.x + ((markerVal - minVal) / range) * el.width : null;

        const ticks = Array.from({ length: count + 1 }).map((_, i) => {
          const tx = el.x + i * stepWidth;
          const val = minVal + i * stepVal;
          return `<line x1="${tx}" y1="${cy - 5}" x2="${tx}" y2="${cy + 5}" stroke="#1e293b" stroke-width="1.5"/>
<text x="${tx}" y="${cy + 18}" font-size="10" fill="#334155" text-anchor="middle" font-family="sans-serif">${val}</text>`;
        }).join('\n');

        let markerMarkup = '';
        if (markerX !== null) {
          if (ineqRay === 'left') {
            markerMarkup += `<line x1="${markerX}" y1="${cy}" x2="${el.x + 4}" y2="${cy}" stroke="#dc2626" stroke-width="3"/>`;
          } else if (ineqRay === 'right') {
            markerMarkup += `<line x1="${markerX}" y1="${cy}" x2="${el.x + el.width - 4}" y2="${cy}" stroke="#dc2626" stroke-width="3"/>`;
          }
          if (markerType === 'closed') {
            markerMarkup += `<circle cx="${markerX}" cy="${cy}" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.5"/>`;
          } else if (markerType === 'open') {
            markerMarkup += `<circle cx="${markerX}" cy="${cy}" r="5" fill="#ffffff" stroke="#dc2626" stroke-width="2"/>`;
          }
        }

        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="#1e293b" stroke-width="2"/>
<polygon points="${el.x + 6},${cy - 4} ${el.x},${cy} ${el.x + 6},${cy + 4}" fill="#1e293b"/>
<polygon points="${el.x + el.width - 6},${cy - 4} ${el.x + el.width},${cy} ${el.x + el.width - 6},${cy + 4}" fill="#1e293b"/>
${ticks}
${markerMarkup}`;
      }

      case 'analog_clock': {
        const r = Math.min(el.width, el.height) / 2;
        const hr = (el.extraProps?.hour ?? 3) % 12;
        const min = (el.extraProps?.minute ?? 15) % 60;
        const showNums = el.extraProps?.showNumbers !== false;
        const showTicks = el.extraProps?.showMinuteTicks !== false;
        const minDeg = min * 6 - 90;
        const hrDeg = (hr + min / 60) * 30 - 90;
        const hrRad = (hrDeg * Math.PI) / 180;
        const minRad = (minDeg * Math.PI) / 180;
        const ticksStr = showTicks ? Array.from({ length: 12 }).map((_, i) => {
          const a = (i * 30 - 90) * (Math.PI / 180);
          return `<line x1="${cx + (r - 6) * Math.cos(a)}" y1="${cy + (r - 6) * Math.sin(a)}" x2="${cx + (r - 2) * Math.cos(a)}" y2="${cy + (r - 2) * Math.sin(a)}" stroke="${el.stroke}" stroke-width="2"/>`;
        }).join('\n') : '';
        const numsStr = showNums ? Array.from({ length: 12 }).map((_, i) => {
          const num = i === 0 ? 12 : i;
          const a = (i * 30 - 90) * (Math.PI / 180);
          return `<text x="${cx + (r - 16) * Math.cos(a)}" y="${cy + (r - 16) * Math.sin(a)}" font-size="${Math.max(9, Math.round(r * 0.17))}" font-weight="bold" fill="#0f172a" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${num}</text>`;
        }).join('\n') : '';
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth + 0.5}"/>
${ticksStr}
${numsStr}
<line x1="${cx}" y1="${cy}" x2="${cx + r * 0.5 * Math.cos(hrRad)}" y2="${cy + r * 0.5 * Math.sin(hrRad)}" stroke="#0f172a" stroke-width="3.5" stroke-linecap="round"/>
<line x1="${cx}" y1="${cy}" x2="${cx + r * 0.72 * Math.cos(minRad)}" y2="${cy + r * 0.72 * Math.sin(minRad)}" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/>
<circle cx="${cx}" cy="${cy}" r="3.5" fill="#0f172a"/>`;
      }

      case 'fraction_bar': {
        const total = Math.max(1, el.extraProps?.totalParts ?? 4);
        const shaded = Math.max(0, Math.min(total, el.extraProps?.shadedParts ?? 3));
        const shadedCol = el.extraProps?.shadedColor || '#3b82f6';
        const showLabels = Boolean(el.extraProps?.showLabels);
        const partW = el.width / total;
        return Array.from({ length: total }).map((_, i) => {
          const rectTag = `<rect x="${el.x + i * partW}" y="${el.y}" width="${partW}" height="${el.height}" fill="${i < shaded ? shadedCol : el.fill}" fill-opacity="${i < shaded ? 0.85 : 1}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`;
          const txtTag = showLabels ? `<text x="${el.x + (i + 0.5) * partW}" y="${cy}" font-size="11" font-weight="bold" fill="${i < shaded ? '#ffffff' : '#0f172a'}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">1/${total}</text>` : '';
          return `${rectTag}${txtTag}`;
        }).join('\n');
      }

      case 'fraction_circle': {
        const total = Math.max(2, el.extraProps?.totalParts ?? 4);
        const shaded = Math.max(0, Math.min(total, el.extraProps?.shadedParts ?? 1));
        const shadedCol = el.extraProps?.shadedColor || '#3b82f6';
        const r = Math.min(el.width, el.height) / 2;
        return Array.from({ length: total }).map((_, i) => {
          const startAngle = (i * 360) / total - 90;
          const endAngle = ((i + 1) * 360) / total - 90;
          const sRad = (startAngle * Math.PI) / 180;
          const eRad = (endAngle * Math.PI) / 180;
          const x1 = cx + r * Math.cos(sRad);
          const y1 = cy + r * Math.sin(sRad);
          const x2 = cx + r * Math.cos(eRad);
          const y2 = cy + r * Math.sin(eRad);
          const largeArc = 360 / total > 180 ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          return `<path d="${d}" fill="${i < shaded ? shadedCol : el.fill}" fill-opacity="${i < shaded ? 0.85 : 1}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round"/>`;
        }).join('\n');
      }

      case 'bar_chart': {
        const rawVals = String(el.extraProps?.data || '15, 30, 20, 40').split(',').map(v => parseFloat(v.trim()) || 0);
        const rawLabs = String(el.extraProps?.labels || 'A, B, C, D').split(',').map(v => v.trim());
        const title = escapeXml(el.extraProps?.chartTitle || '');
        const showVals = el.extraProps?.showValues !== false;
        const maxVal = Math.max(el.extraProps?.yAxisMax || 0, ...rawVals, 10);
        const padL = 32;
        const padR = 12;
        const padT = title ? 26 : 14;
        const padB = 24;
        const plotW = Math.max(40, el.width - padL - padR);
        const plotH = Math.max(30, el.height - padT - padB);
        const slotW = plotW / Math.max(1, rawVals.length);
        const barW = Math.max(8, slotW * 0.58);
        const gridStr = [0, 0.5, 1].map(f => {
          const gy = el.y + padT + plotH * (1 - f);
          return `<line x1="${el.x + padL}" y1="${gy}" x2="${el.x + el.width - padR}" y2="${gy}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>\n<text x="${el.x + padL - 5}" y="${gy + 3}" font-size="9" fill="#64748b" text-anchor="end" font-family="sans-serif">${Math.round(maxVal * f)}</text>`;
        }).join('\n');
        const barsStr = rawVals.map((v, i) => {
          const bh = Math.max(2, (v / maxVal) * plotH);
          const bx = el.x + padL + i * slotW + (slotW - barW) / 2;
          const by = el.y + padT + plotH - bh;
          const vTag = showVals ? `<text x="${bx + barW / 2}" y="${by - 4}" font-size="9.5" font-weight="bold" fill="#1e293b" text-anchor="middle" font-family="sans-serif">${v}</text>` : '';
          return `<rect x="${bx}" y="${by}" width="${barW}" height="${bh}" rx="2" fill="${el.fill === '#f8fafc' ? '#3b82f6' : el.fill}" stroke="${el.stroke}" stroke-width="1.2"/>${vTag}<text x="${bx + barW / 2}" y="${el.y + padT + plotH + 14}" font-size="10" font-weight="bold" fill="#334155" text-anchor="middle" font-family="sans-serif">${escapeXml(rawLabs[i] || `${i + 1}`)}</text>`;
        }).join('\n');
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2"/>
${title ? `<text x="${cx}" y="${el.y + 16}" font-size="12" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${title}</text>` : ''}
${gridStr}
<line x1="${el.x + padL}" y1="${el.y + padT}" x2="${el.x + padL}" y2="${el.y + padT + plotH}" stroke="#334155" stroke-width="1.8"/>
<line x1="${el.x + padL}" y1="${el.y + padT + plotH}" x2="${el.x + el.width - padR}" y2="${el.y + padT + plotH}" stroke="#334155" stroke-width="1.8"/>
${barsStr}`;
      }

      case 'ruler_cm': {
        const cmLen = Math.max(2, Math.min(20, el.extraProps?.cmLength ?? 10));
        const showMm = el.extraProps?.showMm !== false;
        const objLen = el.extraProps?.measureObjectLength ?? 0;
        const objLab = escapeXml(el.extraProps?.objectLabel || '');
        const rulerY = objLen > 0 ? el.y + el.height * 0.45 : el.y;
        const rulerH = objLen > 0 ? el.height * 0.55 : el.height;
        const padX = 12;
        const scaleW = el.width - padX * 2;
        const cmStep = scaleW / cmLen;
        const objStr = objLen > 0 ? `<rect x="${el.x + padX}" y="${el.y + 4}" width="${Math.min(scaleW, objLen * cmStep)}" height="${Math.max(12, el.height * 0.32)}" rx="3" fill="#93c5fd" stroke="#1e3a8a" stroke-width="1.5"/>
<line x1="${el.x + padX + Math.min(scaleW, objLen * cmStep)}" y1="${el.y + 4}" x2="${el.x + padX + Math.min(scaleW, objLen * cmStep)}" y2="${rulerY}" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="3,2"/>
${objLab ? `<text x="${el.x + padX + Math.min(scaleW, objLen * cmStep) / 2}" y="${el.y + 4 + Math.max(12, el.height * 0.32) / 2}" font-size="10" font-weight="bold" fill="#1e3a8a" text-anchor="middle" dominant-baseline="central" font-family="sans-serif">${objLab}</text>` : ''}` : '';
        const ticksStr = Array.from({ length: cmLen * (showMm ? 10 : 1) + 1 }).map((_, idx) => {
          const isCm = showMm ? idx % 10 === 0 : true;
          const isHalfCm = showMm ? idx % 5 === 0 && !isCm : false;
          const tx = el.x + padX + (idx / (showMm ? 10 : 1)) * cmStep;
          const tickH = isCm ? rulerH * 0.42 : isHalfCm ? rulerH * 0.28 : rulerH * 0.16;
          return `<line x1="${tx}" y1="${rulerY}" x2="${tx}" y2="${rulerY + tickH}" stroke="${el.stroke}" stroke-width="${isCm ? 1.5 : 0.8}"/>${isCm ? `<text x="${tx}" y="${rulerY + tickH + 10}" font-size="9.5" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${showMm ? idx / 10 : idx}</text>` : ''}`;
        }).join('\n');
        return `${objStr}
<rect x="${el.x}" y="${rulerY}" width="${el.width}" height="${rulerH}" rx="3" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${ticksStr}
<text x="${el.x + el.width - 10}" y="${rulerY + rulerH - 5}" font-size="8.5" font-weight="bold" fill="#475569" text-anchor="end" font-family="sans-serif">cm</text>`;
      }

      // --- Science & Circuits ---
      case 'circuit_bulb': {
        const isGlowing = el.extraProps?.glowing;
        const glowCircle = isGlowing ? `<circle cx="${cx}" cy="${cy}" r="${el.width * 0.75}" fill="#fef08a" opacity="0.35"/>` : '';
        const bulbFill = isGlowing ? '#fef08a' : el.fill;
        return `${glowCircle}
<circle cx="${cx}" cy="${cy}" r="${el.width / 2}" fill="${bulbFill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<line x1="${cx - 10}" y1="${cy - 10}" x2="${cx + 10}" y2="${cy + 10}" stroke="${el.stroke}" stroke-width="2"/>
<line x1="${cx - 10}" y1="${cy + 10}" x2="${cx + 10}" y2="${cy - 10}" stroke="${el.stroke}" stroke-width="2"/>`;
      }

      case 'circuit_battery': {
        const isFlipped = el.extraProps?.flipped;
        const leftSign = isFlipped ? '-' : '+';
        const rightSign = isFlipped ? '+' : '-';
        const leftPlateH = isFlipped ? 14 : 28;
        const rightPlateH = isFlipped ? 28 : 14;

        return `<line x1="${el.x}" y1="${cy}" x2="${cx - 6}" y2="${cy}" stroke="${el.stroke}" stroke-width="2.5"/>
<line x1="${cx + 6}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="${el.stroke}" stroke-width="2.5"/>
<line x1="${cx - 6}" y1="${cy - leftPlateH / 2}" x2="${cx - 6}" y2="${cy + leftPlateH / 2}" stroke="${el.stroke}" stroke-width="${isFlipped ? 2.5 : 3.5}"/>
<line x1="${cx + 6}" y1="${cy - rightPlateH / 2}" x2="${cx + 6}" y2="${cy + rightPlateH / 2}" stroke="${el.stroke}" stroke-width="${isFlipped ? 3.5 : 2.5}"/>
<text x="${cx - 16}" y="${cy - 8}" font-size="11" font-weight="bold" fill="#0f172a" font-family="sans-serif">${leftSign}</text>
<text x="${cx + 12}" y="${cy - 8}" font-size="11" font-weight="bold" fill="#0f172a" font-family="sans-serif">${rightSign}</text>`;
      }

      case 'circuit_switch': {
        const isOpen = el.extraProps?.isOpen;
        const bladeX2 = isOpen ? cx + 10 : cx + 14;
        const bladeY2 = isOpen ? cy - 14 : cy;

        return `<line x1="${el.x}" y1="${cy}" x2="${cx - 14}" y2="${cy}" stroke="${el.stroke}" stroke-width="2.5"/>
<line x1="${cx + 14}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="${el.stroke}" stroke-width="2.5"/>
<circle cx="${cx - 14}" cy="${cy}" r="3.5" fill="#ffffff" stroke="${el.stroke}" stroke-width="2"/>
<circle cx="${cx + 14}" cy="${cy}" r="3.5" fill="#ffffff" stroke="${el.stroke}" stroke-width="2"/>
<line x1="${cx - 14}" y1="${cy}" x2="${bladeX2}" y2="${bladeY2}" stroke="${el.stroke}" stroke-width="2.5"/>`;
      }

      case 'circuit_resistor': {
        const w6 = el.width / 6;
        const d = `M ${el.x} ${cy} L ${el.x + w6} ${cy} L ${el.x + w6 * 1.5} ${cy - 10} L ${el.x + w6 * 2.5} ${cy + 10} L ${el.x + w6 * 3.5} ${cy - 10} L ${el.x + w6 * 4.5} ${cy + 10} L ${el.x + w6 * 5} ${cy} L ${el.x + el.width} ${cy}`;
        const valTag = el.extraProps?.resistorValue
          ? `<text x="${cx}" y="${cy - 12}" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${escapeXml(el.extraProps.resistorValue)}</text>`
          : '';
        return `<path d="${d}" fill="none" stroke="${el.stroke}" stroke-width="2.2"/>${valTag}`;
      }

      case 'circuit_ammeter':
        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="${el.stroke}" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="${el.width * 0.4}" fill="#ffffff" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<text x="${cx}" y="${cy + 5}" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">A</text>`;

      case 'circuit_voltmeter':
        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="${el.stroke}" stroke-width="2"/>
<circle cx="${cx}" cy="${cy}" r="${el.width * 0.4}" fill="#ffffff" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<text x="${cx}" y="${cy + 5}" font-size="14" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">V</text>`;

      case 'science_pulley': {
        const r = 24;
        return `<line x1="${cx}" y1="${el.y}" x2="${cx}" y2="${cy - r}" stroke="#64748b" stroke-width="3"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f1f5f9" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<circle cx="${cx}" cy="${cy}" r="4" fill="#0f172a"/>
<line x1="${cx - r}" y1="${cy}" x2="${cx - r}" y2="${el.y + el.height}" stroke="#b91c1c" stroke-width="2"/>
<line x1="${cx + r}" y1="${cy}" x2="${cx + r}" y2="${el.y + el.height - 20}" stroke="#b91c1c" stroke-width="2"/>
<rect x="${cx - r - 12}" y="${el.y + el.height - 18}" width="24" height="18" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
<text x="${cx - r}" y="${el.y + el.height - 5}" font-size="10" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">W</text>`;
      }

      case 'science_spring': {
        const segs = 6;
        const segH = (el.height - 20) / segs;
        let d = `M ${cx} ${el.y} L ${cx} ${el.y + 10}`;
        for (let i = 0; i < segs; i++) {
          const sy = el.y + 10 + i * segH;
          d += ` L ${cx + 12} ${sy + segH * 0.25} L ${cx - 12} ${sy + segH * 0.75}`;
        }
        d += ` L ${cx} ${el.y + el.height - 10} L ${cx} ${el.y + el.height}`;
        return `<path d="${d}" fill="none" stroke="#334155" stroke-width="2.2"/>`;
      }

      case 'science_incline': {
        const angle = el.extraProps?.angle ?? 30;
        const massLabel = escapeXml(el.extraProps?.massLabel || '2 kg');
        const pts = `${el.x},${el.y + el.height} ${el.x + el.width},${el.y + el.height} ${el.x},${el.y}`;
        return `<polygon points="${pts}" fill="#f1f5f9" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<rect x="${el.x + el.width * 0.35}" y="${el.y + el.height * 0.45}" width="34" height="22" fill="#fef08a" stroke="#0f172a" stroke-width="1.8" transform="rotate(-${angle} ${el.x + el.width * 0.35} ${el.y + el.height * 0.45})"/>
<text x="${el.x + el.width * 0.4}" y="${el.y + el.height * 0.42}" font-size="10" font-weight="bold" fill="#0f172a" font-family="sans-serif">${massLabel}</text>`;
      }

      case 'science_lever':
        return `<polygon points="${cx},${el.y + el.height - 24} ${cx - 16},${el.y + el.height} ${cx + 16},${el.y + el.height}" fill="#94a3b8" stroke="${el.stroke}" stroke-width="1.8"/>
<line x1="${el.x}" y1="${el.y + el.height - 24}" x2="${el.x + el.width}" y2="${el.y + el.height - 24}" stroke="${el.stroke}" stroke-width="3"/>
<rect x="${el.x + 10}" y="${el.y + el.height - 42}" width="22" height="18" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
<rect x="${el.x + el.width - 32}" y="${el.y + el.height - 42}" width="22" height="18" fill="#fef08a" stroke="#0f172a" stroke-width="1.5"/>`;

      case 'science_magnet': {
        const isFlipped = el.extraProps?.flipped;
        const half = el.width / 2;
        const p1Col = isFlipped ? '#3b82f6' : '#ef4444';
        const p2Col = isFlipped ? '#ef4444' : '#3b82f6';
        const p1Lab = isFlipped ? 'S' : 'N';
        const p2Lab = isFlipped ? 'N' : 'S';

        return `<rect x="${el.x}" y="${el.y}" width="${half}" height="${el.height}" fill="${p1Col}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<rect x="${el.x + half}" y="${el.y}" width="${half}" height="${el.height}" fill="${p2Col}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<text x="${el.x + half * 0.5}" y="${cy + 5}" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${p1Lab}</text>
<text x="${el.x + half * 1.5}" y="${cy + 5}" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${p2Lab}</text>`;
      }

      case 'science_beaker': {
        const liquidPct = el.extraProps?.liquidLevel ?? 60;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liquidH = (el.height - 12) * (liquidPct / 100);
        const liquidMarkup = liquidPct > 0
          ? `<rect x="${el.x + 2}" y="${el.y + el.height - liquidH}" width="${el.width - 4}" height="${liquidH}" fill="${liquidCol}" opacity="0.75"/>`
          : '';

        return `${liquidMarkup}
<path d="M ${el.x - 4} ${el.y} L ${el.x} ${el.y} L ${el.x} ${el.y + el.height - 6} A 6 6 0 0 0 ${el.x + 6} ${el.y + el.height} L ${el.x + el.width - 6} ${el.y + el.height} A 6 6 0 0 0 ${el.x + el.width} ${el.y + el.height - 6} L ${el.x + el.width} ${el.y}" fill="none" stroke="${el.stroke}" stroke-width="2"/>
<line x1="${el.x + 6}" y1="${el.y + el.height * 0.4}" x2="${el.x + 18}" y2="${el.y + el.height * 0.4}" stroke="#0284c7" stroke-width="1.5"/>
<line x1="${el.x + 6}" y1="${el.y + el.height * 0.6}" x2="${el.x + 18}" y2="${el.y + el.height * 0.6}" stroke="#0284c7" stroke-width="1.5"/>
<line x1="${el.x + 6}" y1="${el.y + el.height * 0.8}" x2="${el.x + 18}" y2="${el.y + el.height * 0.8}" stroke="#0284c7" stroke-width="1.5"/>`;
      }

      case 'science_test_tube': {
        const r = el.width / 2;
        const liquidPct = el.extraProps?.liquidLevel ?? 70;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liquidH = (el.height - r) * (liquidPct / 100);
        const liquidMarkup = liquidPct > 0
          ? `<rect x="${el.x + 2}" y="${el.y + el.height - liquidH - r}" width="${el.width - 4}" height="${liquidH}" fill="${liquidCol}" opacity="0.75"/>`
          : '';

        return `${liquidMarkup}
<path d="M ${el.x} ${el.y} L ${el.x} ${el.y + el.height - r} A ${r} ${r} 0 0 0 ${el.x + el.width} ${el.y + el.height - r} L ${el.x + el.width} ${el.y}" fill="none" stroke="${el.stroke}" stroke-width="2"/>
<line x1="${el.x - 3}" y1="${el.y}" x2="${el.x + el.width + 3}" y2="${el.y}" stroke="${el.stroke}" stroke-width="2"/>`;
      }

      case 'science_flask': {
        const neckW = el.width * 0.28;
        const neckH = el.height * 0.35;
        const bodyH = el.height - neckH;
        const liquidPct = el.extraProps?.liquidLevel ?? 50;
        const liquidCol = el.extraProps?.liquidColor || '#bae6fd';
        const liqH = bodyH * (liquidPct / 100);
        const liqTopY = el.y + el.height - liqH;
        const tRatio = Math.max(0, Math.min(1, (liqTopY - (el.y + neckH)) / bodyH));
        const liqTopHalfW = (neckW / 2) + ((el.width / 2) - (neckW / 2)) * tRatio;
        const liqTag = liquidPct > 0
          ? `<polygon points="${cx - liqTopHalfW + 2},${liqTopY} ${cx + liqTopHalfW - 2},${liqTopY} ${el.x + el.width - 2},${el.y + el.height - 2} ${el.x + 2},${el.y + el.height - 2}" fill="${liquidCol}" opacity="0.78"/>`
          : '';
        const d = `M ${cx - neckW / 2} ${el.y} L ${cx - neckW / 2} ${el.y + neckH} L ${el.x} ${el.y + el.height} L ${el.x + el.width} ${el.y + el.height} L ${cx + neckW / 2} ${el.y + neckH} L ${cx + neckW / 2} ${el.y} Z`;
        return `${liqTag}\n<path d="${d}" fill="none" stroke="${el.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
      }

      case 'thermometer': {
        const temp = el.extraProps?.temperature ?? 37;
        const minT = el.extraProps?.minTemp ?? 0;
        const maxT = el.extraProps?.maxTemp ?? 100;
        const unit = escapeXml(el.extraProps?.unit || '°C');
        const liqCol = el.extraProps?.liquidColor || '#ef4444';
        const bulbR = Math.min(16, el.width * 0.26);
        const tubeW = bulbR * 0.95;
        const tubeTop = el.y + 12;
        const tubeBot = el.y + el.height - bulbR * 2;
        const tubeH = Math.max(20, tubeBot - tubeTop);
        const pct = Math.max(0, Math.min(1, (temp - minT) / Math.max(1, maxT - minT)));
        const fillH = tubeH * pct;
        const ticksStr = [0, 0.25, 0.5, 0.75, 1].map(f => {
          const ty = tubeBot - f * tubeH;
          const val = Math.round(minT + f * (maxT - minT));
          return `<line x1="${cx + tubeW / 2}" y1="${ty}" x2="${cx + tubeW / 2 + 6}" y2="${ty}" stroke="${el.stroke}" stroke-width="1.5"/>\n<text x="${cx + tubeW / 2 + 9}" y="${ty + 3}" font-size="9" font-weight="bold" fill="#334155" font-family="sans-serif">${val}${unit}</text>`;
        }).join('\n');
        return `<rect x="${cx - tubeW / 2}" y="${tubeTop}" width="${tubeW}" height="${tubeH + bulbR * 0.5}" rx="${tubeW / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<circle cx="${cx}" cy="${el.y + el.height - bulbR}" r="${bulbR}" fill="${liqCol}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<rect x="${cx - (tubeW - 6) / 2}" y="${tubeBot - fillH}" width="${Math.max(4, tubeW - 6)}" height="${fillH + bulbR * 0.5}" fill="${liqCol}"/>
${ticksStr}`;
      }

      case 'balance_scale': {
        const tilt = el.extraProps?.tilt || 'even';
        const leftW = escapeXml(el.extraProps?.leftWeight || '500 g');
        const rightW = escapeXml(el.extraProps?.rightWeight || '500 g');
        const tiltDeg = tilt === 'left' ? -10 : tilt === 'right' ? 10 : 0;
        const pivotY = el.y + el.height * 0.35;
        const baseY = el.y + el.height - 8;
        const beamHalf = el.width * 0.42;
        return `<rect x="${cx - 32}" y="${baseY}" width="64" height="8" rx="3" fill="#475569"/>
<line x1="${cx}" y1="${pivotY}" x2="${cx}" y2="${baseY}" stroke="#475569" stroke-width="4"/>
<polygon points="${cx - 8},${baseY} ${cx + 8},${baseY} ${cx},${pivotY}" fill="#64748b"/>
<g transform="rotate(${tiltDeg} ${cx} ${pivotY})">
  <line x1="${cx - beamHalf}" y1="${pivotY}" x2="${cx + beamHalf}" y2="${pivotY}" stroke="#0f172a" stroke-width="3.5"/>
  <circle cx="${cx}" cy="${pivotY}" r="4.5" fill="#f59e0b" stroke="#0f172a" stroke-width="1.5"/>
  <line x1="${cx - beamHalf}" y1="${pivotY}" x2="${cx - beamHalf - 16}" y2="${pivotY + 38}" stroke="#64748b" stroke-width="1.5"/>
  <line x1="${cx - beamHalf}" y1="${pivotY}" x2="${cx - beamHalf + 16}" y2="${pivotY + 38}" stroke="#64748b" stroke-width="1.5"/>
  <path d="M ${cx - beamHalf - 22} ${pivotY + 38} Q ${cx - beamHalf} ${pivotY + 46} ${cx - beamHalf + 22} ${pivotY + 38} Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.5"/>
  <rect x="${cx - beamHalf - 14}" y="${pivotY + 20}" width="28" height="18" rx="2" fill="#fef08a" stroke="#0f172a" stroke-width="1.5"/>
  <text x="${cx - beamHalf}" y="${pivotY + 32}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${leftW}</text>
  <line x1="${cx + beamHalf}" y1="${pivotY}" x2="${cx + beamHalf - 16}" y2="${pivotY + 38}" stroke="#64748b" stroke-width="1.5"/>
  <line x1="${cx + beamHalf}" y1="${pivotY}" x2="${cx + beamHalf + 16}" y2="${pivotY + 38}" stroke="#64748b" stroke-width="1.5"/>
  <path d="M ${cx + beamHalf - 22} ${pivotY + 38} Q ${cx + beamHalf} ${pivotY + 46} ${cx + beamHalf + 22} ${pivotY + 38} Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="1.5"/>
  <rect x="${cx + beamHalf - 14}" y="${pivotY + 20}" width="28" height="18" rx="2" fill="#bae6fd" stroke="#0f172a" stroke-width="1.5"/>
  <text x="${cx + beamHalf}" y="${pivotY + 32}" font-size="9" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="sans-serif">${rightW}</text>
</g>`;
      }

      // --- Diagrams & Logic ---
      case 'compass_rose': {
        const r = el.width / 2;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3,3"/>
<polygon points="${cx},${cy - r + 4} ${cx - 7},${cy} ${cx + 7},${cy}" fill="#ef4444"/>
<polygon points="${cx},${cy + r - 4} ${cx - 7},${cy} ${cx + 7},${cy}" fill="#3b82f6"/>
<polygon points="${cx - r + 4},${cy} ${cx},${cy - 7} ${cx},${cy + 7}" fill="#64748b"/>
<polygon points="${cx + r - 4},${cy} ${cx},${cy - 7} ${cx},${cy + 7}" fill="#64748b"/>
<text x="${cx}" y="${cy - r + 14}" font-size="13" font-weight="bold" fill="#b91c1c" text-anchor="middle" font-family="sans-serif">N</text>
<text x="${cx}" y="${cy + r - 4}" font-size="12" font-weight="bold" fill="#1d4ed8" text-anchor="middle" font-family="sans-serif">S</text>
<text x="${el.x + el.width - 12}" y="${cy + 4}" font-size="12" font-weight="bold" fill="#334155" text-anchor="middle" font-family="sans-serif">E</text>
<text x="${el.x + 12}" y="${cy + 4}" font-size="12" font-weight="bold" fill="#334155" text-anchor="middle" font-family="sans-serif">W</text>`;
      }

      case 'venn_2': {
        const r = el.height * 0.45;
        const labA = escapeXml(el.extraProps?.labelA || 'A');
        const labB = escapeXml(el.extraProps?.labelB || 'B');
        const highlight = el.extraProps?.highlightRegion || 'none';

        const fillA = highlight === 'a_only' || highlight === 'union' ? '#dbeafe' : 'none';
        const fillB = highlight === 'b_only' || highlight === 'union' ? '#fee2e2' : 'none';
        const intersectTag = highlight === 'intersection' ? `<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.35}" ry="${r * 0.7}" fill="#e0e7ff" opacity="0.8"/>` : '';

        return `<circle cx="${el.x + r}" cy="${cy}" r="${r}" fill="${fillA}" stroke="#2563eb" stroke-width="2"/>
<circle cx="${el.x + el.width - r}" cy="${cy}" r="${r}" fill="${fillB}" stroke="#dc2626" stroke-width="2"/>
${intersectTag}
<text x="${el.x + r * 0.5}" y="${cy - r * 0.6}" font-size="14" font-weight="bold" fill="#2563eb" font-family="sans-serif">${labA}</text>
<text x="${el.x + el.width - r * 0.8}" y="${cy - r * 0.6}" font-size="14" font-weight="bold" fill="#dc2626" font-family="sans-serif">${labB}</text>`;
      }

      case 'venn_3': {
        const r = el.width * 0.32;
        const labA = escapeXml(el.extraProps?.labelA || 'A');
        const labB = escapeXml(el.extraProps?.labelB || 'B');
        const labC = escapeXml(el.extraProps?.labelC || 'C');
        return `<circle cx="${cx - r * 0.5}" cy="${cy - r * 0.3}" r="${r}" fill="none" stroke="#2563eb" stroke-width="1.8"/>
<circle cx="${cx + r * 0.5}" cy="${cy - r * 0.3}" r="${r}" fill="none" stroke="#dc2626" stroke-width="1.8"/>
<circle cx="${cx}" cy="${cy + r * 0.5}" r="${r}" fill="none" stroke="#16a34a" stroke-width="1.8"/>
<text x="${cx - r}" y="${cy - r * 0.6}" font-size="13" font-weight="bold" fill="#2563eb" font-family="sans-serif">${labA}</text>
<text x="${cx + r * 0.8}" y="${cy - r * 0.6}" font-size="13" font-weight="bold" fill="#dc2626" font-family="sans-serif">${labB}</text>
<text x="${cx}" y="${cy + r * 1.1}" font-size="13" font-weight="bold" fill="#16a34a" text-anchor="middle" font-family="sans-serif">${labC}</text>`;
      }

      case 'flowchart_terminator':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.height / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy}" dominant-baseline="central" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;

      case 'flowchart_process':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy}" dominant-baseline="central" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;

      case 'flowchart_decision': {
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy}" dominant-baseline="central" font-size="${el.fontSize || 12}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
      }

      case 'flowchart_data': {
        const offset = el.width * 0.2;
        const pts = `${el.x + offset},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width - offset},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy}" dominant-baseline="central" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
      }

      case 'speech_bubble': {
        const tailDir = el.extraProps?.tailDirection || 'bottom-left';
        const tailH = 18;
        const r = 12;
        const boxH = el.height - tailH;
        const boxY = tailDir.startsWith('top') ? el.y + tailH : el.y;
        const tailBaseX1 = tailDir.endsWith('right') ? el.x + el.width - 36 : el.x + 22;
        const tailBaseX2 = tailDir.endsWith('right') ? el.x + el.width - 22 : el.x + 36;
        const tailTipX = tailDir.endsWith('right') ? el.x + el.width - 14 : el.x + 14;
        const tailTipY = tailDir.startsWith('top') ? el.y : el.y + el.height;
        const tailAttachY = tailDir.startsWith('top') ? boxY : boxY + boxH;
        return `<rect x="${el.x}" y="${boxY}" width="${el.width}" height="${boxH}" rx="${r}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
<polygon points="${tailBaseX1},${tailAttachY} ${tailTipX},${tailTipY} ${tailBaseX2},${tailAttachY}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round"/>
${safeText ? `<text x="${cx}" y="${boxY + boxH / 2}" dominant-baseline="central" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
      }

      case 'timeline': {
        const ptsCount = el.extraProps?.pointCount ?? 4;
        const ptsMarkup = Array.from({ length: ptsCount }).map((_, i) => {
          const tx = el.x + 40 + i * ((el.width - 80) / Math.max(1, ptsCount - 1));
          return `<circle cx="${tx}" cy="${cy}" r="5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
<text x="${tx}" y="${cy - 12}" font-size="11" font-weight="bold" fill="#1e293b" text-anchor="middle" font-family="sans-serif">ขั้นที่ ${i + 1}</text>`;
        }).join('\n');

        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="#0f172a" stroke-width="3"/>
<polygon points="${el.x + el.width},${cy} ${el.x + el.width - 10},${cy - 5} ${el.x + el.width - 10},${cy + 5}" fill="#0f172a"/>
${ptsMarkup}`;
      }

      case 'table_grid': {
        const rows = Math.max(1, Math.min(8, el.extraProps?.rows ?? 3));
        const cols = Math.max(1, Math.min(8, el.extraProps?.cols ?? 3));
        const hasHeader = el.extraProps?.hasHeader !== false;
        const rawMatrix = String(el.extraProps?.dataMatrix || '').split('|').map(r => r.split(',').map(c => c.trim()));
        const cellW = el.width / cols;
        const cellH = el.height / rows;
        const cellsStr = Array.from({ length: rows }).map((_, rIdx) =>
          Array.from({ length: cols }).map((__, cIdx) => {
            const cellText = escapeXml(rawMatrix[rIdx]?.[cIdx] || '');
            const txtTag = cellText ? `<text x="${el.x + (cIdx + 0.5) * cellW}" y="${el.y + (rIdx + 0.5) * cellH}" font-size="${el.fontSize || 12}" font-weight="${rIdx === 0 && hasHeader ? 'bold' : 'normal'}" fill="#0f172a" text-anchor="middle" dominant-baseline="central" font-family="${el.fontFamily || 'Sarabun, sans-serif'}">${cellText}</text>` : '';
            return `<rect x="${el.x + cIdx * cellW}" y="${el.y + rIdx * cellH}" width="${cellW}" height="${cellH}" fill="none" stroke="${el.stroke}" stroke-width="1"/>${txtTag}`;
          }).join('\n')
        ).join('\n');
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${hasHeader ? `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${cellH}" fill="#e2e8f0" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>` : ''}
${cellsStr}`;
      }

      case 'text_label':
      case 'math_label': {
        const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
        const tx = el.textAlign === 'center' ? cx : el.textAlign === 'right' ? el.x + el.width - 4 : el.x + 4;
        return `<text x="${tx}" y="${cy}" dominant-baseline="central" font-size="${el.fontSize || 14}" font-weight="${el.fontWeight || 'bold'}" fill="${el.stroke && el.stroke !== 'none' ? el.stroke : '#0f172a'}" font-family="${el.fontFamily || 'Sarabun, sans-serif'}" text-anchor="${anchor}">${safeText}</text>`;
      }

      case 'image_overlay':
        return `<image href="${escapeXml(el.imageUrl || '')}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid meet"/>`;

      default:
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>`;
    }
  };

  // Generate Clean Production Vector SVG String
  const exportSvgString = (): string => {
    if (elementsRef.current.length === 0) return '';

    let minX = 0;
    let minY = 0;
    let maxX = CANVAS_WIDTH;
    let maxY = CANVAS_HEIGHT;

    // Rotation-Aware Auto-Crop Bounding Box Calculation
    if (autoCrop && elementsRef.current.length > 0) {
      let bMinX = Infinity;
      let bMinY = Infinity;
      let bMaxX = -Infinity;
      let bMaxY = -Infinity;

      elementsRef.current.forEach(el => {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        const rad = ((el.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const hw = el.width / 2;
        const hh = el.height / 2;
        const corners = [
          { x: -hw, y: -hh },
          { x: hw, y: -hh },
          { x: hw, y: hh },
          { x: -hw, y: hh }
        ];

        corners.forEach(c => {
          const wx = cx + c.x * cos - c.y * sin;
          const wy = cy + c.x * sin + c.y * cos;
          bMinX = Math.min(bMinX, wx);
          bMinY = Math.min(bMinY, wy);
          bMaxX = Math.max(bMaxX, wx);
          bMaxY = Math.max(bMaxY, wy);
        });
      });

      const padding = 20;
      minX = Math.max(0, Math.floor(bMinX - padding));
      minY = Math.max(0, Math.floor(bMinY - padding));
      maxX = Math.min(CANVAS_WIDTH, Math.ceil(bMaxX + padding));
      maxY = Math.min(CANVAS_HEIGHT, Math.ceil(bMaxY + padding));
    }

    const exportW = maxX - minX;
    const exportH = maxY - minY;

    const metaComment = `<!-- sv-diagram-meta: ${JSON.stringify(elementsRef.current)} -->`;

    const renderedItems = elementsRef.current.map(el => {
      const transform = getTransformString(el);
      const transformAttr = transform ? `transform="${transform}"` : '';
      return `<g ${transformAttr}>
        ${renderElementSvgString(el)}
      </g>`;
    }).join('\n  ');

    return `<svg viewBox="${minX} ${minY} ${exportW} ${exportH}" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto max-h-[260px] mx-auto">
  ${metaComment}
  <rect x="${minX}" y="${minY}" width="${exportW}" height="${exportH}" fill="#ffffff"/>
  ${renderedItems}
</svg>`;
  };

  const handleApplyToExam = () => {
    if (elementsRef.current.length === 0) {
      toast.error('กรุณาสร้างหรือวาดแผนภาพอย่างน้อย 1 ชิ้น');
      return;
    }
    const svgStr = exportSvgString();
    onInsert(svgStr);
    toast.success('แทรกแผนภาพลงในข้อสอบเรียบร้อยแล้ว');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 md:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-7xl overflow-hidden flex flex-col h-[96vh]">
        {/* Header Bar */}
        <div className="px-6 py-3 bg-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Shapes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm tracking-wide">สตูดิโอออกแบบแผนภาพข้อสอบ (Canva Studio Pro)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Vector Engine v2.1
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                ลากวาง ปรับแต่งรูปทรงเรขาคณิต 2D/3D วงจรไฟฟ้า เครื่องแก้ววิทย์ และเส้นจำนวน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
              title="ปิดสตูดิโอ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Contextual Property Ribbon (Canva & Word Style) */}
        {selectedElement && (
          <div className="px-4 py-2 bg-stone-100 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
            {/* Left: Quick Colors, Stroke, and Fills */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Fill Color Picker & Swatches */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-stone-200 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-500">สีพื้น:</span>
                <input
                  type="color"
                  value={selectedElement.fill === 'none' || selectedElement.fill === 'transparent' ? '#ffffff' : selectedElement.fill}
                  onChange={(e) => updateSelectedField('fill', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  title="เลือกสีพื้นเอง"
                />
                <button
                  type="button"
                  onClick={() => updateSelectedField('fill', 'none')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${selectedElement.fill === 'none' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-stone-200'}`}
                >
                  โปร่งใส
                </button>
                <div className="flex items-center gap-1 ml-1 border-l border-stone-200 pl-1.5">
                  {['#ffffff', '#f8fafc', '#fee2e2', '#fef08a', '#dcfce7', '#dbeafe', '#f3e8ff'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateSelectedField('fill', c)}
                      className="w-4 h-4 rounded-full border border-stone-300 shadow-2xs"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>

              {/* Stroke Color & Width */}
              <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-stone-200 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-500">เส้นขอบ:</span>
                <input
                  type="color"
                  value={selectedElement.stroke === 'none' ? '#0f172a' : selectedElement.stroke}
                  onChange={(e) => updateSelectedField('stroke', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  title="เลือกสีเส้นขอบ"
                />
                <select
                  value={selectedElement.strokeWidth}
                  onChange={(e) => updateSelectedField('strokeWidth', parseFloat(e.target.value))}
                  className="px-1 py-0.5 text-[11px] border border-stone-200 rounded font-medium"
                >
                  <option value={1}>1px</option>
                  <option value={1.8}>1.8px</option>
                  <option value={2.5}>2.5px</option>
                  <option value={3.5}>3.5px</option>
                  <option value={5}>5px</option>
                </select>

                <select
                  value={selectedElement.strokeDasharray || 'solid'}
                  onChange={(e) => updateSelectedField('strokeDasharray', e.target.value === 'solid' ? undefined : e.target.value)}
                  className="px-1 py-0.5 text-[11px] border border-stone-200 rounded font-medium"
                >
                  <option value="solid">เส้นทึบ</option>
                  <option value="4,4">เส้นประ</option>
                  <option value="2,3">เส้นจุด</option>
                </select>
              </div>

              {/* Flips & Quick Rotations */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-stone-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleToggleFlip('h')}
                  className={`p-1 rounded hover:bg-stone-100 ${selectedElement.flipH ? 'bg-blue-100 text-blue-700 font-bold' : 'text-stone-600'}`}
                  title="พลิกแนวนอน (Flip Horizontal)"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleFlip('v')}
                  className={`p-1 rounded hover:bg-stone-100 ${selectedElement.flipV ? 'bg-blue-100 text-blue-700 font-bold' : 'text-stone-600'}`}
                  title="พลิกแนวตั้ง (Flip Vertical)"
                >
                  <FlipVertical className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-stone-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => handleRotateDelta(-90)}
                  className="px-1 py-0.5 rounded hover:bg-stone-100 text-[10px] font-bold text-stone-600"
                  title="หมุนทวนเข็ม 90 องศา"
                >
                  -90°
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateDelta(90)}
                  className="px-1 py-0.5 rounded hover:bg-stone-100 text-[10px] font-bold text-stone-600"
                  title="หมุนตามเข็ม 90 องศา"
                >
                  +90°
                </button>
              </div>

              {/* Alignments */}
              <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-stone-200 shadow-2xs">
                <span className="text-[10px] font-bold text-stone-500 mr-0.5">จัดชิด:</span>
                <button
                  type="button"
                  onClick={() => handleAlign('left')}
                  className="p-1 rounded hover:bg-stone-100 text-stone-600"
                  title="จัดชิดซ้ายผืนผ้าใบ"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlign('center')}
                  className="p-1 rounded hover:bg-stone-100 text-stone-600"
                  title="จัดกึ่งกลางแนวนอน"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlign('right')}
                  className="p-1 rounded hover:bg-stone-100 text-stone-600"
                  title="จัดชิดขวาผืนผ้าใบ"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <div className="w-px h-3.5 bg-stone-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => handleAlign('snap_grid')}
                  className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-700 border border-blue-200"
                  title="ดึงตำแหน่งเข้าเส้นตารางทันที"
                >
                  จัดเข้าตาราง
                </button>
              </div>
            </div>

            {/* Right: Layer Ordering & Delete */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMoveLayer('front')}
                className="p-1 text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded shadow-2xs"
                title="นำไปไว้หน้าสุด"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveLayer('back')}
                className="p-1 text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded shadow-2xs"
                title="ส่งไปหลังสุด"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDuplicateSelected}
                className="p-1 text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 rounded shadow-2xs ml-1"
                title="คัดลอก (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="p-1 text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded shadow-2xs"
                title="ลบวัตถุที่เลือก (Delete)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Studio Workspace Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Elements Palette Sidebar */}
          <div className="w-72 border-r border-stone-200 bg-stone-50 flex flex-col shrink-0">
            {/* Category Tabs */}
            <div className="p-2 border-b border-stone-200 bg-white grid grid-cols-4 gap-1 text-[11px] font-semibold text-stone-600">
              <button
                type="button"
                onClick={() => setActiveCategory('shapes')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'shapes' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Square className="w-4 h-4 text-blue-600" />
                <span>2D Shapes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('solids')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'solids' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Boxes className="w-4 h-4 text-purple-600" />
                <span>ทรง 3D</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('math')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'math' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Compass className="w-4 h-4 text-emerald-600" />
                <span>การวัด & คณิต</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('science')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'science' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-500" />
                <span>วิทย์ & แล็บ</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('diagrams')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'diagrams' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Layers className="w-4 h-4 text-rose-500" />
                <span>ผังงาน</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('templates')}
                className={`py-1.5 px-1 rounded-lg flex flex-col items-center gap-1 text-center transition-colors ${
                  activeCategory === 'templates' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <Sliders className="w-4 h-4 text-stone-600" />
                <span>เทมเพลต</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('image')}
                className={`col-span-2 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1.5 text-center transition-colors ${
                  activeCategory === 'image' ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200' : 'hover:bg-stone-100'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>ภาพ & มาร์กเกอร์</span>
              </button>
            </div>

            {/* Elements Buttons */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeCategory === 'shapes' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">เรขาคณิต 2 มิติ</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'rect', label: 'สี่เหลี่ยมผืนผ้า', icon: <Square className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'rounded_rect', label: 'สี่เหลี่ยมมุมมน', icon: <Box className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'circle', label: 'วงกลม', icon: <Circle className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'ellipse', label: 'วงรี', icon: <Circle className="w-3.5 h-3.5 text-emerald-700 scale-x-125" /> },
                      { type: 'semicircle', label: 'ครึ่งวงกลม', icon: <div className="w-3.5 h-2 border-t-2 border-x-2 border-stone-700 rounded-t-full" /> },
                      { type: 'sector_pie', label: 'เซกเตอร์', icon: <div className="w-3 h-3 border-l-2 border-b-2 border-stone-700 rounded-bl-full" /> },
                      { type: 'right_triangle', label: 'สามเหลี่ยมมุมฉาก', icon: <Triangle className="w-3.5 h-3.5 text-amber-600 rotate-180" /> },
                      { type: 'triangle', label: 'สามเหลี่ยมหน้าจั่ว', icon: <Triangle className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'parallelogram', label: 'ด้านขนาน', icon: <Square className="w-3.5 h-3.5 text-cyan-600 skew-x-12" /> },
                      { type: 'trapezoid', label: 'คางหมู', icon: <Square className="w-3.5 h-3.5 text-orange-600" /> },
                      { type: 'rhombus', label: 'ขนมเปียกปูน', icon: <Square className="w-3.5 h-3.5 text-rose-600 rotate-45" /> },
                      { type: 'pentagon', label: 'ห้าเหลี่ยม', icon: <Shapes className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'hexagon', label: 'หกเหลี่ยม', icon: <Shapes className="w-3.5 h-3.5 text-teal-600" /> },
                      { type: 'star_5', label: 'ดาว 5 แฉก', icon: <Star className="w-3.5 h-3.5 text-amber-500" /> },
                      { type: 'polygon_custom', label: 'หลายเหลี่ยมดัดจุดได้', icon: <Shapes className="w-3.5 h-3.5 text-blue-700" /> },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addElement(item.type as CanvasElementType)}
                        className="p-2 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-left flex items-center gap-1.5 text-xs font-medium text-stone-700 transition-colors shadow-2xs"
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'solids' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">รูปทรงเรขาคณิต 3 มิติ</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'cube_3d', label: 'ลูกบาศก์', icon: <Boxes className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'cylinder_3d', label: 'ทรงกระบอก', icon: <Box className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'cone_3d', label: 'กรวยกลม', icon: <Triangle className="w-3.5 h-3.5 text-amber-600" /> },
                      { type: 'sphere_3d', label: 'ทรงกลม', icon: <Circle className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'pyramid_3d', label: 'พีระมิดฐานสี่เหลี่ยม', icon: <Triangle className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'triangular_prism_3d', label: 'ปริซึมสามเหลี่ยม', icon: <Shapes className="w-3.5 h-3.5 text-cyan-600" /> },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addElement(item.type as CanvasElementType)}
                        className="p-2 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-left flex items-center gap-1.5 text-xs font-medium text-stone-700 transition-colors shadow-2xs"
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'math' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">การวัด เส้นตัด & เครื่องมือคณิต</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'line', label: 'เส้นตรง (ปรับปลายได้)', icon: <Minus className="w-3.5 h-3.5 text-stone-700" /> },
                      { type: 'arrow', label: 'ลูกศร / รังสี', icon: <ArrowRight className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'parallel_transversal', label: 'เส้นขนาน & มุมเส้นตัด', icon: <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" /> },
                      { type: 'intersecting_lines', label: 'เส้นตัดกัน & มุมตรงข้าม', icon: <Compass className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'dimension_line', label: 'เส้นบอกขนาด', icon: <Minus className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'angle_arc', label: 'มุม & ส่วนโค้ง', icon: <Compass className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'protractor', label: 'ไม้โปรแทรกเตอร์', icon: <Compass className="w-3.5 h-3.5 text-sky-600" /> },
                      { type: 'axes_xy', label: 'แกนพิกัดฉาก X-Y', icon: <Grid3X3 className="w-3.5 h-3.5 text-cyan-600" /> },
                      { type: 'number_line', label: 'เส้นจำนวน', icon: <Minus className="w-3.5 h-3.5 text-amber-600" /> },
                      { type: 'analog_clock', label: 'นาฬิกาเข็ม', icon: <Clock className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'fraction_bar', label: 'แถบเศษส่วน', icon: <Grid className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'fraction_circle', label: 'วงกลมเศษส่วน', icon: <Circle className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'bar_chart', label: 'แผนภูมิแท่ง', icon: <Activity className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'ruler_cm', label: 'ไม้บรรทัดวัดขนาด', icon: <SlidersHorizontal className="w-3.5 h-3.5 text-amber-700" /> },
                      { type: 'text_label', label: 'ป้ายข้อความ', icon: <Type className="w-3.5 h-3.5 text-indigo-600" /> },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addElement(item.type as CanvasElementType)}
                        className="p-2 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-left flex items-center gap-1.5 text-xs font-medium text-stone-700 transition-colors shadow-2xs"
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'science' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">วงจรไฟฟ้า & เครื่องมือวิทย์</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'circuit_bulb', label: 'หลอดไฟ', icon: <Zap className="w-3.5 h-3.5 text-amber-500" /> },
                      { type: 'circuit_battery', label: 'เซลล์ไฟฟ้า / ถ่าน', icon: <Zap className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'circuit_switch', label: 'สวิตช์ไฟ', icon: <Activity className="w-3.5 h-3.5 text-slate-700" /> },
                      { type: 'circuit_resistor', label: 'ตัวต้านทาน', icon: <Minus className="w-3.5 h-3.5 text-stone-600" /> },
                      { type: 'circuit_ammeter', label: 'แอมมิเตอร์', icon: <Gauge className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'circuit_voltmeter', label: 'โวลต์มิเตอร์', icon: <Gauge className="w-3.5 h-3.5 text-teal-600" /> },
                      { type: 'science_beaker', label: 'บีกเกอร์', icon: <FlaskConical className="w-3.5 h-3.5 text-sky-600" /> },
                      { type: 'science_test_tube', label: 'หลอดทดลอง', icon: <FlaskConical className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'science_flask', label: 'ขวดรูปชมพู่', icon: <FlaskConical className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'thermometer', label: 'เทอร์โมมิเตอร์', icon: <Gauge className="w-3.5 h-3.5 text-red-600" /> },
                      { type: 'balance_scale', label: 'ตาชั่งสองแขน', icon: <Sliders className="w-3.5 h-3.5 text-amber-600" /> },
                      { type: 'science_incline', label: 'พื้นเอียง & มวล', icon: <Triangle className="w-3.5 h-3.5 text-amber-700" /> },
                      { type: 'science_magnet', label: 'แม่เหล็กแท่ง N-S', icon: <Magnet className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'science_pulley', label: 'รอกเดี่ยว & ตุ้มน้ำหนัก', icon: <Circle className="w-3.5 h-3.5 text-stone-600" /> },
                      { type: 'science_lever', label: 'คานดีดคานงัด', icon: <Minus className="w-3.5 h-3.5 text-orange-600" /> },
                      { type: 'science_spring', label: 'สปริงยืดหยุ่น', icon: <Activity className="w-3.5 h-3.5 text-indigo-600" /> },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addElement(item.type as CanvasElementType)}
                        className="p-2 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-left flex items-center gap-1.5 text-xs font-medium text-stone-700 transition-colors shadow-2xs"
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'diagrams' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">ผังงาน & ไดอะแกรม</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'flowchart_terminator', label: 'Start / Stop', icon: <Box className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'flowchart_process', label: 'กระบวนการ (Process)', icon: <Square className="w-3.5 h-3.5 text-indigo-600" /> },
                      { type: 'flowchart_decision', label: 'การตัดสินใจ (Decision)', icon: <Square className="w-3.5 h-3.5 text-amber-600 rotate-45" /> },
                      { type: 'flowchart_data', label: 'รับ/แสดงข้อมูล (I/O)', icon: <Square className="w-3.5 h-3.5 text-emerald-600 skew-x-12" /> },
                      { type: 'speech_bubble', label: 'กล่องบทสนทนา', icon: <MessageSquare className="w-3.5 h-3.5 text-teal-600" /> },
                      { type: 'venn_2', label: 'เวนน์ 2 วง', icon: <Layers className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'venn_3', label: 'เวนน์ 3 วง', icon: <Layers className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'compass_rose', label: 'เข็มทิศ 4 ทิศ', icon: <Compass className="w-3.5 h-3.5 text-red-600" /> },
                      { type: 'timeline', label: 'เส้นเวลา (Timeline)', icon: <Clock className="w-3.5 h-3.5 text-stone-700" /> },
                      { type: 'table_grid', label: 'ตารางข้อมูล (Table)', icon: <Grid3X3 className="w-3.5 h-3.5 text-blue-700" /> },
                    ].map(item => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => addElement(item.type as CanvasElementType)}
                        className="p-2 bg-white border border-stone-200 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-left flex items-center gap-1.5 text-xs font-medium text-stone-700 transition-colors shadow-2xs"
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeCategory === 'templates' && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">เทมเพลตข้อสอบมาตรฐาน</span>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => loadPresetTemplate('right_triangle')}
                      className="w-full p-2.5 bg-white border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left text-xs font-semibold text-stone-800 transition-all shadow-2xs"
                    >
                      1. สามเหลี่ยมมุมฉาก (หาด้าน c)
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetTemplate('venn_2')}
                      className="w-full p-2.5 bg-white border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left text-xs font-semibold text-stone-800 transition-all shadow-2xs"
                    >
                      2. แผนภาพเวนน์ 2 วง (A, B, U)
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetTemplate('circuit_simple')}
                      className="w-full p-2.5 bg-white border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left text-xs font-semibold text-stone-800 transition-all shadow-2xs"
                    >
                      3. วงจรไฟฟ้าหลอดไฟ & สวิตช์
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetTemplate('axes_linear')}
                      className="w-full p-2.5 bg-white border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left text-xs font-semibold text-stone-800 transition-all shadow-2xs"
                    >
                      4. กราฟสมการเส้นตรง (X-Y)
                    </button>
                    <button
                      type="button"
                      onClick={() => loadPresetTemplate('parallel_transversal')}
                      className="w-full p-2.5 bg-white border border-stone-200 hover:border-blue-500 hover:bg-blue-50/50 rounded-xl text-left text-xs font-semibold text-stone-800 transition-all shadow-2xs"
                    >
                      5. เส้นขนานและมุมเส้นตัด (AB // CD)
                    </button>
                  </div>
                </div>
              )}

              {activeCategory === 'image' && (
                <div className="space-y-3">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">แทรกภาพ & มาร์กเกอร์</span>
                  <label className="block p-3 border-2 border-dashed border-stone-300 hover:border-blue-500 bg-white rounded-xl text-center cursor-pointer transition-colors">
                    <ImageIcon className="w-5 h-5 text-stone-400 mx-auto mb-1" />
                    <span className="text-xs font-semibold text-stone-700 block">อัปโหลดไฟล์ภาพ</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">PNG, JPG, WebP</span>
                    <input type="file" accept="image/*" onChange={handleUploadCanvasImage} className="hidden" />
                  </label>
                  <div className="pt-2 border-t border-stone-200">
                    <span className="text-[11px] font-bold text-stone-600 block mb-1.5">มาร์กเกอร์ชี้ตำแหน่ง:</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['(1)', '(2)', '(3)', '(4)', '(A)', '(B)', '(C)', '(D)'].map(mark => (
                        <button
                          key={mark}
                          type="button"
                          onClick={() => addElement('text_label', { text: mark, fontSize: 16, fontWeight: 'bold' })}
                          className="py-1 bg-white border border-stone-300 hover:bg-blue-50 rounded-lg text-xs font-bold text-blue-700"
                        >
                          {mark}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Canvas */}
          <div 
            className="flex-1 bg-stone-200/80 p-3 md:p-4 flex flex-col items-center justify-center overflow-auto select-none relative"
            onClick={() => {
              if (toolMode === 'select') setSelectedId(null);
            }}
          >
            {/* Top Drawing Mode & Grid Alignment Bar */}
            <div 
              className="w-full max-w-[720px] mb-2 flex flex-wrap items-center justify-between gap-1.5 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-stone-300 shadow-sm text-xs z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mouse Drawing & Straightening Tools */}
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setToolMode('select');
                    setDrawPoints([]);
                    setPolygonCursorPos(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    toolMode === 'select'
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  title="โหมดเลือก ย้าย และดึงจุดปลาย"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>เลือก/ย้าย</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToolMode('draw_line');
                    setDrawPoints([]);
                    setSelectedId(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    toolMode === 'draw_line'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  title="คลิกค้างแล้วลากเมาส์วาดเส้นตรง (กด Shift ล็อกมุมทีละ 15°)"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>ลากวาดเส้นตรง</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToolMode('draw_smart');
                    setDrawPoints([]);
                    setSelectedId(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    toolMode === 'draw_smart'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  title="วาดเส้นอิสระด้วยเมาส์แล้วแปลงเป็นเส้นตรง สามเหลี่ยม สี่เหลี่ยม หรือวงกลมอัตโนมัติ"
                >
                  <Shapes className="w-3.5 h-3.5" />
                  <span>วาดอิสระแปลงเป็นทรง</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setToolMode('draw_polygon');
                    setDrawPoints([]);
                    setSelectedId(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                    toolMode === 'draw_polygon'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                  title="คลิกทีละจุดเพื่อสร้างรูปหลายเหลี่ยมหรือเส้นหักต่อเนื่อง"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ลากจุดต่อจุด</span>
                </button>
              </div>

              {/* Zoom & Grid Alignment Controls */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`p-1 rounded ${showGrid ? 'bg-blue-100 text-blue-700' : 'text-stone-600 hover:bg-stone-100'}`}
                  title="เปิด/ปิดตาราง Grid"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(parseInt(e.target.value) || 20)}
                  className="px-1 py-0.5 text-[10px] font-bold border border-stone-200 rounded bg-stone-50 text-stone-700"
                  title="ขนาดช่องตาราง Grid"
                >
                  <option value={10}>Grid 10px</option>
                  <option value={20}>Grid 20px</option>
                  <option value={40}>Grid 40px</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${snapToGrid ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  title="ดูดติดจุดตัดตารางและล็อกมุมตรงอัตโนมัติ"
                >
                  Snap Grid
                </button>
                <button
                  type="button"
                  onClick={() => setShowSmartGuides(!showSmartGuides)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${showSmartGuides ? 'bg-pink-600 text-white' : 'text-stone-600 hover:bg-stone-100 border border-stone-200'}`}
                  title="เส้นช่วยจัดแนวอัจฉริยะ (Smart Alignment Guides)"
                >
                  Guides
                </button>
                <div className="w-px h-3.5 bg-stone-200 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                  className="p-1 hover:bg-stone-100 rounded text-stone-600"
                  title="ย่อมุมมอง"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-bold text-stone-700 w-9 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(1.5, prev + 0.25))}
                  className="p-1 hover:bg-stone-100 rounded text-stone-600"
                  title="ขยายมุมมอง"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sub-bar when Drawing Mode is Active: Preset Endpoint Caps & Line Shape */}
              {toolMode !== 'select' && (
                <div className="w-full pt-1.5 mt-1 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500 font-semibold">ทรงเส้น:</span>
                      <select
                        value={drawPresetLineShape}
                        onChange={(e) => setDrawPresetLineShape(e.target.value as any)}
                        className="px-1.5 py-0.5 border border-stone-300 rounded bg-white font-semibold text-stone-800"
                      >
                        <option value="straight">เส้นตรง (Straight)</option>
                        <option value="curved">เส้นโค้ง (Curved)</option>
                        <option value="elbow">เส้นหักฉาก (Elbow)</option>
                        <option value="zigzag">เส้นซิกแซก/สปริง (Zigzag)</option>
                        <option value="double">เส้นคู่ขนาน (Double)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500 font-semibold">หัวเส้นเริ่มต้น:</span>
                      <select
                        value={drawPresetCapStart}
                        onChange={(e) => setDrawPresetCapStart(e.target.value)}
                        className="px-1.5 py-0.5 border border-stone-300 rounded bg-white font-semibold text-stone-800"
                      >
                        <option value="none">ไม่มี (None)</option>
                        <option value="arrow">หัวลูกศรทึบ</option>
                        <option value="open_arrow">หัวลูกศรโปร่ง</option>
                        <option value="dot">จุดทึบ</option>
                        <option value="hollow_dot">จุดโปร่ง</option>
                        <option value="bar">ขีดกั้นตั้งฉาก</option>
                        <option value="diamond">หัวข้าวหลามตัด</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-stone-500 font-semibold">ปลายเส้นสิ้นสุด:</span>
                      <select
                        value={drawPresetCapEnd}
                        onChange={(e) => setDrawPresetCapEnd(e.target.value)}
                        className="px-1.5 py-0.5 border border-stone-300 rounded bg-white font-semibold text-stone-800"
                      >
                        <option value="none">ไม่มี (None)</option>
                        <option value="arrow">หัวลูกศรทึบ</option>
                        <option value="open_arrow">หัวลูกศรโปร่ง</option>
                        <option value="dot">จุดทึบ</option>
                        <option value="hollow_dot">จุดโปร่ง</option>
                        <option value="bar">ขีดกั้นตั้งฉาก</option>
                        <option value="diamond">หัวข้าวหลามตัด</option>
                      </select>
                    </div>
                  </div>

                  {toolMode === 'draw_polygon' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        คลิกวางจุด ({drawPoints.length} จุด)
                      </span>
                      {drawPoints.length >= 2 && (
                        <>
                          <button
                            type="button"
                            onClick={() => finishPolygonDrawing(true)}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded font-bold text-[10px] hover:bg-emerald-700"
                          >
                            ปิดรูปหลายเหลี่ยม
                          </button>
                          <button
                            type="button"
                            onClick={() => finishPolygonDrawing(false)}
                            className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold text-[10px] hover:bg-blue-700"
                          >
                            จบเส้นเปิด
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-blue-700 font-semibold">
                      {toolMode === 'draw_line'
                        ? 'คลิกค้างบนผืนผ้าใบแล้วลากเพื่อวาดเส้นตรง (กด Shift ล็อกมุมทีละ 15°)'
                        : 'วาดเส้นด้วยเมาส์ ระบบจะดัดเป็นเส้นตรง/สามเหลี่ยม/สี่เหลี่ยม/วงกลมให้อัตโนมัติ'}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Interactive Canvas Container */}
            <div 
              className="bg-white rounded-xl shadow-lg border border-stone-300 relative overflow-hidden transition-transform duration-75"
              style={{ 
                width: CANVAS_WIDTH, 
                height: CANVAS_HEIGHT,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
              {/* Main Interactive SVG */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className={`w-full h-full ${toolMode !== 'select' ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              >
                {/* Crisp Major & Minor Grid Lines */}
                {showGrid && (
                  <g className="pointer-events-none">
                    {Array.from({ length: Math.floor(CANVAS_WIDTH / gridSize) + 1 }).map((_, idx) => {
                      const gx = idx * gridSize;
                      const isMajor = gx % (gridSize * 5) === 0;
                      return (
                        <line
                          key={`vg-${gx}`}
                          x1={gx}
                          y1={0}
                          x2={gx}
                          y2={CANVAS_HEIGHT}
                          stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
                          strokeWidth={isMajor ? 1 : 0.8}
                        />
                      );
                    })}
                    {Array.from({ length: Math.floor(CANVAS_HEIGHT / gridSize) + 1 }).map((_, idx) => {
                      const gy = idx * gridSize;
                      const isMajor = gy % (gridSize * 5) === 0;
                      return (
                        <line
                          key={`hg-${gy}`}
                          x1={0}
                          y1={gy}
                          x2={CANVAS_WIDTH}
                          y2={gy}
                          stroke={isMajor ? '#cbd5e1' : '#f1f5f9'}
                          strokeWidth={isMajor ? 1 : 0.8}
                        />
                      );
                    })}
                  </g>
                )}

                {elements.map(el => {
                  const isSelected = el.id === selectedId;
                  const cx = el.x + el.width / 2;
                  const cy = el.y + el.height / 2;
                  const transform = getTransformString(el);
                  const isPointLine = (el.type === 'line' || el.type === 'arrow') && el.extraProps?.x1 !== undefined;

                  return (
                    <g 
                      key={el.id} 
                      transform={transform}
                      className={toolMode === 'select' ? 'cursor-pointer group' : ''}
                      onMouseDown={(e) => handleMouseDown(e, 'move', el.id)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(el.id);
                        setTimeout(() => {
                          inspectorTextInputRef.current?.focus();
                          inspectorTextInputRef.current?.select();
                        }, 30);
                      }}
                    >
                      {/* Render Element */}
                      {renderSvgElement(el)}

                      {/* Selection Bounding Box & Drag Handles */}
                      {isSelected && (
                        <g className="selection-box">
                          {isPointLine ? (
                            (() => {
                              const x1 = Number(el.extraProps?.x1 ?? el.x);
                              const y1 = Number(el.extraProps?.y1 ?? cy);
                              const x2 = Number(el.extraProps?.x2 ?? (el.x + el.width));
                              const y2 = Number(el.extraProps?.y2 ?? cy);
                              const mx = (x1 + x2) / 2;
                              const my = (y1 + y2) / 2;
                              const dx = x2 - x1;
                              const dy = y2 - y1;
                              const len = Math.max(1, Math.hypot(dx, dy));
                              const nx = -dy / len;
                              const ny = dx / len;
                              const curveOff = Number(el.extraProps?.curveOffset ?? -45);
                              const curveHandleX = mx + nx * (curveOff * 0.5);
                              const curveHandleY = my + ny * (curveOff * 0.5);
                              return (
                                <g>
                                  <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="#3b82f6"
                                    strokeWidth={1.2}
                                    strokeDasharray="4,4"
                                  />
                                  {/* Start Endpoint Handle P1 */}
                                  <circle
                                    cx={x1}
                                    cy={y1}
                                    r={6.5}
                                    fill="#2563eb"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    className="cursor-move"
                                    onMouseDown={(e) => handleMouseDown(e, 'p1', el.id)}
                                  />
                                  {/* End Endpoint Handle P2 */}
                                  <circle
                                    cx={x2}
                                    cy={y2}
                                    r={6.5}
                                    fill="#059669"
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    className="cursor-move"
                                    onMouseDown={(e) => handleMouseDown(e, 'p2', el.id)}
                                  />
                                  {/* Curve Control Handle when lineShape === 'curved' */}
                                  {el.extraProps?.lineShape === 'curved' && (
                                    <rect
                                      x={curveHandleX - 5}
                                      y={curveHandleY - 5}
                                      width={10}
                                      height={10}
                                      rx={2}
                                      fill="#f59e0b"
                                      stroke="#ffffff"
                                      strokeWidth={1.5}
                                      className="cursor-ns-resize"
                                      onMouseDown={(e) => handleMouseDown(e, 'curve', el.id)}
                                    />
                                  )}
                                </g>
                              );
                            })()
                          ) : (
                            <>
                              <rect
                                x={el.x - 3}
                                y={el.y - 3}
                                width={el.width + 6}
                                height={el.height + 6}
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                strokeDasharray="4,4"
                              />
                              {/* Corner Handles */}
                              <rect
                                x={el.x - 7}
                                y={el.y - 7}
                                width={8}
                                height={8}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                className="cursor-nwse-resize"
                                onMouseDown={(e) => handleMouseDown(e, 'nw')}
                              />
                              <rect
                                x={el.x + el.width - 1}
                                y={el.y - 7}
                                width={8}
                                height={8}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                className="cursor-nesw-resize"
                                onMouseDown={(e) => handleMouseDown(e, 'ne')}
                              />
                              <rect
                                x={el.x + el.width - 1}
                                y={el.y + el.height - 1}
                                width={8}
                                height={8}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                className="cursor-nwse-resize"
                                onMouseDown={(e) => handleMouseDown(e, 'se')}
                              />
                              <rect
                                x={el.x - 7}
                                y={el.y + el.height - 1}
                                width={8}
                                height={8}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                className="cursor-nesw-resize"
                                onMouseDown={(e) => handleMouseDown(e, 'sw')}
                              />

                              {/* Top Rotation Handle */}
                              <line x1={cx} y1={el.y - 3} x2={cx} y2={el.y - 18} stroke="#3b82f6" strokeWidth={1.5} />
                              <circle
                                cx={cx}
                                cy={el.y - 20}
                                r={5}
                                fill="#3b82f6"
                                stroke="#ffffff"
                                strokeWidth={1.5}
                                className="cursor-grab active:cursor-grabbing"
                                onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                              />

                              {/* Draggable Vertex Handles for polygon_custom */}
                              {el.type === 'polygon_custom' && Array.isArray(el.extraProps?.points) && (
                                el.extraProps.points.map((pt: { x: number; y: number }, vIdx: number) => {
                                  const vx = el.x + pt.x * el.width;
                                  const vy = el.y + pt.y * el.height;
                                  return (
                                    <circle
                                      key={`v-${vIdx}`}
                                      cx={vx}
                                      cy={vy}
                                      r={5.5}
                                      fill="#7c3aed"
                                      stroke="#ffffff"
                                      strokeWidth={1.8}
                                      className="cursor-move"
                                      onMouseDown={(e) => handleMouseDown(e, `vertex-${vIdx}`, el.id)}
                                    />
                                  );
                                })
                              )}
                            </>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Live Line-Intersection Detection Badges on Canvas */}
                {lineIntersections.map(inter => (
                  <g
                    key={inter.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStampIntersectionAngle(inter, false);
                    }}
                  >
                    <circle cx={inter.x} cy={inter.y} r={4.5} fill="#7c3aed" stroke="#ffffff" strokeWidth={1.5} />
                    <rect
                      x={inter.x + 8}
                      y={inter.y - 22}
                      width={68}
                      height={18}
                      rx={5}
                      fill="#7c3aed"
                      opacity={0.92}
                    />
                    <text
                      x={inter.x + 42}
                      y={inter.y - 13}
                      fontSize={9.5}
                      fontWeight="bold"
                      fill="#ffffff"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontFamily="sans-serif"
                    >
                      {inter.acuteDeg}° / {inter.obtuseDeg}°
                    </text>
                  </g>
                ))}

                {/* Live Smart Alignment Guides (Pink/Cyan Reference Lines) */}
                {(activeGuides.verticals.length > 0 || activeGuides.horizontals.length > 0) && (
                  <g className="pointer-events-none">
                    {activeGuides.verticals.map((vx, i) => (
                      <line
                        key={`guide-v-${i}`}
                        x1={vx}
                        y1={0}
                        x2={vx}
                        y2={CANVAS_HEIGHT}
                        stroke="#ec4899"
                        strokeWidth={1.3}
                        strokeDasharray="4,3"
                      />
                    ))}
                    {activeGuides.horizontals.map((hy, i) => (
                      <line
                        key={`guide-h-${i}`}
                        x1={0}
                        y1={hy}
                        x2={CANVAS_WIDTH}
                        y2={hy}
                        stroke="#ec4899"
                        strokeWidth={1.3}
                        strokeDasharray="4,3"
                      />
                    ))}
                  </g>
                )}

                {/* Live Stroke Preview while Drawing */}
                {drawPoints.length > 0 && (
                  <g className="pointer-events-none">
                    {toolMode === 'draw_line' && drawPoints.length >= 2 && (() => {
                      const p1 = drawPoints[0];
                      const p2 = drawPoints[drawPoints.length - 1];
                      const dist = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
                      const deg = Math.round(Math.atan2(-(p2.y - p1.y), p2.x - p1.x) * (180 / Math.PI));
                      return (
                        <g>
                          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5,3" />
                          <circle cx={p1.x} cy={p1.y} r={4.5} fill="#2563eb" />
                          <circle cx={p2.x} cy={p2.y} r={4.5} fill="#059669" />
                          <rect x={(p1.x + p2.x) / 2 - 42} y={(p1.y + p2.y) / 2 - 24} width={84} height={18} rx={4} fill="#1e293b" opacity={0.9} />
                          <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2 - 15} fontSize={10} fontWeight="bold" fill="#ffffff" textAnchor="middle" dominantBaseline="central" fontFamily="sans-serif">
                            {dist}px ({deg}°)
                          </text>
                        </g>
                      );
                    })()}

                    {toolMode === 'draw_smart' && drawPoints.length >= 2 && (
                      <polyline
                        points={drawPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="4,3"
                      />
                    )}

                    {toolMode === 'draw_polygon' && (
                      <g>
                        <polyline
                          points={[...drawPoints, ...(polygonCursorPos ? [polygonCursorPos] : [])].map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#059669"
                          strokeWidth={2.2}
                          strokeDasharray="4,3"
                        />
                        {drawPoints.map((pt, idx) => (
                          <circle
                            key={idx}
                            cx={pt.x}
                            cy={pt.y}
                            r={idx === 0 ? 6 : 4}
                            fill={idx === 0 ? '#dc2626' : '#059669'}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                        ))}
                      </g>
                    )}
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* Right Inspector Sidebar: Element-Specific Knobs */}
          {selectedElement && (
            <div className="w-72 border-l border-stone-200 bg-white flex flex-col shrink-0 overflow-y-auto p-3 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <span className="text-xs font-bold text-stone-800">การปรับแต่งเชิงลึก</span>
                <span className="px-2 py-0.5 rounded bg-stone-100 text-[10px] font-mono font-semibold text-stone-600">
                  {selectedElement.type}
                </span>
              </div>

              {/* Text Editor if element supports text */}
              {selectedElement.text !== undefined && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-stone-600 block">ข้อความกำกับ:</label>
                  <input
                    ref={inspectorTextInputRef}
                    type="text"
                    value={selectedElement.text || ''}
                    onChange={(e) => updateSelectedField('text', e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    placeholder="พิมพ์ข้อความ..."
                  />

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div>
                      <label className="text-[10px] text-stone-500 font-semibold block mb-0.5">ขนาดตัวอักษร:</label>
                      <input
                        type="number"
                        min={9}
                        max={48}
                        value={selectedElement.fontSize || 14}
                        onChange={(e) => updateSelectedField('fontSize', parseInt(e.target.value) || 14)}
                        className="w-full px-2 py-1 text-xs border border-stone-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 font-semibold block mb-0.5">ความหนา:</label>
                      <select
                        value={selectedElement.fontWeight || 'bold'}
                        onChange={(e) => updateSelectedField('fontWeight', e.target.value)}
                        className="w-full px-1.5 py-1 text-xs border border-stone-300 rounded-md"
                      >
                        <option value="normal">ปกติ (Normal)</option>
                        <option value="bold">หนา (Bold)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Line & Arrow Endpoint Caps, Line Shapes, Angle Presets & Intersection Angles */}
              {(selectedElement.type === 'line' || selectedElement.type === 'arrow') && (() => {
                const x1 = Number(selectedElement.extraProps?.x1 ?? selectedElement.x);
                const y1 = Number(selectedElement.extraProps?.y1 ?? (selectedElement.y + selectedElement.height / 2));
                const x2 = Number(selectedElement.extraProps?.x2 ?? (selectedElement.x + selectedElement.width));
                const y2 = Number(selectedElement.extraProps?.y2 ?? (selectedElement.y + selectedElement.height / 2));
                const lineLen = Math.round(Math.hypot(x2 - x1, y2 - y1));
                const lineDeg = Math.round(Math.atan2(-(y2 - y1), x2 - x1) * (180 / Math.PI));
                const myIntersections = lineIntersections.filter(
                  it => it.lineAId === selectedElement.id || it.lineBId === selectedElement.id
                );

                const setLineAngleDeg = (targetDeg: number) => {
                  const rad = (-targetDeg * Math.PI) / 180;
                  const nx2 = Math.round(x1 + lineLen * Math.cos(rad));
                  const ny2 = Math.round(y1 + lineLen * Math.sin(rad));
                  const updated = elementsRef.current.map(el => {
                    if (el.id !== selectedElement.id) return el;
                    return {
                      ...el,
                      x: Math.min(x1, nx2),
                      y: Math.min(y1, ny2) - 12,
                      width: Math.max(20, Math.abs(nx2 - x1)),
                      height: Math.max(24, Math.abs(ny2 - y1) + 24),
                      rotation: 0,
                      extraProps: { ...(el.extraProps || {}), x1, y1, x2: nx2, y2: ny2 }
                    };
                  });
                  saveToHistory(updated);
                };

                return (
                  <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900">ปรับแต่งเส้น & ปลายเส้น</span>
                      <span className="text-[10px] font-mono font-bold text-blue-700">{lineLen}px | {lineDeg}°</span>
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block mb-0.5">รูปทรงของเส้น (Line Shape):</label>
                      <select
                        value={selectedElement.extraProps?.lineShape || 'straight'}
                        onChange={(e) => updateSelectedExtraProp('lineShape', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white font-medium"
                      >
                        <option value="straight">เส้นตรง (Straight)</option>
                        <option value="curved">เส้นโค้งพาราโบลา (Curved)</option>
                        <option value="elbow">เส้นหักมุมฉาก (Elbow 90°)</option>
                        <option value="zigzag">เส้นซิกแซก/คลื่น (Zigzag)</option>
                        <option value="double">เส้นคู่ขนาน (Double Line)</option>
                      </select>
                    </div>

                    {selectedElement.extraProps?.lineShape === 'curved' && (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-stone-600">
                          <span>ความโค้ง (Curve Offset)</span>
                          <span className="font-bold text-blue-700">{selectedElement.extraProps?.curveOffset ?? -45} px</span>
                        </div>
                        <input
                          type="range"
                          min={-140}
                          max={140}
                          value={selectedElement.extraProps?.curveOffset ?? -45}
                          onChange={(e) => updateSelectedExtraProp('curveOffset', parseInt(e.target.value))}
                          className="w-full accent-blue-600"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[10px] text-stone-600 font-semibold block mb-0.5">หัวเส้นเริ่มต้น (P1):</label>
                        <select
                          value={selectedElement.extraProps?.startCap || 'none'}
                          onChange={(e) => updateSelectedExtraProp('startCap', e.target.value)}
                          className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white text-[11px]"
                        >
                          <option value="none">ไม่มี (None)</option>
                          <option value="arrow">ลูกศรทึบ</option>
                          <option value="open_arrow">ลูกศรโปร่ง</option>
                          <option value="dot">จุดทึบ</option>
                          <option value="hollow_dot">จุดโปร่ง</option>
                          <option value="bar">ขีดตั้งฉาก</option>
                          <option value="diamond">ข้าวหลามตัด</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-600 font-semibold block mb-0.5">ปลายเส้นสิ้นสุด (P2):</label>
                        <select
                          value={selectedElement.extraProps?.endCap ?? (selectedElement.type === 'arrow' ? 'arrow' : 'none')}
                          onChange={(e) => updateSelectedExtraProp('endCap', e.target.value)}
                          className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white text-[11px]"
                        >
                          <option value="none">ไม่มี (None)</option>
                          <option value="arrow">ลูกศรทึบ</option>
                          <option value="open_arrow">ลูกศรโปร่ง</option>
                          <option value="dot">จุดทึบ</option>
                          <option value="hollow_dot">จุดโปร่ง</option>
                          <option value="bar">ขีดตั้งฉาก</option>
                          <option value="diamond">ข้าวหลามตัด</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block mb-1">ล็อกมุมเส้นตรงด่วน:</label>
                      <div className="grid grid-cols-6 gap-1">
                        {[0, 30, 45, 60, 90, 135].map(deg => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => setLineAngleDeg(deg)}
                            className="py-1 bg-white border border-stone-300 hover:border-blue-500 hover:bg-blue-50 rounded text-[10px] font-bold text-stone-700"
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>

                    {myIntersections.length > 0 && (
                      <div className="pt-2 border-t border-blue-200 space-y-1.5">
                        <span className="text-[11px] font-bold text-violet-900 block">
                          ตรวจพบจุดตัดเส้นตรง ({myIntersections.length} จุด):
                        </span>
                        {myIntersections.map((inter, idx) => (
                          <div key={inter.id} className="p-2 bg-white rounded-lg border border-violet-200 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-stone-700">จุดตัดที่ {idx + 1}:</span>
                              <span className="font-bold text-violet-700">
                                มุมแหลม {inter.acuteDeg}° | มุมป้าน {inter.obtuseDeg}°
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => handleStampIntersectionAngle(inter, false)}
                                className="py-1 px-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded text-[10px] font-bold"
                              >
                                + ปักมุม {inter.acuteDeg}°
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStampIntersectionAngle(inter, true)}
                                className="py-1 px-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded text-[10px] font-bold"
                              >
                                + ปักมุม {inter.obtuseDeg}°
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Polygon Custom / Multi-Segment Polyline Controls */}
              {selectedElement.type === 'polygon_custom' && (
                <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2 text-xs">
                  <span className="font-bold text-indigo-900 block">ตั้งค่ารูปหลายเหลี่ยม / เส้นหัก:</span>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-700">เชื่อมจุดปิดเป็นรูปทรง (Closed)</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.closed !== false}
                      onChange={(e) => {
                        updateSelectedExtraProp('closed', e.target.checked, false);
                        if (e.target.checked && selectedElement.fill === 'none') {
                          updateSelectedField('fill', '#f8fafc', true);
                        }
                      }}
                      className="accent-indigo-600 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-700">แสดงส่วนโค้งและองศาทุกมุมยอด</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.extraProps?.showVertexAngles)}
                      onChange={(e) => updateSelectedExtraProp('showVertexAngles', e.target.checked)}
                      className="accent-indigo-600 rounded"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500">
                    ลากจุดสีม่วงบนผืนผ้าใบเพื่อดัดมุมแต่ละยอดได้อย่างอิสระ
                  </p>
                </div>
              )}

              {/* Parallel Lines & Transversal Angle Controls (ฟีเจอร์มุมเส้นตัดเส้นขนาน) */}
              {selectedElement.type === 'parallel_transversal' && (
                <div className="p-2.5 bg-violet-50/60 rounded-xl border border-violet-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-violet-900">เส้นขนาน & มุมเส้นตัด</span>
                    <span className="font-bold text-violet-700">{selectedElement.extraProps?.transversalAngle ?? 65}°</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-semibold block">องศาเส้นตัดขวาง (Transversal Angle):</label>
                    <input
                      type="range"
                      min={25}
                      max={155}
                      step={5}
                      value={selectedElement.extraProps?.transversalAngle ?? 65}
                      onChange={(e) => {
                        const deg = parseInt(e.target.value);
                        updateSelectedExtraProp('transversalAngle', deg, false);
                        updateSelectedExtraProp('topAngleLabel', `${deg}°`, true);
                      }}
                      className="w-full accent-violet-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-semibold block mb-0.5">รูปแบบความสัมพันธ์ของมุมเส้นตัด:</label>
                    <select
                      value={selectedElement.extraProps?.angleMode || 'alternate_interior'}
                      onChange={(e) => updateSelectedExtraProp('angleMode', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white text-[11px] font-medium"
                    >
                      <option value="alternate_interior">มุมแย้งภายใน (Alternate Interior)</option>
                      <option value="corresponding">มุมภายนอก-ภายในข้างเดียวกัน (Corresponding)</option>
                      <option value="co_interior">มุมภายในข้างเดียวกันรวม 180° (Co-Interior)</option>
                      <option value="alternate_exterior">มุมแย้งภายนอก (Alternate Exterior)</option>
                      <option value="all_angles">แสดงมุมรอบจุดตัดครบทุกมุม</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-600 block">ป้ายมุมบน (จุดตัด 1)</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.topAngleLabel ?? '65°'}
                        onChange={(e) => updateSelectedExtraProp('topAngleLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">ป้ายมุมล่าง (จุดตัด 2)</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.bottomAngleLabel ?? 'x'}
                        onChange={(e) => updateSelectedExtraProp('bottomAngleLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-600 block">ชื่อเส้นบน</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.line1Label ?? 'AB'}
                        onChange={(e) => updateSelectedExtraProp('line1Label', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">ชื่อเส้นล่าง</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.line2Label ?? 'CD'}
                        onChange={(e) => updateSelectedExtraProp('line2Label', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-700">แสดงสัญลักษณ์เส้นขนาน (&gt;&gt;)</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showParallelMarks !== false}
                      onChange={(e) => updateSelectedExtraProp('showParallelMarks', e.target.checked)}
                      className="accent-violet-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Intersecting Lines & Vertical Angles Controls (เส้นตรง 2 เส้นตัดกัน / มุมตรงข้าม) */}
              {selectedElement.type === 'intersecting_lines' && (
                <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900">มุมเส้นตัดกัน 4 ทิศ</span>
                    <span className="font-bold text-rose-700">
                      {selectedElement.extraProps?.angle ?? 60}° / {180 - (selectedElement.extraProps?.angle ?? 60)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={165}
                    step={5}
                    value={selectedElement.extraProps?.angle ?? 60}
                    onChange={(e) => {
                      const deg = parseInt(e.target.value);
                      updateSelectedExtraProp('angle', deg, false);
                      updateSelectedExtraProp('rightLabel', `${deg}°`, false);
                      updateSelectedExtraProp('topLabel', `${180 - deg}°`, true);
                    }}
                    className="w-full accent-rose-600"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-600 block">มุมขวา</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.rightLabel ?? '60°'}
                        onChange={(e) => updateSelectedExtraProp('rightLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                        placeholder="เช่น 60°"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">มุมซ้าย (ตรงข้าม)</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.leftLabel ?? 'x'}
                        onChange={(e) => updateSelectedExtraProp('leftLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                        placeholder="เช่น x"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">มุมบน (ประชิด)</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.topLabel ?? '120°'}
                        onChange={(e) => updateSelectedExtraProp('topLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                        placeholder="เช่น 120°"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">มุมล่าง (ประชิด)</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.bottomLabel ?? ''}
                        onChange={(e) => updateSelectedExtraProp('bottomLabel', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                        placeholder="เว้นว่างเพื่อซ่อน"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Angle Arc Specific Controls */}
              {selectedElement.type === 'angle_arc' && (
                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900">องศาของมุม ({selectedElement.extraProps?.angle ?? 60}°)</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={360}
                    step={5}
                    value={selectedElement.extraProps?.angle ?? 60}
                    onChange={(e) => {
                      const deg = parseInt(e.target.value);
                      updateSelectedExtraProp('angle', deg, false);
                      updateSelectedField('text', `${deg}°`, true);
                    }}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">แสดงตัวเลของศา</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showDegree !== false}
                      onChange={(e) => updateSelectedExtraProp('showDegree', e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Right Triangle Specific Controls */}
              {selectedElement.type === 'right_triangle' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-800 block">ทิศทางมุมฉาก:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'bottom-left', label: 'มุมซ้ายล่าง' },
                      { id: 'bottom-right', label: 'มุมขวาล่าง' },
                      { id: 'top-left', label: 'มุมซ้ายบน' },
                      { id: 'top-right', label: 'มุมขวาบน' },
                    ].map(quad => (
                      <button
                        key={quad.id}
                        type="button"
                        onClick={() => updateSelectedExtraProp('orientation', quad.id)}
                        className={`p-1.5 rounded-lg text-[11px] font-medium border ${
                          (selectedElement.extraProps?.orientation || 'bottom-left') === quad.id 
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold' 
                            : 'border-stone-200 bg-white text-stone-700'
                        }`}
                      >
                        {quad.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-600">สัญลักษณ์มุมฉาก</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showRightAngle !== false}
                      onChange={(e) => updateSelectedExtraProp('showRightAngle', e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Parallelogram & Trapezoid Controls */}
              {selectedElement.type === 'parallelogram' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">ความเอียงด้านขนาน:</span>
                    <span className="font-bold text-blue-600">{selectedElement.extraProps?.slant ?? 32} px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={selectedElement.extraProps?.slant ?? 32}
                    onChange={(e) => updateSelectedExtraProp('slant', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}

              {selectedElement.type === 'trapezoid' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">ระยะหุบด้านบนคางหมู:</span>
                    <span className="font-bold text-blue-600">{selectedElement.extraProps?.topInset ?? 32} px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={selectedElement.extraProps?.topInset ?? 32}
                    onChange={(e) => updateSelectedExtraProp('topInset', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}

              {/* Coordinate Axes X-Y Specific Controls */}
              {selectedElement.type === 'axes_xy' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-800 block">ตั้งค่าแกนพิกัดฉาก:</span>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">แสดงเส้นตาราง (Grid)</span>
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.extraProps?.showGrid)}
                      onChange={(e) => updateSelectedExtraProp('showGrid', e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">แสดงหัวลูกศรปลายแกน</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showArrows !== false}
                      onChange={(e) => updateSelectedExtraProp('showArrows', e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-500 block">แกน X</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.xLabel ?? 'X'}
                        onChange={(e) => updateSelectedExtraProp('xLabel', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">แกน Y</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.yLabel ?? 'Y'}
                        onChange={(e) => updateSelectedExtraProp('yLabel', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">จุดกำเนิด</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.originLabel ?? 'O'}
                        onChange={(e) => updateSelectedExtraProp('originLabel', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Analog Clock Controls */}
              {selectedElement.type === 'analog_clock' && (
                <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2.5">
                  <span className="text-xs font-bold text-rose-900 block">ตั้งเวลานาฬิกา ({selectedElement.extraProps?.hour ?? 3}:{String(selectedElement.extraProps?.minute ?? 15).padStart(2, '0')})</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block">เข็มสั้น (ชั่วโมง 1-12)</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={selectedElement.extraProps?.hour ?? 3}
                        onChange={(e) => updateSelectedExtraProp('hour', Math.max(1, Math.min(12, parseInt(e.target.value) || 12)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block">เข็มยาว (นาที 0-59)</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        step={5}
                        value={selectedElement.extraProps?.minute ?? 15}
                        onChange={(e) => updateSelectedExtraProp('minute', Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">แสดงตัวเลข 1-12</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showNumbers !== false}
                      onChange={(e) => updateSelectedExtraProp('showNumbers', e.target.checked)}
                      className="accent-rose-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Fraction Bar & Fraction Circle Controls */}
              {['fraction_bar', 'fraction_circle'].includes(selectedElement.type) && (
                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2.5">
                  <span className="text-xs font-bold text-blue-900 block">
                    ตั้งค่าเศษส่วน ({selectedElement.extraProps?.shadedParts ?? 1}/{selectedElement.extraProps?.totalParts ?? 4})
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block">ตัวเศษ (ส่วนที่แรเงา)</label>
                      <input
                        type="number"
                        min={0}
                        max={selectedElement.extraProps?.totalParts ?? 4}
                        value={selectedElement.extraProps?.shadedParts ?? 1}
                        onChange={(e) => updateSelectedExtraProp('shadedParts', Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 font-semibold block">ตัวส่วน (จำนวนช่อง)</label>
                      <input
                        type="number"
                        min={2}
                        max={16}
                        value={selectedElement.extraProps?.totalParts ?? 4}
                        onChange={(e) => updateSelectedExtraProp('totalParts', Math.max(2, Math.min(16, parseInt(e.target.value) || 2)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">สีส่วนที่แรเงา:</span>
                    <input
                      type="color"
                      value={selectedElement.extraProps?.shadedColor || '#3b82f6'}
                      onChange={(e) => updateSelectedExtraProp('shadedColor', e.target.value)}
                      className="w-6 h-5 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                  {selectedElement.type === 'fraction_bar' && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-stone-600">แสดงป้าย 1/n ในแต่ละช่อง</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedElement.extraProps?.showLabels)}
                        onChange={(e) => updateSelectedExtraProp('showLabels', e.target.checked)}
                        className="accent-blue-600 rounded"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Bar Chart Controls */}
              {selectedElement.type === 'bar_chart' && (
                <div className="p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <span className="font-bold text-emerald-900 block">ข้อมูลแผนภูมิแท่ง:</span>
                  <div>
                    <label className="text-[10px] text-stone-600 font-semibold block">ชื่อแผนภูมิ</label>
                    <input
                      type="text"
                      value={selectedElement.extraProps?.chartTitle ?? ''}
                      onChange={(e) => updateSelectedExtraProp('chartTitle', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-semibold block">ค่าข้อมูล (คั่นด้วยลูกน้ำ ,)</label>
                    <input
                      type="text"
                      value={selectedElement.extraProps?.data ?? '15, 30, 20, 40'}
                      onChange={(e) => updateSelectedExtraProp('data', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 font-semibold block">ป้ายกำกับแกน X (คั่นด้วยลูกน้ำ ,)</label>
                    <input
                      type="text"
                      value={selectedElement.extraProps?.labels ?? 'ม.1, ม.2, ม.3, ม.4'}
                      onChange={(e) => updateSelectedExtraProp('labels', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-stone-600">แสดงตัวเลขบนยอดแท่ง</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showValues !== false}
                      onChange={(e) => updateSelectedExtraProp('showValues', e.target.checked)}
                      className="accent-emerald-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Ruler CM Controls */}
              {selectedElement.type === 'ruler_cm' && (
                <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2 text-xs">
                  <span className="font-bold text-amber-900 block">ตั้งค่าไม้บรรทัดวัดความยาว:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-600 block">ความยาวรวม (cm)</label>
                      <input
                        type="number"
                        min={5}
                        max={20}
                        value={selectedElement.extraProps?.cmLength ?? 10}
                        onChange={(e) => updateSelectedExtraProp('cmLength', Math.max(5, Math.min(20, parseInt(e.target.value) || 10)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">วัตถุที่วัดยาว (cm)</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        value={selectedElement.extraProps?.measureObjectLength ?? 6.5}
                        onChange={(e) => updateSelectedExtraProp('measureObjectLength', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 block">ชื่อวัตถุที่วัด (เว้นว่างได้)</label>
                    <input
                      type="text"
                      value={selectedElement.extraProps?.objectLabel ?? 'ดินสอ'}
                      onChange={(e) => updateSelectedExtraProp('objectLabel', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">แสดงขีดมิลลิเมตร (mm)</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.showMm !== false}
                      onChange={(e) => updateSelectedExtraProp('showMm', e.target.checked)}
                      className="accent-amber-600 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Number Line Specific Controls */}
              {selectedElement.type === 'number_line' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
                  <span className="text-xs font-bold text-stone-800 block">ช่วงเส้นจำนวน & จุด:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-500 font-semibold block">ค่าต่ำสุด (Min)</label>
                      <input
                        type="number"
                        value={selectedElement.extraProps?.min ?? -5}
                        onChange={(e) => updateSelectedExtraProp('min', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-stone-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 font-semibold block">ค่าสูงสุด (Max)</label>
                      <input
                        type="number"
                        value={selectedElement.extraProps?.max ?? 5}
                        onChange={(e) => updateSelectedExtraProp('max', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border border-stone-300 rounded"
                      />
                    </div>
                  </div>

                  <div className="pt-1 border-t border-stone-200 space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-700 block">จุดมาร์กเกอร์ (อสมการ):</label>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div>
                        <label className="text-[10px] text-stone-500 block">ตำแหน่งตัวเลข</label>
                        <input
                          type="number"
                          value={selectedElement.extraProps?.markerValue ?? 2}
                          onChange={(e) => updateSelectedExtraProp('markerValue', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-stone-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-500 block">ลักษณะจุด</label>
                        <select
                          value={selectedElement.extraProps?.markerType || 'closed'}
                          onChange={(e) => updateSelectedExtraProp('markerType', e.target.value)}
                          className="w-full px-1.5 py-1 border border-stone-300 rounded"
                        >
                          <option value="closed">จุดทึบ (≤, ≥)</option>
                          <option value="open">จุดโปร่ง (&lt;, &gt;)</option>
                          <option value="none">ไม่มีจุด</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-500 block mb-0.5">ลูกศรอสมการ</label>
                      <select
                        value={selectedElement.extraProps?.inequalityRay || 'none'}
                        onChange={(e) => updateSelectedExtraProp('inequalityRay', e.target.value)}
                        className="w-full px-1.5 py-1 text-xs border border-stone-300 rounded"
                      >
                        <option value="none">ไม่แสดงเส้นอสมการ</option>
                        <option value="left">ชี้ไปทางซ้าย (&lt;, ≤)</option>
                        <option value="right">ชี้ไปทางขวา (&gt;, ≥)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Science Circuits Specific Controls */}
              {selectedElement.type === 'circuit_bulb' && (
                <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900">เปล่งแสง (เปิดไฟสว่าง)</span>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.extraProps?.glowing)}
                    onChange={(e) => updateSelectedExtraProp('glowing', e.target.checked)}
                    className="accent-amber-600 rounded"
                  />
                </div>
              )}

              {selectedElement.type === 'circuit_switch' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">สถานะสวิตช์:</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedExtraProp('isOpen', !selectedElement.extraProps?.isOpen)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold ${
                      selectedElement.extraProps?.isOpen ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedElement.extraProps?.isOpen ? 'วงจรเปิด (ยกสวิตช์ขึ้น)' : 'วงจรปิด (สับสวิตช์ลง)'}
                  </button>
                </div>
              )}

              {selectedElement.type === 'circuit_battery' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">สลับขั้วไฟฟ้า (+ / -)</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedExtraProp('flipped', !selectedElement.extraProps?.flipped)}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold hover:bg-stone-100"
                  >
                    สลับขั้ว
                  </button>
                </div>
              )}

              {selectedElement.type === 'circuit_resistor' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <label className="text-xs font-bold text-stone-800 block">ค่าความต้านทาน (Ω):</label>
                  <input
                    type="text"
                    value={selectedElement.extraProps?.resistorValue ?? '10 Ω'}
                    onChange={(e) => updateSelectedExtraProp('resistorValue', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white"
                  />
                </div>
              )}

              {/* Thermometer Controls */}
              {selectedElement.type === 'thermometer' && (
                <div className="p-2.5 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900">อุณหภูมิที่อ่านได้:</span>
                    <span className="font-bold text-rose-700">{selectedElement.extraProps?.temperature ?? 37}{selectedElement.extraProps?.unit || '°C'}</span>
                  </div>
                  <input
                    type="range"
                    min={selectedElement.extraProps?.minTemp ?? 0}
                    max={selectedElement.extraProps?.maxTemp ?? 100}
                    value={selectedElement.extraProps?.temperature ?? 37}
                    onChange={(e) => updateSelectedExtraProp('temperature', parseInt(e.target.value))}
                    className="w-full accent-rose-600"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-500 block">ต่ำสุด</label>
                      <input
                        type="number"
                        value={selectedElement.extraProps?.minTemp ?? 0}
                        onChange={(e) => updateSelectedExtraProp('minTemp', parseInt(e.target.value) || 0)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">สูงสุด</label>
                      <input
                        type="number"
                        value={selectedElement.extraProps?.maxTemp ?? 100}
                        onChange={(e) => updateSelectedExtraProp('maxTemp', parseInt(e.target.value) || 100)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">หน่วย</label>
                      <select
                        value={selectedElement.extraProps?.unit || '°C'}
                        onChange={(e) => updateSelectedExtraProp('unit', e.target.value)}
                        className="w-full px-1 py-1 border border-stone-300 rounded bg-white"
                      >
                        <option value="°C">°C</option>
                        <option value="°F">°F</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Scale Controls */}
              {selectedElement.type === 'balance_scale' && (
                <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2 text-xs">
                  <span className="font-bold text-amber-900 block">ตั้งค่าตาชั่งสองแขน:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'left', label: 'เอียงซ้าย' },
                      { id: 'even', label: 'สมดุล' },
                      { id: 'right', label: 'เอียงขวา' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updateSelectedExtraProp('tilt', opt.id)}
                        className={`py-1 rounded text-[11px] font-bold border ${
                          (selectedElement.extraProps?.tilt || 'even') === opt.id
                            ? 'border-amber-600 bg-amber-100 text-amber-900'
                            : 'border-stone-200 bg-white text-stone-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <div>
                      <label className="text-[10px] text-stone-500 block">จานซ้าย</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.leftWeight ?? '500 g'}
                        onChange={(e) => updateSelectedExtraProp('leftWeight', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">จานขวา</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.rightWeight ?? '500 g'}
                        onChange={(e) => updateSelectedExtraProp('rightWeight', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Science Lab Glassware Liquid Level & Color */}
              {['science_beaker', 'science_test_tube', 'science_flask'].includes(selectedElement.type) && (
                <div className="p-2.5 bg-sky-50/50 rounded-xl border border-sky-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-sky-900">ระดับของเหลว:</span>
                    <span className="font-bold text-sky-700">{selectedElement.extraProps?.liquidLevel ?? 60}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedElement.extraProps?.liquidLevel ?? 60}
                    onChange={(e) => updateSelectedExtraProp('liquidLevel', parseInt(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">สีสารละลายเคมี:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: 'น้ำเงิน', color: '#bae6fd' },
                        { label: 'เหลือง', color: '#fef08a' },
                        { label: 'เขียว', color: '#bbf7d0' },
                        { label: 'ม่วง', color: '#fbcfe8' },
                        { label: 'ส้ม', color: '#fed7aa' },
                      ].map(swatch => (
                        <button
                          key={swatch.color}
                          type="button"
                          onClick={() => updateSelectedExtraProp('liquidColor', swatch.color)}
                          className="w-5 h-5 rounded-full border border-stone-300 shadow-2xs"
                          style={{ backgroundColor: swatch.color }}
                          title={swatch.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Science Incline Plane */}
              {selectedElement.type === 'science_incline' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800">มุมพื้นเอียง:</span>
                    <span className="font-bold text-blue-600">{selectedElement.extraProps?.angle ?? 30}°</span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={65}
                    value={selectedElement.extraProps?.angle ?? 30}
                    onChange={(e) => updateSelectedExtraProp('angle', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div>
                    <label className="text-[10px] text-stone-500 block">ป้ายมวลบนวัตถุ</label>
                    <input
                      type="text"
                      value={selectedElement.extraProps?.massLabel || '2 kg'}
                      onChange={(e) => updateSelectedExtraProp('massLabel', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-stone-300 rounded"
                    />
                  </div>
                </div>
              )}

              {/* Science Magnet */}
              {selectedElement.type === 'science_magnet' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">สลับขั้วแม่เหล็ก (N-S)</span>
                  <button
                    type="button"
                    onClick={() => updateSelectedExtraProp('flipped', !selectedElement.extraProps?.flipped)}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-semibold hover:bg-stone-100"
                  >
                    สลับขั้ว N-S
                  </button>
                </div>
              )}

              {/* Venn Diagram Specifics */}
              {selectedElement.type === 'venn_2' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <span className="font-bold text-stone-800 block">ตั้งค่าเวนน์ 2 วง:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-500 block">ป้ายวงซ้าย</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.labelA ?? 'A'}
                        onChange={(e) => updateSelectedExtraProp('labelA', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">ป้ายวงขวา</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.labelB ?? 'B'}
                        onChange={(e) => updateSelectedExtraProp('labelB', e.target.value)}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <span className="font-bold text-stone-800 block pt-1">แรเงาส่วนเซต:</span>
                  <select
                    value={selectedElement.extraProps?.highlightRegion || 'none'}
                    onChange={(e) => updateSelectedExtraProp('highlightRegion', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded bg-white"
                  >
                    <option value="none">ไม่แรเงา (None)</option>
                    <option value="intersection">อินเตอร์เซกชัน (A ∩ B)</option>
                    <option value="union">ยูเนียน (A ∪ B)</option>
                    <option value="a_only">เฉพาะเซต A (A - B)</option>
                    <option value="b_only">เฉพาะเซต B (B - A)</option>
                  </select>
                </div>
              )}

              {selectedElement.type === 'venn_3' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <span className="font-bold text-stone-800 block">ป้ายชื่อเซตเวนน์ 3 วง:</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <label className="text-[10px] text-stone-500 block">วงที่ 1</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.labelA ?? 'A'}
                        onChange={(e) => updateSelectedExtraProp('labelA', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">วงที่ 2</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.labelB ?? 'B'}
                        onChange={(e) => updateSelectedExtraProp('labelB', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-500 block">วงที่ 3</label>
                      <input
                        type="text"
                        value={selectedElement.extraProps?.labelC ?? 'C'}
                        onChange={(e) => updateSelectedExtraProp('labelC', e.target.value)}
                        className="w-full px-1.5 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Speech Bubble Tail Direction */}
              {selectedElement.type === 'speech_bubble' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <span className="font-bold text-stone-800 block">ตำแหน่งหางบอลลูนคำพูด:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'bottom-left', label: 'ล่างซ้าย' },
                      { id: 'bottom-right', label: 'ล่างขวา' },
                      { id: 'top-left', label: 'บนซ้าย' },
                      { id: 'top-right', label: 'บนขวา' },
                    ].map(dir => (
                      <button
                        key={dir.id}
                        type="button"
                        onClick={() => updateSelectedExtraProp('tailDirection', dir.id)}
                        className={`p-1.5 rounded-lg text-[11px] font-medium border ${
                          (selectedElement.extraProps?.tailDirection || 'bottom-left') === dir.id
                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold'
                            : 'border-stone-200 bg-white text-stone-700'
                        }`}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline Point Count */}
              {selectedElement.type === 'timeline' && (
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">จำนวนจุดเหตุการณ์:</span>
                    <span className="font-bold text-blue-600">{selectedElement.extraProps?.pointCount ?? 4} จุด</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={selectedElement.extraProps?.pointCount ?? 4}
                    onChange={(e) => updateSelectedExtraProp('pointCount', parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              )}

              {/* Table Grid Controls */}
              {selectedElement.type === 'table_grid' && (
                <div className="p-2.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2 text-xs">
                  <span className="font-bold text-blue-900 block">ตั้งค่าตารางข้อมูล:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-stone-600 block">จำนวนแถว (Rows)</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={selectedElement.extraProps?.rows ?? 3}
                        onChange={(e) => updateSelectedExtraProp('rows', Math.max(1, Math.min(8, parseInt(e.target.value) || 3)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-600 block">จำนวนคอลัมน์ (Cols)</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={selectedElement.extraProps?.cols ?? 3}
                        onChange={(e) => updateSelectedExtraProp('cols', Math.max(1, Math.min(8, parseInt(e.target.value) || 3)))}
                        className="w-full px-2 py-1 border border-stone-300 rounded bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600">เน้นสีแถวหัวตาราง</span>
                    <input
                      type="checkbox"
                      checked={selectedElement.extraProps?.hasHeader !== false}
                      onChange={(e) => updateSelectedExtraProp('hasHeader', e.target.checked)}
                      className="accent-blue-600 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-stone-600 block mb-0.5">ข้อมูลในตาราง (คั่นคอลัมน์ด้วย , คั่นแถวด้วย |)</label>
                    <textarea
                      rows={3}
                      value={selectedElement.extraProps?.dataMatrix ?? ''}
                      onChange={(e) => updateSelectedExtraProp('dataMatrix', e.target.value)}
                      className="w-full px-2 py-1 border border-stone-300 rounded bg-white text-[11px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="px-6 py-3 bg-white border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 text-stone-600 hover:text-stone-900 disabled:opacity-30 rounded hover:bg-stone-100 flex items-center gap-1 border border-stone-200"
              title="ย้อนกลับ (Ctrl+Z)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ย้อนกลับ</span>
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 text-stone-600 hover:text-stone-900 disabled:opacity-30 rounded hover:bg-stone-100 flex items-center gap-1 border border-stone-200"
              title="ทำซ้ำ (Ctrl+Y)"
            >
              <RotateCw className="w-4 h-4" />
              <span>ทำซ้ำ</span>
            </button>

            <div className="h-4 w-px bg-stone-300 mx-1" />

            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span>{elements.length} ชิ้นส่วนบนผืนผ้าใบ</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleApplyToExam}
              className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>แทรกแผนภาพลงในข้อสอบ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
