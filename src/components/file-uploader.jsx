import React, { useState } from "react";
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
  MyCustomGraph, 
  MyCustomEdgeSegmentHandler, 
  MyCustomGraphView, 
  MyCustomConnectionHandler,  
  MyCustomPanningHandler, 
  MyCustomSelectionHandler,
  MyCustomEdgeHandler,
  MyCustomConstraintHandler
} from './MyCustomGraph.jsx';

import { createGraphContainer } from './shared/configure.js';

import "./file-uploader.css";
//import { YourComponent } from './GraphComponent'; // Исправлено на импорт по умолчанию

const FileUploader = ({ graph2 }) => {

  const [xmlContent, setXmlContent] = useState(null);
  //console.log({graph2});

  const handleOnChange = (event) => {
    event.preventDefault();
    if (event.target.files && event.target.files.length) {
      const file = event.target.files[0];
      if (file.name.endsWith('.xml')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target.result;
            setXmlContent(content);
            graph2(content);
            // console.log(content);
            // Switch for black background and bright styles
            // let invert = false;
            // let MyCustomCellEditorHandler;

            // if (invert) {
            //   container.style.backgroundColor = 'black';

            //   // White in-place editor text color
            //   MyCustomCellEditorHandler = class extends CellEditorHandler {
            //     startEditing(cell, trigger) {
            //       super.startEditing.apply(this, arguments);

            //       if (this.textarea != null) {
            //         this.textarea.style.color = '#FFFFFF';
            //       }
            //     }
            //   };
            // } else {
            //   MyCustomCellEditorHandler = CellEditorHandler;
            // }
            // const container = createGraphContainer({
            //   imageUrl: 'images/grid.gif'
            // });
            // let graph = new MyCustomGraph(container, null, [
            //   MyCustomCellEditorHandler,
            //   TooltipHandler,
            //   SelectionCellsHandler,
            //   PopupMenuHandler,
            //   MyCustomConnectionHandler,
            //   MyCustomSelectionHandler,
            //   MyCustomPanningHandler,
            // ]);
            // graph2(content);
            // console.log("Graph2"+graph2);
            
            // Используем переданный graph здесь
            // if (graph) {
            //   new ModelXmlSerializer(graph.getDataModel()).import(content);
            //   console.log("XML файл загружен и импортирован в модель данных графа.");
            //   console.log({graph});
            //   graph2(graph);
            // } else {
            //   console.error("ОШИБКА СТОП");
            //   console.log({graph2});
            // }

            
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
export default FileUploader;