const OCR = require('tesseract.js-node');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');

let worker;

const initOCR = async () => {
  worker = await OCR({
    tessdata: './',
    languages: ['bender']
  });
  return;
}

const processImage = async (fileName, filePath) => {

  const processedImgPath = `./data/images/processed/${fileName}.png`;

  await prepareImage(processedImgPath, filePath);

  if (fs.existsSync(processedImgPath)) {
    const text = worker.recognize(processedImgPath, 'bender');
    let price_array = text.replace(/[^\S\r\n]/g, '').split('\n').filter(string => string.length);

    price_array = price_array.map(price => price.slice(0, -1));
    return price_array;
  } else {
    console.log('RETURNNING NULL: ', processedImgPath)
    return null;
  }
};

const prepareImage = async (processedImgPath, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      const execString = `convert` + ' ' +
      filePath + ' ' +
      `-crop 190x1025+1215+40` + ' ' +
      `-colorspace Gray ` + ' ' +
      `-channel Gray` + ' ' +
      `-threshold 50%` + ' ' +
      `-negate` + ' ' +
      processedImgPath;
  
      const { stdout, stderr } = await exec(execString);
      if (stderr) {
        throw new Error(stderr);
      }    
    } else {
      console.log('IMG DOESNT EXIST: ', processedImgPath)
    }
  } catch (error) {
    console.log('Error preparing image: ', error);
  }
}

const prepareAll = async () => {
  let files = fs.readdirSync('./data/images/raw');
  files.forEach(async (file) => {
    const processedImgPath = `./data/images/processed/${file.slice(0, -3)}tif`;
    const filePath = `./data/images/raw/${file}`;
    await prepareImage(processedImgPath, filePath);
  });
 

}

module.exports = {
  processImage,
  initOCR,
  prepareAll
};
