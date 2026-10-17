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
  | 'dimension_line'
  | 'angle_arc'
  | 'protractor'
  | 'axes_xy'
  | 'number_line'
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

  // Canvas Settings
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [autoCrop, setAutoCrop] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(1);

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
        base.extraProps = { showGrid: false, showArrows: true, xLabel: 'X', yLabel: 'Y', originLabel: 'O', ...customProps.extraProps };
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
    }

    saveToHistory(preset);
    setSelectedId(null);
    toast.success('โหลดเทมเพลตมาตรฐานเรียบร้อยแล้ว');
  };

  // Selected Element
  const selectedElement = useMemo(() => {
    return elements.find(el => el.id === selectedId) || null;
  }, [elements, selectedId]);

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
    const clone: CanvasElement = {
      ...selectedElement,
      id: `el-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      x: selectedElement.x + 20,
      y: selectedElement.y + 20
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

  // Alignment Tools (Word / Canva style)
  const handleAlign = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!selectedElement) return;
    let newX = selectedElement.x;
    let newY = selectedElement.y;

    if (type === 'left') newX = 20;
    else if (type === 'center') newX = Math.round((CANVAS_WIDTH - selectedElement.width) / 2);
    else if (type === 'right') newX = CANVAS_WIDTH - selectedElement.width - 20;
    else if (type === 'top') newY = 20;
    else if (type === 'middle') newY = Math.round((CANVAS_HEIGHT - selectedElement.height) / 2);
    else if (type === 'bottom') newY = CANVAS_HEIGHT - selectedElement.height - 20;

    updateSelectedField('x', newX, false);
    updateSelectedField('y', newY, true);
  };

  // Quick Rotate shortcuts (-90, +90, -15, +15)
  const handleRotateDelta = (deltaDeg: number) => {
    if (!selectedElement) return;
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

  // Mouse Handlers for Dragging, Resizing, and Rotating
  const handleMouseDown = (e: React.MouseEvent, handle: string, elId?: string) => {
    e.stopPropagation();
    if (elId) {
      setSelectedId(elId);
    }
    const targetEl = elementsRef.current.find(el => el.id === (elId || selectedId));
    if (!targetEl) return;

    setIsDragging(true);
    setDragHandle(handle);
    setDragStartScreen({ x: e.clientX, y: e.clientY });
    setElementStart({ ...targetEl });
    dragMovedRef.current = false;
  };

  // Global mousemove and mouseup listeners with Invariant Affine Math for Rotated Elements
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

      setElements(prev => prev.map(el => {
        if (el.id !== selectedId) return el;

        if (dragHandle === 'move') {
          let nextX = Math.round(elementStart.x + rawDx);
          let nextY = Math.round(elementStart.y + rawDy);

          if (snapToGrid) {
            nextX = Math.round(nextX / gridSize) * gridSize;
            nextY = Math.round(nextY / gridSize) * gridSize;
          }

          return { ...el, x: nextX, y: nextY };
        }

        if (dragHandle === 'rotate') {
          const centerX = elementStart.x + elementStart.width / 2;
          const centerY = elementStart.y + elementStart.height / 2;
          const currentCanvasPos = getCanvasCoords(e.clientX, e.clientY);
          const rad = Math.atan2(currentCanvasPos.y - centerY, currentCanvasPos.x - centerX);
          let deg = Math.round(rad * (180 / Math.PI)) + 90;
          if (deg < 0) deg += 360;
          if (deg >= 360) deg -= 360;

          // Shift key locks to 15 degree increments
          if (e.shiftKey) {
            deg = Math.round(deg / 15) * 15;
          }

          return { ...el, rotation: deg };
        }

        // Affine Transform Math for Corner Handles (se, sw, ne, nw) with Rotated Elements:
        // Keeps the stationary opposite anchor corner invariant in world coordinates!
        const rotRad = ((elementStart.rotation || 0) * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);

        // Project world delta into local element coordinates
        const localDx = rawDx * Math.cos(-rotRad) - rawDy * Math.sin(-rotRad);
        const localDy = rawDx * Math.sin(-rotRad) + rawDy * Math.cos(-rotRad);

        let anchorLocalStart = { x: 0, y: 0 };
        let newW = elementStart.width;
        let newH = elementStart.height;

        if (dragHandle === 'se') {
          anchorLocalStart = { x: -elementStart.width / 2, y: -elementStart.height / 2 }; // NW is invariant
          newW = Math.max(20, Math.round(elementStart.width + localDx));
          newH = Math.max(20, Math.round(elementStart.height + localDy));
        } else if (dragHandle === 'sw') {
          anchorLocalStart = { x: elementStart.width / 2, y: -elementStart.height / 2 }; // NE is invariant
          newW = Math.max(20, Math.round(elementStart.width - localDx));
          newH = Math.max(20, Math.round(elementStart.height + localDy));
        } else if (dragHandle === 'ne') {
          anchorLocalStart = { x: -elementStart.width / 2, y: elementStart.height / 2 }; // SW is invariant
          newW = Math.max(20, Math.round(elementStart.width + localDx));
          newH = Math.max(20, Math.round(elementStart.height - localDy));
        } else if (dragHandle === 'nw') {
          anchorLocalStart = { x: elementStart.width / 2, y: elementStart.height / 2 }; // SE is invariant
          newW = Math.max(20, Math.round(elementStart.width - localDx));
          newH = Math.max(20, Math.round(elementStart.height - localDy));
        }

        // Stationary world anchor point before resize
        const startCenterX = elementStart.x + elementStart.width / 2;
        const startCenterY = elementStart.y + elementStart.height / 2;
        const anchorWorldX = startCenterX + anchorLocalStart.x * cosRot - anchorLocalStart.y * sinRot;
        const anchorWorldY = startCenterY + anchorLocalStart.x * sinRot + anchorLocalStart.y * cosRot;

        // Position of the same anchor in the new local box
        let newAnchorLocal = { x: 0, y: 0 };
        if (dragHandle === 'se') newAnchorLocal = { x: -newW / 2, y: -newH / 2 };
        else if (dragHandle === 'sw') newAnchorLocal = { x: newW / 2, y: -newH / 2 };
        else if (dragHandle === 'ne') newAnchorLocal = { x: -newW / 2, y: newH / 2 };
        else if (dragHandle === 'nw') newAnchorLocal = { x: newW / 2, y: newH / 2 };

        // Recompute world center and top-left so the anchor remains invariant
        const newCenterX = anchorWorldX - (newAnchorLocal.x * cosRot - newAnchorLocal.y * sinRot);
        const newCenterY = anchorWorldY - (newAnchorLocal.x * sinRot + newAnchorLocal.y * cosRot);

        const newX = Math.round(newCenterX - newW / 2);
        const newY = Math.round(newCenterY - newH / 2);

        return {
          ...el,
          x: newX,
          y: newY,
          width: newW,
          height: newH
        };
      }));
    };

    const onGlobalMouseUp = () => {
      setIsDragging(false);
      setDragHandle(null);
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
  }, [isDragging, dragHandle, dragStartScreen, elementStart, selectedId, snapToGrid, gridSize, getCanvasCoords, saveToHistory]);

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
        return <line x1={el.x} y1={cy} x2={el.x + el.width} y2={cy} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeDasharray={dash} />;

      case 'arrow':
        return (
          <g>
            <line x1={el.x} y1={cy} x2={el.x + el.width - 8} y2={cy} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeDasharray={dash} />
            <polygon points={`${el.x + el.width - 10},${cy - 5} ${el.x + el.width},${cy} ${el.x + el.width - 10},${cy + 5}`} fill={el.stroke} />
          </g>
        );

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
        const d = `M ${cx - neckW / 2} ${el.y} L ${cx - neckW / 2} ${el.y + neckH} L ${el.x} ${el.y + el.height} L ${el.x + el.width} ${el.y + el.height} L ${cx + neckW / 2} ${el.y + neckH} L ${cx + neckW / 2} ${el.y} Z`;
        return <path d={d} fill={el.fill} stroke={el.stroke} strokeWidth={2} strokeLinejoin="round" />;
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
        return (
          <g>
            <circle cx={cx - r * 0.5} cy={cy - r * 0.3} r={r} fill="none" stroke="#2563eb" strokeWidth={1.8} />
            <circle cx={cx + r * 0.5} cy={cy - r * 0.3} r={r} fill="none" stroke="#dc2626" strokeWidth={1.8} />
            <circle cx={cx} cy={cy + r * 0.5} r={r} fill="none" stroke="#16a34a" strokeWidth={1.8} />
            <text x={cx - r} y={cy - r * 0.6} fontSize={13} fontWeight="bold" fill="#2563eb" fontFamily="sans-serif">A</text>
            <text x={cx + r * 0.8} y={cy - r * 0.6} fontSize={13} fontWeight="bold" fill="#dc2626" fontFamily="sans-serif">B</text>
            <text x={cx} y={cy + r * 1.1} fontSize={13} fontWeight="bold" fill="#16a34a" textAnchor="middle" fontFamily="sans-serif">C</text>
          </g>
        );
      }

      case 'flowchart_terminator':
        return (
          <g>
            <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={el.height / 2} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} />
            {el.text && (
              <text x={cx} y={cy + 5} fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
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
              <text x={cx} y={cy + 5} fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
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
              <text x={cx} y={cy + 4} fontSize={el.fontSize || 12} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
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
              <text x={cx} y={cy + 5} fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
                {el.text}
              </text>
            )}
          </g>
        );
      }

      case 'speech_bubble': {
        const tailW = 16;
        const tailH = 18;
        const r = 12;
        const d = `M ${el.x + r} ${el.y} L ${el.x + el.width - r} ${el.y} A ${r} ${r} 0 0 1 ${el.x + el.width} ${el.y + r} L ${el.x + el.width} ${el.y + el.height - tailH - r} A ${r} ${r} 0 0 1 ${el.x + el.width - r} ${el.y + el.height - tailH} L ${el.x + 36} ${el.y + el.height - tailH} L ${el.x + 14} ${el.y + el.height} L ${el.x + 22} ${el.y + el.height - tailH} L ${el.x + r} ${el.y + el.height - tailH} A ${r} ${r} 0 0 1 ${el.x} ${el.y + el.height - tailH - r} L ${el.x} ${el.y + r} A ${r} ${r} 0 0 1 ${el.x + r} ${el.y} Z`;
        return (
          <g>
            <path d={d} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeLinejoin="round" />
            {el.text && (
              <text x={cx} y={el.y + (el.height - tailH) * 0.58} fontSize={el.fontSize || 13} fontWeight="bold" fill="#0f172a" textAnchor="middle" fontFamily={el.fontFamily || 'sans-serif'}>
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
            y={el.y + el.height * 0.72} 
            fontSize={el.fontSize || 14} 
            fontWeight={el.fontWeight || 'bold'} 
            fill={el.stroke || '#0f172a'} 
            fontFamily={el.fontFamily || 'sans-serif'}
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
        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>`;

      case 'arrow':
        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width - 8}" y2="${cy}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" ${dash}/>
<polygon points="${el.x + el.width - 10},${cy - 5} ${el.x + el.width},${cy} ${el.x + el.width - 10},${cy + 5}" fill="${el.stroke}"/>`;

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

        const arrowX = showArrows ? `<polygon points="${el.x + el.width - 6},${cy - 4} ${el.x + el.width},${cy} ${el.x + el.width - 6},${cy + 4}" fill="#334155"/>` : '';
        const arrowY = showArrows ? `<polygon points="${cx - 4},${el.y + 6} ${cx},${el.y} ${cx + 4},${el.y + 6}" fill="#334155"/>` : '';

        return `<line x1="${el.x}" y1="${cy}" x2="${el.x + el.width}" y2="${cy}" stroke="#334155" stroke-width="2"/>
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
        const d = `M ${cx - neckW / 2} ${el.y} L ${cx - neckW / 2} ${el.y + neckH} L ${el.x} ${el.y + el.height} L ${el.x + el.width} ${el.y + el.height} L ${cx + neckW / 2} ${el.y + neckH} L ${cx + neckW / 2} ${el.y} Z`;
        return `<path d="${d}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="2" stroke-linejoin="round"/>`;
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
        return `<circle cx="${cx - r * 0.5}" cy="${cy - r * 0.3}" r="${r}" fill="none" stroke="#2563eb" stroke-width="1.8"/>
<circle cx="${cx + r * 0.5}" cy="${cy - r * 0.3}" r="${r}" fill="none" stroke="#dc2626" stroke-width="1.8"/>
<circle cx="${cx}" cy="${cy + r * 0.5}" r="${r}" fill="none" stroke="#16a34a" stroke-width="1.8"/>
<text x="${cx - r}" y="${cy - r * 0.6}" font-size="13" font-weight="bold" fill="#2563eb" font-family="sans-serif">A</text>
<text x="${cx + r * 0.8}" y="${cy - r * 0.6}" font-size="13" font-weight="bold" fill="#dc2626" font-family="sans-serif">B</text>
<text x="${cx}" y="${cy + r * 1.1}" font-size="13" font-weight="bold" fill="#16a34a" text-anchor="middle" font-family="sans-serif">C</text>`;
      }

      case 'flowchart_terminator':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" rx="${el.height / 2}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy + 5}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;

      case 'flowchart_process':
        return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy + 5}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;

      case 'flowchart_decision': {
        const pts = `${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy + 4}" font-size="${el.fontSize || 12}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
      }

      case 'flowchart_data': {
        const offset = el.width * 0.2;
        const pts = `${el.x + offset},${el.y} ${el.x + el.width},${el.y} ${el.x + el.width - offset},${el.y + el.height} ${el.x},${el.y + el.height}`;
        return `<polygon points="${pts}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}"/>
${safeText ? `<text x="${cx}" y="${cy + 5}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
      }

      case 'speech_bubble': {
        const tailW = 16;
        const tailH = 18;
        const r = 12;
        const d = `M ${el.x + r} ${el.y} L ${el.x + el.width - r} ${el.y} A ${r} ${r} 0 0 1 ${el.x + el.width} ${el.y + r} L ${el.x + el.width} ${el.y + el.height - tailH - r} A ${r} ${r} 0 0 1 ${el.x + el.width - r} ${el.y + el.height - tailH} L ${el.x + 36} ${el.y + el.height - tailH} L ${el.x + 14} ${el.y + el.height} L ${el.x + 22} ${el.y + el.height - tailH} L ${el.x + r} ${el.y + el.height - tailH} A ${r} ${r} 0 0 1 ${el.x} ${el.y + el.height - tailH - r} L ${el.x} ${el.y + r} A ${r} ${r} 0 0 1 ${el.x + r} ${el.y} Z`;
        return `<path d="${d}" fill="${el.fill}" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" stroke-linejoin="round"/>
${safeText ? `<text x="${cx}" y="${el.y + (el.height - tailH) * 0.58}" font-size="${el.fontSize || 13}" font-weight="bold" fill="#0f172a" text-anchor="middle" font-family="${el.fontFamily || 'sans-serif'}">${safeText}</text>` : ''}`;
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

      case 'text_label':
      case 'math_label': {
        const anchor = el.textAlign === 'center' ? 'middle' : el.textAlign === 'right' ? 'end' : 'start';
        const tx = el.textAlign === 'center' ? cx : el.textAlign === 'right' ? el.x + el.width - 4 : el.x + 4;
        return `<text x="${tx}" y="${el.y + el.height * 0.72}" font-size="${el.fontSize || 14}" font-weight="${el.fontWeight || 'bold'}" fill="${el.stroke || '#0f172a'}" font-family="${el.fontFamily || 'sans-serif'}" text-anchor="${anchor}">${safeText}</text>`;
      }

      case 'image_overlay':
        return `<image href="${el.imageUrl}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" preserveAspectRatio="xMidYMid meet"/>`;

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
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">การวัด & เครื่องมือคณิต</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { type: 'line', label: 'เส้นตรง', icon: <Minus className="w-3.5 h-3.5 text-stone-700" /> },
                      { type: 'arrow', label: 'ลูกศรชี้', icon: <ArrowRight className="w-3.5 h-3.5 text-blue-600" /> },
                      { type: 'dimension_line', label: 'เส้นบอกขนาด', icon: <Minus className="w-3.5 h-3.5 text-emerald-600" /> },
                      { type: 'angle_arc', label: 'มุม & ส่วนโค้ง', icon: <Compass className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'protractor', label: 'ไม้โปรแทรกเตอร์', icon: <Compass className="w-3.5 h-3.5 text-sky-600" /> },
                      { type: 'axes_xy', label: 'แกนพิกัดฉาก X-Y', icon: <Grid3X3 className="w-3.5 h-3.5 text-cyan-600" /> },
                      { type: 'number_line', label: 'เส้นจำนวน', icon: <Minus className="w-3.5 h-3.5 text-amber-600" /> },
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
                      { type: 'science_incline', label: 'พื้นเอียง & มวล', icon: <Triangle className="w-3.5 h-3.5 text-amber-700" /> },
                      { type: 'science_magnet', label: 'แม่เหล็กแท่ง N-S', icon: <Magnet className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'science_pulley', label: 'รอกเดี่ยว & ตุ้มน้ำหนัก', icon: <Circle className="w-3.5 h-3.5 text-stone-600" /> },
                      { type: 'science_lever', label: 'คานดีดคานงัด', icon: <Minus className="w-3.5 h-3.5 text-orange-600" /> },
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
                      { type: 'speech_bubble', label: 'กล่องบทสนทนา', icon: <MessageSquare className="w-3.5 h-3.5 text-teal-600" /> },
                      { type: 'venn_2', label: 'เวนน์ 2 วง', icon: <Layers className="w-3.5 h-3.5 text-rose-600" /> },
                      { type: 'venn_3', label: 'เวนน์ 3 วง', icon: <Layers className="w-3.5 h-3.5 text-purple-600" /> },
                      { type: 'compass_rose', label: 'เข็มทิศ 4 ทิศ', icon: <Compass className="w-3.5 h-3.5 text-red-600" /> },
                      { type: 'timeline', label: 'เส้นเวลา (Timeline)', icon: <Clock className="w-3.5 h-3.5 text-stone-700" /> },
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
            className="flex-1 bg-stone-200/80 p-4 md:p-6 flex flex-col items-center justify-center overflow-auto select-none relative"
            onClick={() => setSelectedId(null)}
          >
            {/* Canvas Viewport Toolbar (Zoom, Snap, Grid) */}
            <div 
              className="absolute top-3 left-4 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-stone-300 shadow-sm text-xs z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.25))}
                className="p-1 hover:bg-stone-100 rounded text-stone-600"
                title="ย่อมุมมอง"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-stone-700 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom(prev => Math.min(1.5, prev + 0.25))}
                className="p-1 hover:bg-stone-100 rounded text-stone-600"
                title="ขยายมุมมอง"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-1.5 py-0.5 hover:bg-stone-100 rounded text-[10px] font-semibold text-stone-600 ml-1"
                title="รีเซ็ตขนาด 100%"
              >
                100%
              </button>
              <div className="w-px h-3.5 bg-stone-200 mx-1" />
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1 rounded ${showGrid ? 'bg-blue-100 text-blue-700' : 'text-stone-600 hover:bg-stone-100'}`}
                title="แสดงตาราง Grid"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${snapToGrid ? 'bg-blue-600 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
                title="ดูดติดตาราง (Snap to Grid)"
              >
                Snap
              </button>
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
              {/* Subtle Grid Background */}
              {showGrid && (
                <div 
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                    backgroundSize: `${gridSize}px ${gridSize}px`
                  }}
                />
              )}

              {/* Main Interactive SVG */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                className="w-full h-full cursor-default"
              >
                {elements.map(el => {
                  const isSelected = el.id === selectedId;
                  const cx = el.x + el.width / 2;
                  const cy = el.y + el.height / 2;
                  const transform = getTransformString(el);

                  return (
                    <g 
                      key={el.id} 
                      transform={transform}
                      className="cursor-pointer group"
                      onMouseDown={(e) => handleMouseDown(e, 'move', el.id)}
                    >
                      {/* Render Element */}
                      {renderSvgElement(el)}

                      {/* Selection Bounding Box & Drag Handles */}
                      {isSelected && (
                        <g className="selection-box">
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
                        </g>
                      )}
                    </g>
                  );
                })}
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
                <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <span className="text-xs font-bold text-stone-800 block">แรเงาส่วนเซต:</span>
                  <select
                    value={selectedElement.extraProps?.highlightRegion || 'none'}
                    onChange={(e) => updateSelectedExtraProp('highlightRegion', e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-stone-300 rounded"
                  >
                    <option value="none">ไม่แรเงา (None)</option>
                    <option value="intersection">อินเตอร์เซกชัน (A ∩ B)</option>
                    <option value="union">ยูเนียน (A ∪ B)</option>
                    <option value="a_only">เฉพาะเซต A (A - B)</option>
                    <option value="b_only">เฉพาะเซต B (B - A)</option>
                  </select>
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
