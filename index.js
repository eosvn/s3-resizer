'use strict'


const AWS = require('aws-sdk');
const S3 = new AWS.S3({signatureVersion: 'v4'});
const Sharp = require('sharp');
const PathPattern = /(.*\/)?(.*)\/(.*)/;

// parameters
const {BUCKET, URL} = process.env;


exports.handler = async (event) => {
    const path = event.queryStringParameters.path;
    const parts = PathPattern.exec(path);
    const dir = parts[1] || '';
    const options = parts[2].split('_');
    const filename = parts[3];


    const sizes = options[0].split("x");
    const action = options.length > 1 ? options[1] : null;

    if (action && action !== 'max' && action !== 'min') {
        return {
            statusCode: 400,
            body: `Unknown func parameter "${action}"\n` +
                  'For query ".../150x150_func", "_func" must be either empty, "_min" or "_max"',
            headers: {"Content-Type": "text/plain"}
        };
    }

    try {
        const data = await S3
            .getObject({Bucket: BUCKET, Key: dir + filename})
            .promise();

        const width = sizes[0] === 'AUTO' ? null : parseInt(sizes[0]);
        const height = sizes[1] === 'AUTO' ? null : parseInt(sizes[1]);
        let fit;
        switch (action) {
            case 'max':
                fit = 'inside';
                break;
            case 'min':
                fit = 'outside';
                break;
            default:
                fit = 'cover';
                break;
        }
        const result = await Sharp(data.Body, {failOnError: false})
            .resize(width, height, {withoutEnlargement: true, fit})
            .rotate()
            .toBuffer();

        await S3.putObject({
            Body: result,
            Bucket: BUCKET,
            ContentType: data.ContentType,
            Key: path,
            CacheControl: 'public, max-age=86400'
        }).promise();

        return {
            statusCode: 301,
            headers: {"Location" : `${URL}/${path}`}
        };
    } catch (e) {
        return {
            statusCode: e.statusCode || 400,
            body: 'Exception: ' + e.message,
            headers: {"Content-Type": "text/plain"}
        };
    }
}
