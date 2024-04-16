import React, { useState, createContext, useContext } from 'react';
import { YourComponent, FileUploader } from './components/GraphComponent'; // Предполагается, что FileUploader не экспортируется по умолчанию
const ValueContext = createContext(null);
export default function App() {
  const [value, setValue] = useState(''); // Используем состояние для хранения значения графа
  const handleChange = (value2) => {
    console.log("бляяять");
    setValue(value2); // Сохраняем новое значение графа
  };
  let getValue = '';
  console.log(getValue);
  return (
    <>
      {/* Передаем функцию обновления графа и текущее значение в FileUploader */}
      <FileUploader graph2={value} />
      {/* Передаем функцию обновления графа в YourComponent */}
      <YourComponent graph={handleChange} />
    </>
  );
  
  console.log(getValue);
}