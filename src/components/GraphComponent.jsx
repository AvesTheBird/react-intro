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

import {
  MyCustomGraph,
  MyCustomEdgeSegmentHandler,
  MyCustomGraphView,
  MyCustomConnectionHandler,
  MyCustomPanningHandler,
  MyCustomSelectionHandler,
  MyCustomEdgeHandler,
  MyCustomConstraintHandler
} from './MyCustomGraph.jsx';


export const YourComponent = ({ dataGraph }) => {

  const graphContainerRef = useRef(null);
  let [variableFromEffect, setVariableFromEffect] = useState(null);
  let graph = variableFromEffect;

  useEffect(() => {
    const graphContainer = graphContainerRef.current;

    const parentContainer = document.createElement('div');
    const container = createGraphContainer({
      imageUrl: 'images/grid.gif'
    });
    parentContainer.appendChild(container);
    //console.log({graph})
    // Changes some default colors
    // TODO Find a way of modifying globally or setting locally! See https://github.com/maxGraph/maxGraph/issues/192
    //constants.SHADOWCOLOR = '#C0C0C0';

    let joinNodeSize = 7;
    let strokeWidth = 2;

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

    // инородное дерьмо (работает хотябы)
    const buttons = document.querySelectorAll('.bth');
    const update = (event) => {
      var parent = graph.getDefaultParent();
      var doc = xmlUtils.createXmlDocument();
      var load = new ModelXmlSerializer(graph.getDataModel()).import(dataGraph);
      console.log(load);
      // Тут обратотка кнопко и их отрисовка(править по возможности)
      graph.batchUpdate(() => {
        // Кнопки Add (ПЕРЕПИСАТЬ)
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
    };


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

  return (
    <div ref={graphContainerRef} style={{ width: '100%', height: '100%' }} />
  );
};


