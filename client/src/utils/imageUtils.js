export function colorsMatch(a, b, tolerance) {
  return (
    Math.abs(a.r - b.r) <= tolerance &&
    Math.abs(a.g - b.g) <= tolerance &&
    Math.abs(a.b - b.b) <= tolerance &&
    Math.abs(a.a - b.a) <= tolerance
  );
}

export function getColorAtPixel(imageData, x, y) {
  const {width, data} = imageData;
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

export function floodFill(ctx, startX, startY, imageData, tolerance) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const targetColor = {r: 255, g: 255, b: 255, a: 0};
  const replacementColor = {r: 0, g: 0, b: 0, a: 0};

  function matchStartColor(pixelPos) {
    const pixelColor = {
      r: data[pixelPos],
      g: data[pixelPos + 1],
      b: data[pixelPos + 2],
      a: data[pixelPos + 3],
    };
    pixelColor.a = targetColor.a;
    return colorsMatch(pixelColor, targetColor, tolerance);
  }

  function colorPixel(pixelPos) {
    data[pixelPos] = replacementColor.r;
    data[pixelPos + 1] = replacementColor.g;
    data[pixelPos + 2] = replacementColor.b;
    data[pixelPos + 3] = replacementColor.a;
  }

  const pixelStack = [[startX, startY]];
  while (pixelStack.length) {
    let newPos = pixelStack.pop();
    let x = newPos[0];
    let y = newPos[1];

    let pixelPos = (y * width + x) * 4;
    while (y-- >= 0 && matchStartColor(pixelPos)) {
      pixelPos -= width * 4;
    }
    pixelPos += width * 4;
    ++y;
    let reachLeft = false;
    let reachRight = false;
    while (y++ < height - 1 && matchStartColor(pixelPos)) {
      colorPixel(pixelPos);

      if (x > 0) {
        if (matchStartColor(pixelPos - 4)) {
          if (!reachLeft) {
            pixelStack.push([x - 1, y]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }

      if (x < width - 1) {
        if (matchStartColor(pixelPos + 4)) {
          if (!reachRight) {
            pixelStack.push([x + 1, y]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      pixelPos += width * 4;
    }
  }
}
