import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    IBinaryKeyData,
    NodeOperationError,
} from "n8n-workflow";

import FormData from "form-data";
import { Buffer } from "buffer";

export class Upstage implements INodeType {
    description: INodeTypeDescription = {
        displayName: "Upstage",
        name: "upstage",
        icon: "file:upstage.svg",
        group: ["transform"],
        version: 1,
        description: "Analyze documents using Upstage's Document Parsing API",
        defaults: {
            name: "Upstage",
        },
        // @ts-ignore
        inputs: ["main"],
        // @ts-ignore
        outputs: ["main"],
        credentials: [
            {
                name: "upstageApi",
                required: true,
            },
        ],
        properties: [
            {
                displayName: "Binary Property",
                name: "binaryPropertyName",
                type: "string",
                default: "data",
                required: true,
                description: "Name of the binary property containing the file",
            },
            {
                displayName: "Language",
                name: "language",
                type: "options",
                options: [
                    { name: "Korean", value: "ko" },
                    { name: "English", value: "en" },
                ],
                default: "ko",
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];

        for (let i = 0; i < items.length; i++) {
            try {
                const binaryPropertyName = this.getNodeParameter("binaryPropertyName", i) as string;
                const language = this.getNodeParameter("language", i) as string;

                const binaryData = items[i].binary as IBinaryKeyData;
                const file = binaryData[binaryPropertyName];

                if (!file || !file.data) {
                    throw new NodeOperationError(this.getNode(), `No binary data found for property "${binaryPropertyName}"`);
                }

                const credentials = await this.getCredentials("upstageApi");

                const form = new FormData();
                form.append("file", Buffer.from(file.data, 'base64'), {
                    filename: file.fileName || "document",
                    contentType: file.mimeType,
                });
                form.append("language", language);

                const response = await this.helpers.request({
                    method: "POST",
                    url: "https://console.upstage.ai/api/document-digitization/document-parsing",
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${credentials.apiKey}`,
                    },
                    body: form,
                });

                returnData.push({
                    json: {
                        success: true,
                        result: response,
                    },
                });
            } catch (error) {
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

        return [returnData];
    }
}