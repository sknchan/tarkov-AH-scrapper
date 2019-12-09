const wikiParser = require('./wiki-parser');
const ocr = require('./ocr');
const categories = require("./wiki-categories.json");
const util = require('util');
const fs = require('fs');
const moment = require('moment');
const glob = require('glob');


const writeFile = (fileName, data) => util.promisify(fs.writeFile)(fileName, data);
const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf-8');

const ammunition = {
    categories: [
        "762x25",
        "9x18",
        "9x19",
        "9x21",
        "46x30",
        "57x28",
        "545x39",
        "556x45",
        "762x39",
        "762x51",
        "762x54",
        "9x39",
        "366",
        "127x55",
        "12x70",
        "20x70",
      ],
    stacks: {
        "762x25": 50,
        "9x18": 50,
        "9x19": 50,
        "9x21": 50,
        "46x30": 70,
        "57x28": 60,
        "545x39": 60,
        "556x45": 60,
        "762x39": 60,
        "762x51": 40,
        "762x54": 40,
        "9x39": 50,
        "366": 50,
        "127x55": 30,
        "12x70": 20,
        "20x70": 20
    }
}

let args = process.argv.slice(2);

const allCategories = async () => {
    for (const [category, categoryData] of Object.entries(categories)) {
        let result = await wikiParser.getItemsFromCategory(category, categoryData);

        if (result) {
            try {
                await writeFile(`./data/wiki/${category}-data.json`, JSON.stringify(result, null, 2));
                console.log('File writen');
            } catch (err) {
                console.log(err);
                throw err;
            }
        }
    }
}

const singleCategory = async (category) => {
    let categoryData = categories[category];
    if (!categoryData) {
        console.log(`Catergory named ${category} not found!`);
        return;
    }
    let result = await wikiParser.getItemsFromCategory(category, categoryData);

    if (result) {
        try {
            await writeFile(`./data/wiki/${category}-data.json`, JSON.stringify(result, null, 2));
            console.log('File writen');
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
    return;
}

const runOCR = async (category) => {
    
    if (!categories[category]) {
        console.log('Category not found: ', category);
        return;
    }

    let JSONData = await readFile(`./data/wiki/${category}-data.json`);
    JSONData = JSON.parse(JSONData);

    let JSONwithPrices = await Promise.all(JSONData.map(async item => {

        const fullFilePath = glob.sync(`./data/images/raw/${item.filePath}_*.png`)[0];

        item.price_array = await ocr.processImage(item.filePath, fullFilePath);

        item = correctPriceErrors(item);

        item.price_array = item.price_array.map(price => parseInt(price));

        let price_avg;
        if (item.price_array.length > 2) {
            const sliced = item.price_array.slice(0, 3);
            const sum = sliced.reduce((acc, val) => acc + val, 0);
            price_avg = Math.floor(sum / sliced.length);
        } else {
            const sum = item.price_array.reduce((acc, val) => acc + val, 0);
            price_avg = Math.floor(sum / item.price_array.length);
        }

        const slots = item.size.width * item.size.height;
        let price_per_slot;

        if (ammunition.categories.includes(item.category)) {
            price_per_slot = Math.floor(price_avg * ammunition.stacks[item.category]);
        } else {
            price_per_slot = Math.floor(price_avg / slots);
        }

        const timestampRegex = /_(\d+).png/;
        const timestamp = fullFilePath.match(timestampRegex)[1];

        return {
            ...item,
            slots,
            timestamp,
            price_per_slot,
            price_avg,
        }
    }));

    try {
        const timestamp = moment().format('YYYYMMDDHHmmss');
        await writeFile(`./data/final/${category}-data-${timestamp}.json`, JSON.stringify(JSONwithPrices, null, 2));
        console.log('File writen');
    } catch (error) {
        console.log(error);
        throw error;
    }
    console.log('return ', category);
    return;
}

const correctPriceErrors = (item) => {
    let checkForErrors = true;
    while (checkForErrors) {
        checkForErrors = false;
        item.price_array = item.price_array.map((price, index) => {
            if (item.price_array[index + 1]) {
                let currentPriceLength = price.length;
                let nextPriceLength = item.price_array[index + 1].length;
                if (nextPriceLength < currentPriceLength ) {
                    const difference = nextPriceLength - currentPriceLength;
                    price = price.slice(0, difference);
                    checkForErrors = true;
                }
            }
            return price;
        });
    }
    return item;
}

(async () => {
    if (args.length && args[0] === 'wiki') {
        args = args.slice(1);
        if (args.length && args[0] === 'all') {
            allCategories().catch(err => console.log('Error: ', err));
        } else if (args.length) {
            for (const category of args) {
                await singleCategory(category).catch(err => console.log('Error: ', err));
            }
        } else {
            console.log('Please provide arguments for categories you want to scrape or \'all\' for everything.');
        }
    } else if (args.length && args[0] === 'ocr') {
        args = args.slice(1);

        await ocr.initOCR();
        for (const category of args) {
            console.log('loop: ', category);
            await runOCR(category).catch(err => console.log('Error: ', err));
        }
        return;
    } else if (args.length && args[0] === 'final') {
        let JSONArray = fs.readdirSync('./data/final/');

        const finalData = JSONArray.reduce((acc, fileName) => {

            console.log(fileName);

            let data = fs.readFileSync('./data/final/' + fileName, 'utf-8');
            console.log(data);
            data = JSON.parse(data);
            data.forEach(item => acc.push(item));
            return acc;
        }, []);

        try {
            const timestamp = moment().format('YYYYMMDDHHmmss');
            await writeFile(`./data/data-${timestamp}.json`, JSON.stringify(finalData, null, 2));
            console.log('File writen');
        } catch (error) {
            console.log(error);
            throw error;
        }
  
    } else {
        console.log('Provide arguments for operation. \'wiki\' or \'ocr\'');
    }
})();