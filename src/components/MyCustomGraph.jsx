import React, { useEffect, useRef, useState } from 'react';

import axios from 'axios';
import {
  popup,
  ModelXmlSerializer,
  domUtils,
  styleUtils,
  mathUtils,
  cloneUtils,
  eventUtils,
  Graph,
  InternalEvent,
  RubberBandHandler,
  ConnectionHandler,
  ConnectionConstraint,
  Point,
  CylinderShape,
  CellRenderer,
  DomHelpers,
  EdgeStyle,
  Rectangle,
  EdgeHandler,
  StyleRegistry,
  EdgeSegmentHandler,
  UndoManager,
  CellEditorHandler,
  ConstraintHandler,
  Guide,
  ImageBox,
  GraphView,
  SelectionHandler,
  PanningHandler,
  TooltipHandler,
  SelectionCellsHandler,
  PopupMenuHandler,
  xmlUtils,
  Codec,
} from '@maxgraph/core';

import {
  contextMenuTypes,
  contextMenuValues,
  globalTypes,
  globalValues,
  rubberBandTypes,
  rubberBandValues,
} from './shared/args.js';

import { createGraphContainer } from './shared/configure.js';

// style required by RubberBand
import '@maxgraph/core/css/common.css';

import { render } from 'react-dom';

  // TODO Убрать этот костыль
  let invert = false;
  let MyCustomCellEditorHandler;

  if (invert) {
    container.style.backgroundColor = 'black';

    // White in-place editor text color
    MyCustomCellEditorHandler = class extends CellEditorHandler {
      startEditing(cell, trigger) {
        super.startEditing.apply(this, arguments);

        if (this.textarea != null) {
          this.textarea.style.color = '#FFFFFF';
        }
      }
    };
  } else {
    MyCustomCellEditorHandler = CellEditorHandler;
  }
  // Wire-mode
  let checkbox = document.getElementById("wire");
  
  class MyCustomGraph extends Graph {
    resetEdgesOnConnect = false;
    createEdgeSegmentHandler(state) {
      return new MyCustomEdgeSegmentHandler(state);
    }

    createGraphView() {
      return new MyCustomGraphView(this);
    }

    createEdgeHandler(state) {
      return new MyCustomEdgeHandler(state);
    }

    createHandler(state) {
      let result = null;

      if (state != null) {
        if (state.cell.isEdge()) {
          let style = this.view.getEdgeStyle(state);

          if (style == EdgeStyle.WireConnector) {
            return new EdgeSegmentHandler(state);
          }
        }
      }

      return super.createHandler.apply(this, arguments);
    }

    // Adds oval markers for edge-to-edge connections.
    getCellStyle(cell) {
      let style = super.getCellStyle.apply(this, arguments);

      if (style != null && cell?.isEdge()) {
        style = cloneUtils.clone(style);

        if (cell.getTerminal(true)?.isEdge()) {
          style.startArrow = 'oval';
        }

        if (cell.getTerminal(false)?.isEdge()) {
          style.endArrow = 'oval';
        }
      }
      return style;
    }

    getTooltipForCell(cell) {
      let tip = '';

      if (cell != null) {
        let src = cell.getTerminal(true);
        if (src != null) {
          tip += this.getTooltipForCell(src) + ' ';
        }

        let parent = cell.getParent();
        if (parent.isVertex()) {
          tip += this.getTooltipForCell(parent) + '.';
        }

        tip += super.getTooltipForCell.apply(this, arguments);

        let trg = cell.getTerminal(false);
        if (trg != null) {
          tip += ' ' + this.getTooltipForCell(trg);
        }
      }
      return tip;
    }

    // Alternative solution for implementing connection points without child cells.
    // This can be extended as shown in portrefs.html example to allow for per-port
    // incoming/outgoing direction.
    getAllConnectionConstraints(terminal) {
      let geo = terminal != null ? terminal.cell.getGeometry() : null;

      if (
        (geo != null ? !geo.relative : false) &&
        terminal.cell.isVertex() &&
        terminal.cell.getChildCount() === 0
      ) {
        return [
          new ConnectionConstraint(new Point(0, 0.5), false),
          new ConnectionConstraint(new Point(1, 0.5), false),
        ];
      }
      return null;
    }
  }

  class MyCustomConstraintHandler extends ConstraintHandler {
    // Replaces the port image
    pointImage = new ImageBox('images/dot.gif', 10, 10);
  }

  class MyCustomGuide extends Guide {
    // Alt disables guides
    isEnabledForEvent(evt) {
      return !eventUtils.isAltDown(evt);
    }
  }

  class MyCustomEdgeHandler extends EdgeHandler {
    // Enables snapping waypoints to terminals
    snapToTerminals = true;

    isConnectableCell(cell) {
      return graph.getPlugin('ConnectionHandler').isConnectableCell(cell);
    }

    connect(edge, terminal, isSource, isClone, me) {
      let result = null;
      let model = this.graph.getDataModel();
      let parent = model.getParent(edge);

      model.beginUpdate();
      try {
        result = super.connect.apply(this, arguments);
        let geo = model.getGeometry(result);

        if (geo != null) {
          geo = geo.clone();
          let pt = null;
          if (terminal && terminal.isEdge) {
            if (terminal.isEdge()) {
              pt = this.abspoints[this.isSource ? 0 : this.abspoints.length - 1];
              pt.x = pt.x / this.graph.view.scale - this.graph.view.translate.x;
              pt.y = pt.y / this.graph.view.scale - this.graph.view.translate.y;

              let pstate = this.graph.getView().getState(edge.getParent());

              if (pstate != null) {
                pt.x -= pstate.origin.x;
                pt.y -= pstate.origin.y;
              }

              pt.x -= this.graph.panDx / this.graph.view.scale;
              pt.y -= this.graph.panDy / this.graph.view.scale;
            }
          }

          geo.setTerminalPoint(pt, isSource);
          model.setGeometry(edge, geo);
        }
      } finally {
        model.endUpdate();
      }

      return result;
    }

    createMarker() {
      let marker = super.createMarker.apply(this, arguments);
      // Adds in-place highlighting when reconnecting existing edges
      marker.highlight.highlight =
        this.graph.getPlugin('ConnectionHandler').marker.highlight.highlight;
      return marker;
    }
  }

  class MyCustomSelectionHandler extends SelectionHandler {

    previewColor = invert ? 'white' : 'black';
    // Enables guides
    guidesEnabled = true;

    createGuide() {
      return new MyCustomGuide(this.graph, this.getGuideStates());
    }
  }

  class MyCustomPanningHandler extends PanningHandler {
    // Panning handler consumed right click so this must be
    // disabled if right click should stop connection handler.
    isPopupTrigger() {
      return false;
    }
  }

  class MyCustomConnectionHandler extends ConnectionHandler {
    // If connect preview is not moved away then getCellAt is used to detect the cell under
    // the mouse if the mouse is over the preview shape in IE (no event transparency), ie.
    // the built-in hit-detection of the HTML document will not be used in this case.
    movePreviewAway = false;
    waypointsEnabled = true;

    // Starts connections on the background in wire-mode
    isStartEvent(me) {
      return checkbox.checked || super.isStartEvent.apply(this, arguments);
    }

    // Avoids any connections for gestures within tolerance except when in wire-mode
    // or when over a port
    mouseUp(sender, me) {
      if (this.first != null && this.previous != null) {
        let point = styleUtils.convertPoint(this.graph.container, me.getX(), me.getY());
        let dx = Math.abs(point.x - this.first.x);
        let dy = Math.abs(point.y - this.first.y);

        if (dx < this.graph.tolerance && dy < this.graph.tolerance) {
          // Selects edges in non-wire mode for single clicks, but starts
          // connecting for non-edges regardless of wire-mode
          if (!checkbox.checked && this.previous.cell.isEdge()) {
            this.reset();
          }
          return;
        }
      }
      super.mouseUp.apply(this, arguments);
    }

    // Overrides methods to preview and create new edges.

    // Sets source terminal point for edge-to-edge connections.
    createEdgeState(me) {
      let edge = this.graph.createEdge();

      if (this.sourceConstraint != null && this.previous != null) {
        edge.style =
          'exitX' +
          '=' +
          this.sourceConstraint.point.x +
          ';' +
          'exitY' +
          '=' +
          this.sourceConstraint.point.y +
          ';';
      } else if (me.getCell().isEdge()) {
        let scale = this.graph.view.scale;
        let tr = this.graph.view.translate;
        let pt = new Point(
          this.graph.snap(me.getGraphX() / scale) - tr.x,
          this.graph.snap(me.getGraphY() / scale) - tr.y
        );
        edge.geometry.setTerminalPoint(pt, true);
      }

      return this.graph.view.createState(edge);
    }

    // Uses right mouse button to create edges on background (see also: lines 67 ff)
    isStopEvent(me) {
      return me.getState() != null || eventUtils.isRightMouseButton(me.getEvent());
    }

    // Updates target terminal point for edge-to-edge connections.
    updateCurrentState(me, point) {
      super.updateCurrentState.apply(this, arguments);

      if (this.edgeState != null) {
        this.edgeState.cell.geometry.setTerminalPoint(null, false);

        if (
          this.shape != null &&
          this.currentState != null &&
          this.currentState.cell.isEdge()
        ) {
          let scale = this.graph.view.scale;
          let tr = this.graph.view.translate;
          let pt = new Point(
            this.graph.snap(me.getGraphX() / scale) - tr.x,
            this.graph.snap(me.getGraphY() / scale) - tr.y
          );
          this.edgeState.cell.geometry.setTerminalPoint(pt, false);
        }
      }
    }

    // Adds in-place highlighting for complete cell area (no hotspot).
    createMarker() {
      let marker = super.createMarker.apply(this, arguments);

      // Uses complete area of cell for new connections (no hotspot)
      marker.intersects = function (state, evt) {
        return true;
      };

      // Adds in-place highlighting
      //const mxCellHighlightHighlight = mxCellHighlight.prototype.highlight;
      marker.highlight.highlight = function (state) {
        // TODO: Should this be a subclass of marker rather than assigning directly?
        if (this.state != state) {
          if (this.state != null) {
            this.state.style = this.lastStyle;

            // Workaround for shape using current stroke width if no strokewidth defined
            this.state.style.strokeWidth = this.state.style.strokeWidth || '1';
            this.state.style.strokeColor = this.state.style.strokeColor || 'none';

            if (this.state.shape != null) {
              this.state.view.graph.cellRenderer.configureShape(this.state);
              this.state.shape.redraw();
            }
          }

          if (state != null) {
            this.lastStyle = state.style;
            state.style = cloneUtils.clone(state.style);
            state.style.strokeColor = '#00ff00';
            state.style.strokeWidth = '3';

            if (state.shape != null) {
              state.view.graph.cellRenderer.configureShape(state);
              state.shape.redraw();
            }
          }
          this.state = state;
        }
      };

      return marker;
    }

    // Makes sure non-relative cells can only be connected via constraints
    isConnectableCell(cell) {
      if (cell.isEdge()) {
        return true;
      } else {
        let geo = cell != null ? cell.getGeometry() : null;
        return geo != null ? geo.relative : false;
      }
    }
  }

  class MyCustomGraphView extends GraphView {
    // Computes the position of edge to edge connection points.
    updateFixedTerminalPoint(edge, terminal, source, constraint) {
      let pt = null;

      if (constraint != null) {
        pt = this.graph.getConnectionPoint(terminal, constraint);
      }

      if (source) {
        edge.sourceSegment = null;
      } else {
        edge.targetSegment = null;
      }

      if (pt == null) {
        let s = this.scale;
        let tr = this.translate;
        let orig = edge.origin;
        let geo = edge.cell.getGeometry();
        pt = geo.getTerminalPoint(source);

        // Computes edge-to-edge connection point
        if (pt != null) {
          pt = new Point(s * (tr.x + pt.x + orig.x), s * (tr.y + pt.y + orig.y));

          // Finds nearest segment on edge and computes intersection
          if (terminal != null && terminal.absolutePoints != null) {
            let seg = mathUtils.findNearestSegment(terminal, pt.x, pt.y);

            // Finds orientation of the segment
            let p0 = terminal.absolutePoints[seg];
            let pe = terminal.absolutePoints[seg + 1];
            let horizontal = p0.x - pe.x === 0;

            // Stores the segment in the edge state
            let key = source ? 'sourceConstraint' : 'targetConstraint';
            let value = horizontal ? 'horizontal' : 'vertical';
            edge.style[key] = value;

            // Keeps the coordinate within the segment bounds
            if (horizontal) {
              pt.x = p0.x;
              pt.y = Math.min(pt.y, Math.max(p0.y, pe.y));
              pt.y = Math.max(pt.y, Math.min(p0.y, pe.y));
            } else {
              pt.y = p0.y;
              pt.x = Math.min(pt.x, Math.max(p0.x, pe.x));
              pt.x = Math.max(pt.x, Math.min(p0.x, pe.x));
            }
          }
        }
        // Computes constraint connection points on vertices and ports
        else if (terminal != null && terminal.cell.geometry.relative) {
          pt = new Point(
            this.getRoutingCenterX(terminal),
            this.getRoutingCenterY(terminal)
          );
        }

        // Snaps point to grid
        /*if (pt != null)
        {
          let tr = this.graph.view.translate;
          let s = this.graph.view.scale;

          pt.x = (this.graph.snap(pt.x / s - tr.x) + tr.x) * s;
          pt.y = (this.graph.snap(pt.y / s - tr.y) + tr.y) * s;
        }*/
      }

      edge.setAbsoluteTerminalPoint(pt, source);
    }
  }

  class MyCustomEdgeSegmentHandler extends EdgeSegmentHandler {
    clonePreviewState(point, terminal) {
      let clone = super.clonePreviewState.apply(this, arguments);
      clone.cell = clone.cell.clone();

      if (this.isSource || this.isTarget) {
        clone.cell.geometry = clone.cell.geometry.clone();

        // Sets the terminal point of an edge if we're moving one of the endpoints
        if (clone.cell.isEdge()) {
          // TODO: Only set this if the target or source terminal is an edge
          clone.cell.geometry.setTerminalPoint(point, this.isSource);
        } else {
          clone.cell.geometry.setTerminalPoint(null, this.isSource);
        }
      }

      return clone;
    }
  }


export {
    MyCustomGraph, 
    MyCustomEdgeSegmentHandler, 
    MyCustomGraphView, 
    MyCustomConnectionHandler,  
    MyCustomPanningHandler, 
    MyCustomSelectionHandler,
    MyCustomEdgeHandler,
    MyCustomConstraintHandler
};