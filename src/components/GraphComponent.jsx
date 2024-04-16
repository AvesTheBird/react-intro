import React, { useEffect, useRef } from 'react';

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
import { useState } from 'react';
// style required by RubberBand
import '@maxgraph/core/css/common.css';
import { render } from 'react-dom';
import "./file-uploader.css";



export const YourComponent = ({ graph }) => {
  const graphContainerRef = useRef(null);
  let [variableFromEffect, setVariableFromEffect] = useState(null);
  graph = variableFromEffect;

  useEffect(() => {
    const graphContainer = graphContainerRef.current;

    const parentContainer = document.createElement('div');
    const container = createGraphContainer({
      imageUrl: 'images/grid.gif'
    });
    parentContainer.appendChild(container);

      // Changes some default colors
  // TODO Find a way of modifying globally or setting locally! See https://github.com/maxGraph/maxGraph/issues/192
  //constants.SHADOWCOLOR = '#C0C0C0';

  let joinNodeSize = 7;
  let strokeWidth = 2;

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

  // FIXME: Provide means to make EdgeHandler and ConnectionHandler instantiate this subclass!
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

  // Switch for black background and bright styles
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

  // Updates connection points before the routing is called.

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

  // Updates the terminal and control points in the cloned preview.
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

  // Imlements a custom resistor shape. Direction currently ignored here.

  class ResistorShape extends CylinderShape {
    constructor() {
      // TODO: The original didn't seem to call the super
      super(null, null, null, null);
    }

    redrawPath(path, x, y, w, h, isForeground) {
      let dx = w / 16;

      if (isForeground) {
        path.moveTo(0, h / 2);
        path.lineTo(2 * dx, h / 2);
        path.lineTo(3 * dx, 0);
        path.lineTo(5 * dx, h);
        path.lineTo(7 * dx, 0);
        path.lineTo(9 * dx, h);
        path.lineTo(11 * dx, 0);
        path.lineTo(13 * dx, h);
        path.lineTo(14 * dx, h / 2);
        path.lineTo(16 * dx, h / 2);
        path.end();
      }
    }
  }

  CellRenderer.registerShape('resistor', ResistorShape);

  // Imlements a custom resistor shape. Direction currently ignored here.

  EdgeStyle.WireConnector = function (state, source, target, hints, result) {
    // Creates array of all way- and terminalpoints
    let pts = state.absolutePoints;
    let horizontal = true;
    let hint = null;

    // Gets the initial connection from the source terminal or edge
    if (source != null && source.cell.isEdge()) {
      horizontal = state.style.sourceConstraint == 'horizontal';
    } else if (source != null) {
      horizontal = source.style.portConstraint != 'vertical';

      // Checks the direction of the shape and rotates
      let direction = source.style.direction;

      if (direction == 'north' || direction == 'south') {
        horizontal = !horizontal;
      }
    }

    // Adds the first point
    // TODO: Should move along connected segment
    let pt = pts[0];

    if (pt == null && source != null) {
      pt = new Point(
        state.view.getRoutingCenterX(source),
        state.view.getRoutingCenterY(source)
      );
    } else if (pt != null) {
      pt = pt.clone();
    }

    let first = pt;

    // Adds the waypoints
    if (hints != null && hints.length > 0) {
      // FIXME: First segment not movable
      /*hint = state.view.transformControlPoint(state, hints[0]);
      MaxLog.show();
      MaxLog.debug(hints.length,'hints0.y='+hint.y, pt.y)

      if (horizontal && Math.floor(hint.y) != Math.floor(pt.y))
      {
        MaxLog.show();
        MaxLog.debug('add waypoint');

        pt = new Point(pt.x, hint.y);
        result.push(pt);
        pt = pt.clone();
        //horizontal = !horizontal;
      }*/

      for (let i = 0; i < hints.length; i++) {
        horizontal = !horizontal;
        hint = state.view.transformControlPoint(state, hints[i]);

        if (horizontal) {
          if (pt.y !== hint.y) {
            pt.y = hint.y;
            result.push(pt.clone());
          }
        } else if (pt.x !== hint.x) {
          pt.x = hint.x;
          result.push(pt.clone());
        }
      }
    } else {
      hint = pt;
    }

    // Adds the last point
    pt = pts[pts.length - 1];

    // TODO: Should move along connected segment
    if (pt == null && target != null) {
      pt = new Point(
        state.view.getRoutingCenterX(target),
        state.view.getRoutingCenterY(target)
      );
    }

    if (horizontal) {
      if (pt.y !== hint.y && first.x !== pt.x) {
        result.push(new Point(pt.x, hint.y));
      }
    } else if (pt.x !== hint.x && first.y !== pt.y) {
      result.push(new Point(hint.x, pt.y));
    }
  };

  StyleRegistry.putValue('wireEdgeStyle', EdgeStyle.WireConnector);


    let graph = new MyCustomGraph(container, null, [
      MyCustomCellEditorHandler,
      TooltipHandler,
      SelectionCellsHandler,
      PopupMenuHandler,
      MyCustomConnectionHandler,
      MyCustomSelectionHandler,
      MyCustomPanningHandler,
    ]);
    setVariableFromEffect(graph);

    let labelBackground = invert ? '#000000' : '#FFFFFF';
  let fontColor = invert ? '#FFFFFF' : '#000000';
  let strokeColor = invert ? '#C0C0C0' : '#000000';
  let fillColor = invert ? 'none' : '#FFFFFF';

  graph.view.scale = 1;
  graph.setPanning(true);
  graph.setConnectable(true);
  graph.setConnectableEdges(true);
  graph.setDisconnectOnMove(false);
  graph.foldingEnabled = false;

  //Maximum size
  graph.maximumGraphBounds = new Rectangle(0, 0, 1000, 1000);
  graph.border = 50;
  graph.spacingLeft = 30;

  // Enables return key to stop editing (use shift-enter for newlines)
  graph.setEnterStopsCellEditing(true);

  // Adds rubberband selection
  new RubberBandHandler(graph);

  // Adds a special tooltip for edges
  graph.setTooltips(true);

  let style = graph.getStylesheet().getDefaultEdgeStyle();
  delete style.endArrow;
  style.strokeColor = strokeColor;
  style.labelBackgroundColor = labelBackground;
  style.edgeStyle = 'wireEdgeStyle';
  style.fontColor = fontColor;
  style.fontSize = '9';
  style.movable = '0';
  style.strokeWidth = strokeWidth;
  //style.rounded = '1';

  // Sets join node size
  style.startSize = joinNodeSize;
  style.endSize = joinNodeSize;

  style = graph.getStylesheet().getDefaultVertexStyle();
  style.gradientDirection = 'south';
  //style.gradientColor = '#909090';
  style.strokeColor = strokeColor;
  //style.fillColor = '#e0e0e0';
  style.fillColor = 'none';
  style.fontColor = fontColor;
  style.fontStyle = '1';
  style.fontSize = '12';
  style.resizable = '0';
  style.rounded = '1';
  style.strokeWidth = strokeWidth;

  // инородное дерьмо
  const buttons = document.querySelectorAll('.bth');
  const update = (event) => {
    var parent = graph.getDefaultParent();
    var doc = xmlUtils.createXmlDocument();
    graph.batchUpdate(() => {
      if ((event.target.textContent) == 'not x') {
        //прямоугольник
        var v1 = graph.insertVertex(parent, null, '', 80, 40, 40, 80,
          'verticalLabelPosition=top;verticalAlign=bottom;shadow=1;fillColor=' + fillColor);
        v1.setConnectable(false);


        //выходы прямоугольника
        var v11 = graph.insertVertex(v1, null, 'X', 0, 0, 10, 16, {
          shape: 'line',
          align: 'left',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: -0.5,
          spacingLeft: 12,
          fontColor,
          strokeColor,
        });
        v11.geometry.relative = true;
        v11.geometry.offset = new Point(-v11.geometry.width, 12);
        var v12 = v11.clone();
        v12.value = 'Y';
        v12.geometry.offset = new Point(-v11.geometry.width, 52);
        v1.insert(v12);
        var v15 = v11.clone();
        v15.value = '';
        v15.geometry.x = 1;
        v15.style = {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingRight: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
         
        v15.geometry.offset = new Point(5, 32);
        v1.insert(v15);


        var v16 = graph.insertVertex(v1, null, '○', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 30,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v16.geometry.x = 1;
        v16.geometry.offset = new Point(49, 34);
        v1.insert(v16);
      }
      if ((event.target.textContent) == 'x * y') {
        //прямоугольник
        var v1 = graph.insertVertex(parent, null, '', 180, 40, 40, 80,
        {
          verticalLabelPosition: 'top',
          verticalAlign: 'bottom',
          shadow: 1,
          fillColor: fillColor
        }
        );
        v1.setConnectable(false);

        //выходы прямоугольника
        var v11 = graph.insertVertex(v1, null, 'X', 0, 0, 10, 16,
        {
          shape: 'line',
          align: 'left',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: -0.5,
          spacingLeft: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v11.geometry.relative = true;
        v11.geometry.offset = new Point(-v11.geometry.width, 12);
        var v12 = v11.clone();
        v12.value = 'Y';
        v12.geometry.offset = new Point(-v11.geometry.width, 52);
        v1.insert(v12);
        var v15 = v11.clone();
        v15.value = '';
        v15.geometry.x = 1;
        v15.style = {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingRight: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        ;
        v15.geometry.offset = new Point(0, 32);
        v1.insert(v15);


        var v16 = graph.insertVertex(v1, null, '&', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 20,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v16.geometry.x = 1;
        v16.geometry.offset = new Point(28.5, 37);
        v1.insert(v16);
      }
      if ((event.target.textContent) == 'x + y') {
        //прямоугольник
        var v1 = graph.insertVertex(parent, null, '', 250, 40, 40, 80,
        {
          verticalLabelPosition: 'top',
          verticalAlign: 'bottom',
          shadow: 1,
          fillColor: fillColor
        }
        );
        v1.setConnectable(false);

        //выходы прямоугольника
        var v11 = graph.insertVertex(v1, null, 'X', 0, 0, 10, 16,
        {
          shape: 'line',
          align: 'left',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: -0.5,
          spacingLeft: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v11.geometry.relative = true;
        v11.geometry.offset = new Point(-v11.geometry.width, 12);
        var v12 = v11.clone();
        v12.value = 'Y';
        v12.geometry.offset = new Point(-v11.geometry.width, 52);
        v1.insert(v12);
        var v15 = v11.clone();
        v15.value = '';
        v15.geometry.x = 1;
        v15.style = {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingRight: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        ;
        v15.geometry.offset = new Point(0, 32);
        v1.insert(v15);

        var v16 = graph.insertVertex(v1, null, '|', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 20,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v16.geometry.x = 1;
        v16.geometry.offset = new Point(24, 37);
        v1.insert(v16);
      }
      if ((event.target.textContent) == 'x == y') {
        //прямоугольник
        var v1 = graph.insertVertex(parent, null, '', 180, 140, 40, 80,
        {
          verticalLabelPosition: 'top',
          verticalAlign: 'bottom',
          shadow: 1,
          fillColor: fillColor
        }
        );
        v1.setConnectable(false);

        //выходы прямоугольника
        var v11 = graph.insertVertex(v1, null, 'X', 0, 0, 10, 16,
        {
          shape: 'line',
          align: 'left',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: -0.5,
          spacingLeft: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v11.geometry.relative = true;
        v11.geometry.offset = new Point(-v11.geometry.width, 12);
        var v12 = v11.clone();
        v12.value = 'Y';
        v12.geometry.offset = new Point(-v11.geometry.width, 52);
        v1.insert(v12);
        var v15 = v11.clone();
        v15.value = '';
        v15.geometry.x = 1;
        v15.style = {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingRight: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        ;
        v15.geometry.offset = new Point(0, 32);
        v1.insert(v15);

        var v16 = graph.insertVertex(v1, null, '==', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 15,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v16.geometry.x = 1;
        v16.geometry.offset = new Point(30, 38);
        v1.insert(v16);
      }
      if ((event.target.textContent) == 'x => y') {
        //прямоугольник
        var v1 = graph.insertVertex(parent, null, '', 80, 140, 40, 80,
        {
          verticalLabelPosition: 'top',
          verticalAlign: 'bottom',
          shadow: 1,
          fillColor: fillColor
        }
        );
        v1.setConnectable(false);

        //выходы прямоугольника
        var v11 = graph.insertVertex(v1, null, '', 0, 0, 14, 16,
        {
          shape: 'line',
          align: 'left',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: -0.5,
          spacingLeft: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v11.geometry.relative = true;
        v11.geometry.offset = new Point(-v11.geometry.width, 12);
        var v12 = v11.clone();
        v12.value = '';
        v12.geometry.offset = new Point(-v11.geometry.width, 52);
        v1.insert(v12);
        var v15 = v11.clone();
        v15.value = '';
        v15.geometry.x = 1;
        v15.style = {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingRight: 12,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        ;
        v15.geometry.offset = new Point(0, 32);
        v1.insert(v15);

        var v16 = graph.insertVertex(v1, null, '○', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 25,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v16.geometry.x = 1;
        v16.geometry.offset = new Point(8, 15);
        v1.insert(v16);
        var v17 = graph.insertVertex(v1, null, 'X', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v17.geometry.x = 1;
        v17.geometry.offset = new Point(14, 20);
        v1.insert(v17);
        var v18 = graph.insertVertex(v1, null, 'Y', 0, 0, 0, 0,
        {
          shape: 'line',
          align: 'right',
          verticalAlign: 'middle',
          fontSize: 10,
          routingCenterX: 0.5,
          spacingLeft: 6,
          fontColor: fontColor,
          strokeColor: strokeColor
        }
        );
        v18.geometry.x = 1;
        v18.geometry.offset = new Point(14, 59);
        v1.insert(v18);
      }
    })
  }

  buttons.forEach((button) => {
    button.addEventListener('click', update);
  });

  ////////////////////////////////////////////////////////
// XML 

document.getElementById("xml").onclick = () => {
  // Получаем XML данные
  const xml = new ModelXmlSerializer(graph.getDataModel()).export();
  
  // Создаем новый Blob объект с XML данными
  const blob = new Blob([xml], { type: 'text/xml' });
  
  // Создаем ссылку на Blob объект
  const url = window.URL.createObjectURL(blob);
  
  // Создаем ссылку для скачивания
  const a = document.createElement('a');
  a.href = url;
  a.download = 'data.xml'; // Имя файла для скачивания
  document.body.appendChild(a);
  
  // Инициируем скачивание файла
  a.click();
  
  // Освобождаем ресурсы
  window.URL.revokeObjectURL(url);
};






document.getElementById("import").onclick = () => {
}




///////////////////////////////////////////////////////////


    document.getElementById("zoom").onclick = () => graph.zoomIn();
    document.getElementById("zoomout").onclick = () => graph.zoomOut();

      // Undo/redo
  let undoManager = new UndoManager();
  let listener = function (sender, evt) {
    undoManager.undoableEditHappened(evt.getProperty('edit'));
  };
  graph.getDataModel().addListener(InternalEvent.UNDO, listener);
  graph.getView().addListener(InternalEvent.UNDO, listener);

  document.getElementById("undo").onclick = () => undoManager.undo();
  document.getElementById("redo").onclick = () => undoManager.redo();


  document.getElementById("delete").onclick = () => graph.removeCells();

  // Wire-mode
  let checkbox = document.getElementById("wire");

  // Grid
  let checkbox2 = document.getElementById("grid");
  checkbox2.setAttribute('checked', 'true');


  InternalEvent.addListener(checkbox2, 'click', function (evt) {
    if (checkbox2.checked) {
      container.style.background = 'url(./images/grid.gif)';
    } else {
      container.style.background = '';
    }
    container.style.backgroundColor = invert ? 'black' : 'white';
  });
  InternalEvent.disableContextMenu(container);


    graphContainer.appendChild(parentContainer);

    return () => {
      // Clean up if needed
    }; 
  }, []);
 
    console.log(graph);
    
  return <div ref={graphContainerRef} style={{ width: '100%', height: '100%'}} />;
  
};


export const FileUploader = ({ graph2 }) => {

  const [xmlContent, setXmlContent] = useState(null);
  console.log({graph2});

  const handleOnChange = (event) => {
    event.preventDefault();
    if (event.target.files && event.target.files.length) {
      const file = event.target.files[0];
      if (file.name.endsWith('.xml')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            setXmlContent(content);
            let graph = {graph2};
            // Используем переданный graph здесь
            if (graph) {
              new ModelXmlSerializer(graph.getDataModel()).import(content);
              console.log("XML файл загружен и импортирован в модель данных графа.");
            } else {
              console.error("ОШИБКА СТОП");
              console.log({graph2});
            }
          };
        reader.readAsText(file);
      } else {
        console.log("Пожалуйста, выберите файл с расширением .xml");
      }
    }
  };

  return (
    <form className="file-uploader">
      <label htmlFor="file-loader-button" className="file-uploader__custom-button">
        {/* Ваш код для кастомной кнопки */}
      </label>
      <input
        id="file-loader-button"
        type="file"
        accept=".xml"
        className="file-uploader__upload-button"
        onChange={handleOnChange}
        style={{ display: 'none' }}
      />
      {xmlContent && (
        <div className="file-uploader__xml-content">
          {/* Ваш код для отображения содержимого XML */}
        </div>
      )}
    </form>
  );
};


