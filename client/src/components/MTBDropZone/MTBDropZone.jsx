import React, {useMemo, useState} from "react";

import {useDropzone} from "react-dropzone";

import fileIcon from "../../assets/file.svg";
import trashIcon from "../../assets/trashIcon.svg";
import editIcon from "../../assets/editIcon.svg";
import dragNdropIcon from "../../assets/components/dragNdrop.svg";

import "./MTBDropZone.css";
const baseStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "16px",
  borderWidth: 2,
  borderRadius: 20,
  borderColor: "#bebdbd",
  borderStyle: "dashed",
  backgroundColor: "#fafafa22",
  color: "#bdbdbd",
  outline: "none",
  transition: "border .24s ease-in-out",
  justifyContent: "center",
  height: "256px",
};

const focusedStyle = {
  borderColor: "#2196f3",
};

const acceptStyle = {
  borderColor: "#eeeeee",
};

const rejectStyle = {
  borderColor: "#eeeeee",
};



export const processImage = async (imageSrc) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "Anonymous"; 
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
          data[i + 3] = 0; 
        }
      }

      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL());
    };
    img.onerror = reject;
  });
};

export default function MTBDropZone({fileType, setData, setFile}) {
  const [uploadedImage, setUploadedImage] = useState(null);
  const acceptObj =
    fileType === "image"
      ? {
          "image/jpeg": [],
          "image/png": [],
        }
      : {"text/xml": [".kml"]};
  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles[0]) {
      setFile(acceptedFiles[0]);
      if ( fileType === "image" ) {
        const processedImageUrl = await processImage(URL.createObjectURL(acceptedFiles[0]));
        // setUploadedImage(URL.createObjectURL(acceptedFiles[0]));
        setUploadedImage(processedImageUrl);
      }

      if (fileType === "kml") {
        const xmlDocuments = [];
        for (const file of acceptedFiles) {
          const xmlDocument = await parseXmlFile(file);
          xmlDocuments.push(xmlDocument);
        }
        for (const xmlDocument of xmlDocuments) {
          const placemarkElements = xmlDocument.querySelectorAll("Placemark");
          for (const placemark of placemarkElements) {
            const coordinatesElement = placemark.querySelector("Polygon");
            if (coordinatesElement) {
              let outputString = coordinatesElement.textContent
                .replace(/\n/g, "")
                .replace(/\t/g, "");
              let array = outputString.split(" ");
              array.pop();
              setData(array);
            }
          }
        }
      }
    }
  };

  const parseXmlFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const text = event.target.result;
        const parser = new DOMParser();
        try {
          const xmlDocument = parser.parseFromString(text, "text/xml");
          resolve(xmlDocument);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsText(file);
    });
  };
  const {acceptedFiles, getRootProps, getInputProps, isFocused, isDragAccept, isDragReject} =
    useDropzone({
      maxFiles: 1,
      onDrop,
      accept: acceptObj,
    });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject]
  );

  const files = acceptedFiles.map((file) => (
    <div
      key={file.path}
      className='Geo-create-li-files'
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        width: "100%",
        minHeight: "100px",
      }}>
      <div
        style={{
          maxHeight: "90%",
          maxWidth: "90%",
          overflow: "hidden",
        }}>
        {uploadedImage ? (
          <img
            src={uploadedImage}
            alt='Uploaded'
            style={{
              maxHeight: "350px",
              objectFit: "contain",
            }}
          />
        ) : (
          <img src={fileIcon} alt='File Icon' />
        )}
      </div>
    </div>
  ));

  return (
    <div className='drag-and-drop'>
      <div className='edit-delete-icons'>
        <img src={editIcon} alt='editIcon' onClick={() => acceptedFiles.length = 0} />
        <img src={trashIcon} alt='trashIcon' onClick={() => setUploadedImage(false)} />
      </div>
      {acceptedFiles.length === 0 && (
        <div {...getRootProps({style})}>
          <input {...getInputProps()} />
          <div className='drag-and-drop-labels'>
            <img src={dragNdropIcon} alt='dragNdrop' />
            <div className=''>Drag and drop</div>
            <div className='drag-and-drop-secondary-label'>
              <div className='drag-and-drop-text'>your logo here or</div>
              <div className='drag-and-drop-browse'>browse</div>
            </div>
          </div>
        </div>
      )}
      <aside>
        {acceptedFiles.length > 0 && (
          <div className='drag-and-drop-labels'>
            <ul>{files}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
