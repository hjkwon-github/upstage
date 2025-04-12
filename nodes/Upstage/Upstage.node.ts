import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IBinaryKeyData,
	NodeOperationError,
} from 'n8n-workflow';

import FormData from 'form-data';
import { Buffer } from 'buffer';

export class Upstage implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Upstage',
		name: 'upstage',
		icon: 'file:upstage.svg',
		group: ['transform'],
		version: 1,
		description: "Analyze documents using Upstage's Document Parsing API",
		defaults: {
			name: 'Upstage',
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
				default: 'ko',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('upstageApi');

		for (let i = 0; i < items.length; i++) {
			const binaryData = items[i].binary as IBinaryKeyData;

			if (!binaryData || Object.keys(binaryData).length === 0) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: 'No binary data found on input item.',
						},
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), 'No binary data found on input item.');
			}

			const language = this.getNodeParameter('language', i) as string;

			for (const binaryKey of Object.keys(binaryData)) {
				try {
					const file = binaryData[binaryKey];

					if (!file.data) {
						throw new NodeOperationError(this.getNode(), `Binary data "${binaryKey}" is missing "data" property.`);
					}

					const fileName = file.fileName || `upload.${file.fileExtension || 'dat'}`;
					const mimeType = file.mimeType || 'application/octet-stream';

					const form = new FormData();
					form.append('file', Buffer.from(file.data, 'base64'), {
						filename: fileName,
						contentType: mimeType,
					});
					form.append('language', language);

					const response = await this.helpers.request({
						method: 'POST',
						url: 'https://console.upstage.ai/api/document-digitization/document-parsing',
						headers: {
							...form.getHeaders(),
							Authorization: `Bearer ${credentials.apiKey}`,
						},
						body: form,
					});

					returnData.push({
						json: {
							success: true,
							binaryProperty: binaryKey,
							result: response,
						},
					});
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({
							json: {
								success: false,
								binaryProperty: binaryKey,
								error: (error as Error).message,
							},
						});
						continue;
					}
					throw error;
				}
			}
		}

		return [returnData];
	}
}