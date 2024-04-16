import React, { useState } from "react";
import "./file-uploader.css";

export const FileUploader = () => {
  const [xmlContent, setXmlContent] = useState(null);

  const handleOnChange = (event) => {
    event.preventDefault();
    if (event.target.files && event.target.files.length) {
      const file = event.target.files[0];
      if (file.name.endsWith('.xml')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          setXmlContent(content);
          console.log("XML файл загружен и сохранен внутри компонента.");
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
        </div>
      )}
    </form>
  );
};