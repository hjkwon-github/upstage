import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IBinaryKeyData,
	NodeOperationError,
} from 'n8n-workflow';

import { Buffer } from 'buffer';

export class Upstage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage Document Parsing',
		name: 'upstageDocumentParsing',
		icon: 'file:Upstage.svg',
		group: ['transform'],
		version: 1,
		description: 'Parse documents using Upstage Document Digitization API',
		defaults: {
			name: 'Upstage Document Parsing',
		},
		// @ts-ignore
		inputs: ['main'],
		// @ts-ignore
		outputs: ['main'],
		credentials: [
			{
				name: 'upstageApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: [
					{ name: 'Korean', value: 'ko' },
					{ name: 'English', value: 'en' },
				],
				default: 'en',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'string',
				default: 'document-parse',
			},
			{
				displayName: 'Output Formats',
				name: 'outputFormats',
				type: 'multiOptions',
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'HTML', value: 'html' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Markdown', value: 'markdown' },
				],
				default: ['text'],
			},
			{
				displayName: 'Base64 Encoding',
				name: 'base64Encoding',
				type: 'multiOptions',
				options: [
					{ name: 'Table', value: 'table' },
				],
				default: [],
			},
			{
				displayName: 'OCR',
				name: 'ocr',
				type: 'options',
				options: [
					{ name: 'Auto', value: 'auto' },
					{ name: 'True', value: 'true' },
					{ name: 'False', value: 'false' },
				],
				default: 'auto',
			},
			{
				displayName: 'Include Coordinates',
				name: 'coordinates',
				type: 'boolean',
				default: true,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('upstageApi');
		const BOUNDARY = '----WebKitFormBoundary7MA4YWxkTrZu0gW';

		console.log(`🚀 Upstage Document Parsing node started`);
		console.log(`📦 Items received: ${items.length}`);

		for (let i = 0; i < items.length; i++) {
			const binaryData = items[i].binary as IBinaryKeyData;

			if (!binaryData || Object.keys(binaryData).length === 0) {
				console.warn('⚠️ No binary data found on input item.');
				if (this.continueOnFail()) {
					returnData.push({ json: { success: false, error: 'No binary data found.' } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), 'No binary data found.');
			}

			const model = this.getNodeParameter('model', i) as string;
			const language = this.getNodeParameter('language', i) as string;
			const outputFormats = this.getNodeParameter('outputFormats', i) as string[];
			const base64Encoding = this.getNodeParameter('base64Encoding', i) as string[];
			const ocr = this.getNodeParameter('ocr', i) as string;
			const coordinates = this.getNodeParameter('coordinates', i) as boolean;

			console.log(`📄 Input parameters for item ${i}:`);
			console.log(` - Model: ${model}`);
			console.log(` - Language: ${language}`);
			console.log(` - Output Formats: ${outputFormats}`);
			console.log(` - Base64 Encoding: ${base64Encoding}`);
			console.log(` - OCR: ${ocr}`);
			console.log(` - Coordinates: ${coordinates}`);

			for (const binaryKey of Object.keys(binaryData)) {
				try {
					console.log(`🗂️ Processing binaryKey: ${binaryKey}`);
					const file = binaryData[binaryKey];

					if (!file || !file.data) {
						throw new NodeOperationError(this.getNode(), `Binary data "${binaryKey}" is missing or invalid.`);
					}

					const fileBuffer = Buffer.from(file.data, 'base64');
					if (!fileBuffer || fileBuffer.length === 0) {
						throw new NodeOperationError(this.getNode(), `Decoded buffer for "${binaryKey}" is empty.`);
					}

					const fileName = file.fileName || `upload-${Date.now()}.${file.fileExtension || 'dat'}`;
					const mimeType = file.mimeType || 'application/octet-stream';

					console.log(`📎 File: ${fileName} (${mimeType}), size=${fileBuffer.length} bytes`);

					const bodyParts: any[] = [
						[`output_formats`, JSON.stringify(outputFormats)],
						[`base64_encoding`, JSON.stringify(base64Encoding)],
						[`ocr`, ocr],
						[`coordinates`, String(coordinates)],
						[`language`, language],
						[`model`, model],
						[`document`, fileBuffer, fileName, mimeType],
					];

					const bufferParts: Buffer[] = [];

					for (const part of bodyParts) {
						if (part[0] === 'document') {
							bufferParts.push(Buffer.from(`--${BOUNDARY}\r\n`));
							bufferParts.push(Buffer.from(`Content-Disposition: form-data; name="${part[0]}"; filename="${part[2]}"\r\n`));
							bufferParts.push(Buffer.from(`Content-Type: ${part[3]}\r\n\r\n`));
							bufferParts.push(part[1] as Buffer);
							bufferParts.push(Buffer.from('\r\n'));
						} else {
							bufferParts.push(Buffer.from(`--${BOUNDARY}\r\n`));
							bufferParts.push(Buffer.from(`Content-Disposition: form-data; name="${part[0]}"\r\n\r\n`));
							bufferParts.push(Buffer.from(`${part[1]}\r\n`));
						}
					}

					bufferParts.push(Buffer.from(`--${BOUNDARY}--\r\n`));
					const multipartBody = Buffer.concat(bufferParts);

					console.log(`📤 Sending request to Upstage API...`);

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://api.upstage.ai/v1/document-digitization',
						headers: {
							'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
							Authorization: `Bearer ${credentials.apiKey}`,
						},
						body: multipartBody,
					});

					console.log(`✅ Success response from Upstage API for file: ${fileName}`);
					returnData.push({
						json: {
							success: true,
							result: response,
							file: file.fileName,
						},
					});
				} catch (error) {
					const message = (error as Error).message || 'Unknown error';
					console.error(`❌ Error processing binaryKey=${binaryKey}:`, message);

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								binaryProperty: binaryKey,
								error: message,
							},
						});
						continue;
					}
					throw error;
				}
			}
		}

		console.log('🏁 Upstage node finished.');
		return [returnData];
	}
}