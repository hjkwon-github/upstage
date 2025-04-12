import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IBinaryKeyData,
	NodeOperationError,
} from 'n8n-workflow';
import { Buffer } from 'buffer';
import FormData from 'form-data';
import axios from 'axios';

export class UpstageDocumentParsing implements INodeType {
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
				displayName: 'Output Formats',
				name: 'outputFormats',
				type: 'multiOptions',
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'HTML', value: 'html' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Markdown', value: 'markdown' },
				],
				default: ['html', 'text'],
			},
			{
				displayName: 'Base64 Encoding',
				name: 'base64Encoding',
				type: 'multiOptions',
				options: [{ name: 'Table', value: 'table' }],
				default: ['table'],
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

		console.log(`🚀 Upstage Document Parsing started. Total items: ${items.length}`);

		for (let i = 0; i < items.length; i++) {
			const binaryData = items[i].binary as IBinaryKeyData;

			if (!binaryData || Object.keys(binaryData).length === 0) {
				console.warn(`⚠️ No binary data found for item ${i}`);
				if (this.continueOnFail()) {
					returnData.push({ json: { success: false, error: 'No binary data found.' } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), 'No binary data found.');
			}

			const outputFormats = this.getNodeParameter('outputFormats', i) as string[];
			const base64Encoding = this.getNodeParameter('base64Encoding', i) as string[];
			const ocr = this.getNodeParameter('ocr', i) as string;
			const coordinates = this.getNodeParameter('coordinates', i) as boolean;

			for (const binaryKey of Object.keys(binaryData)) {
				try {
					const file = binaryData[binaryKey];
					const fileBuffer = Buffer.from(file.data, 'base64');
					const fileName = file.fileName || `upload-${Date.now()}.${file.fileExtension || 'dat'}`;
					const mimeType = file.mimeType || 'application/octet-stream';

					// 📄 로그: 파일 및 파라미터 정보
					console.log(`📎 File: ${fileName}`);
					console.log(` - MIME Type: ${mimeType}`);
					console.log(` - Size: ${fileBuffer.length} bytes`);
					console.log(`📋 Parameters:`);
					console.log(` - model: document-parse`);
					console.log(` - output_formats: ${JSON.stringify(outputFormats)}`);
					console.log(` - base64_encoding: ${JSON.stringify(base64Encoding)}`);
					console.log(` - ocr: ${ocr}`);
					console.log(` - coordinates: ${coordinates}`);

					// FormData 구성
					const formData = new FormData();
					formData.append('model', 'document-parse');
					formData.append('output_formats', JSON.stringify(outputFormats));
					formData.append('base64_encoding', JSON.stringify(base64Encoding));
					formData.append('ocr', ocr);
					formData.append('coordinates', String(coordinates));
					formData.append('document', fileBuffer, { filename: fileName, contentType: mimeType });

					// Header
					const headers = {
						...formData.getHeaders(),
						Authorization: `Bearer ${credentials.apiKey}`,
					};

					console.log(`📤 Headers:\n${JSON.stringify(headers, null, 2)}`);

					// 바디 미리보기 (텍스트 일부)
					const preview = fileBuffer.toString('base64').substring(0, 200);
					console.log(`🧾 File content preview (base64):\n${preview}...`);

					// 요청 보내기
					const response = await axios.post(
						'https://api.upstage.ai/v1/document-digitization',
						formData,
						{ headers },
					);

					console.log(`✅ API response for file ${fileName}:\n${JSON.stringify(response.data, null, 2)}`);

					returnData.push({
						json: {
							success: true,
							result: response.data,
							file: file.fileName ?? fileName,
						},
					});
				} catch (error) {
					console.error(`❌ Error processing "${binaryKey}":`, error);
					console.error(`🧨 Full AxiosError:\n${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`);

					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								error: (error as Error).message,
							},
						});
						continue;
					}
					throw error;
				}
			}
		}

		console.log('🏁 Upstage Document Parsing finished.');
		return [returnData];
	}
}