import React, { useState } from 'react';
import { YourComponent } from './components/GraphComponent'; // Исправлено на импорт по умолчанию
import  FileUploader  from './components/file-uploader'; // Исправлено на импорт как член объекта

function App() {
  const [value, setValue] = useState('');

  const handleChange = (newValue) => {
    console.log("help");
    setValue(newValue);
  };

  console.log(value);
  
  return (
    <>
      <FileUploader graph2={handleChange}/>
      <YourComponent graph={value} />
    </>
  );
}

export default App;