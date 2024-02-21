import React, {useMemo, useState} from "react";

import {useDropzone} from "react-dropzone";

import fileIcon from "../../assets/file.svg";
import trashIcon from "../../assets/trashIcon.svg";
import editIcon from "../../assets/editIcon.svg";
import dragNdropIcon from "../../assets/components/dragNdrop.svg";
import {floodFill} from "../../utils/imageUtils";
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

export const processImage = async (imageSrc, tolerance) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = imageSrc;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      floodFill(ctx, 0, 0, imageData, tolerance);
      floodFill(ctx, canvas.width - 1, 0, imageData, tolerance);
      floodFill(ctx, 0, canvas.height - 1, imageData, tolerance);
      floodFill(ctx, canvas.width - 1, canvas.height - 1, imageData, tolerance);
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL());
    };
    img.onerror = reject;
  });
};

export default function MTBDropZone({fileType, setData, setFile, uploadedImage}) {
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [key, setKey] = useState(0);
  const acceptObj =
    fileType === "image"
      ? {
          "image/jpeg": [],
          "image/png": [],
        }
      : {"text/xml": [".kml"]};
  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles[0]) {
      const processedImageUrl = await processImage(URL.createObjectURL(acceptedFiles[0]), 30);

      setFile(processedImageUrl);
      setIsFileUploaded(true);

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
  const handleTrashClick = () => {
    setKey((prevKey) => prevKey + 1);
    setIsFileUploaded(false);
    setFile(null);
  };
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
              maxWidth: "60%",
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
        <img src={trashIcon} alt='trashIcon' onClick={handleTrashClick} />
      </div>
      {!uploadedImage ? (
        <div {...getRootProps({style})}>
          <input {...getInputProps()} key={key} />
          <div className='drag-and-drop-labels'>
            <img src={dragNdropIcon} alt='dragNdrop' />
            <div>Drag and drop</div>
            <div className='drag-and-drop-secondary-label'>
              <div className='drag-and-drop-text'>your logo here or</div>
              <div className='drag-and-drop-browse'>browse</div>
            </div>
          </div>
        </div>
      ) : (
        <aside>
          <div className='drag-and-drop-labels'>
            {uploadedImage ? (
              <img
                src={uploadedImage}
                style={{maxWidth: "100%", maxHeight: "256px"}}
                alt='Uploaded'
              />
            ) : (
              <ul>{files}</ul>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
